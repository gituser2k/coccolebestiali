<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class UserAccount extends Model
{
    public function authenticateEmailUser(string $email, string $password): array
    {
        $this->ensurePasswordResetRequiredColumn();
        $normalizedEmail = strtolower(trim($email));

        $row = DB::table('users')
            ->select(['id', 'password_hash', 'email_verified', 'password_reset_required'])
            ->where('email', $normalizedEmail)
            ->first();

        if (! $row) {
            throw new RuntimeException('LOGIN_USER_NOT_FOUND');
        }

        if (! Hash::check($password, (string) $row->password_hash)) {
            throw new RuntimeException('LOGIN_PASSWORD_INVALID');
        }

        if (! (bool) $row->email_verified) {
            throw new RuntimeException('LOGIN_EMAIL_NOT_VERIFIED');
        }

        $user = $this->getUserById((int) $row->id);
        $user['passwordResetRequired'] = (bool) $row->password_reset_required;

        return $user;
    }

    public function registerEmailUser(string $role, string $email, string $password): array
    {
        $this->ensurePasswordResetRequiredColumn();
        $existing = DB::table('users')
            ->select(['id'])
            ->where('email', $email)
            ->first();

        if ($existing) {
            throw new RuntimeException('EMAIL_ALREADY_EXISTS');
        }

        $now = time();

        $userId = DB::table('users')->insertGetId([
            'role' => $role,
            'name' => '',
            'email' => $email,
            'email_verified' => 0,
            'password_hash' => Hash::make($password),
            'password_reset_required' => 0,
            'avatar' => '',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('user_reputation')->insertOrIgnore([
            'user_id' => $userId,
            'score' => PortalPolicy::value('initial_reputation_score'),
            'updated_at' => $now,
        ]);

        return $this->getUserById((int) $userId);
    }

    public function upsertSocialUser(
        string $provider,
        string $providerSub,
        string $role,
        string $email,
        bool $emailVerified,
        string $name,
        string $avatar,
        bool $isPrivateEmail,
        array $rawClaims
    ): array {
        return DB::transaction(function () use (
            $provider,
            $providerSub,
            $role,
            $email,
            $emailVerified,
            $name,
            $avatar,
            $isPrivateEmail,
            $rawClaims
        ) {
            $now = time();

            $social = DB::table('social_accounts')
                ->where('provider', $provider)
                ->where('provider_sub', $providerSub)
                ->first();

            $userId = null;

            if ($social) {
                $userId = (int) $social->user_id;
            } elseif ($email !== '') {
                $existingUser = DB::table('users')
                    ->select(['id'])
                    ->where('email', $email)
                    ->first();

                if ($existingUser) {
                    $userId = (int) $existingUser->id;
                }
            }

            if (! $userId) {
                $userId = (int) DB::table('users')->insertGetId([
                    'role' => $role,
                    'name' => $name,
                    'email' => $email !== '' ? $email : null,
                    'email_verified' => $emailVerified ? 1 : 0,
                    'password_hash' => '',
                    'avatar' => $avatar,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            } else {
                DB::table('users')
                    ->where('id', $userId)
                    ->update([
                        'role' => $role,
                        'name' => $name !== '' ? $name : DB::raw('name'),
                        'email' => $email !== '' ? $email : DB::raw('email'),
                        'email_verified' => $emailVerified ? 1 : DB::raw('email_verified'),
                        'avatar' => $avatar !== '' ? $avatar : DB::raw('avatar'),
                        'updated_at' => $now,
                    ]);
            }

            $claimsJson = json_encode($rawClaims, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (strlen((string) $claimsJson) > 4096) {
                $claimsJson = substr((string) $claimsJson, 0, 4096);
            }

            if ($social) {
                DB::table('social_accounts')
                    ->where('id', $social->id)
                    ->update([
                        'provider_email' => $email,
                        'provider_email_verified' => $emailVerified ? 1 : 0,
                        'is_private_email' => $isPrivateEmail ? 1 : 0,
                        'raw_claims' => (string) $claimsJson,
                        'updated_at' => $now,
                    ]);
            } else {
                DB::table('social_accounts')->insertGetId([
                    'user_id' => $userId,
                    'provider' => $provider,
                    'provider_sub' => $providerSub,
                    'provider_email' => $email,
                    'provider_email_verified' => $emailVerified ? 1 : 0,
                    'is_private_email' => $isPrivateEmail ? 1 : 0,
                    'raw_claims' => (string) $claimsJson,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('user_reputation')->insertOrIgnore([
                'user_id' => $userId,
                'score' => PortalPolicy::value('initial_reputation_score'),
                'updated_at' => $now,
            ]);

            return $this->getUserById($userId);
        });
    }

    public function loginSocialUser(string $provider, string $providerSub, string $email = ''): array
    {
        $social = DB::table('social_accounts')
            ->select(['user_id'])
            ->where('provider', $provider)
            ->where('provider_sub', $providerSub)
            ->first();

        $user = $social ? $this->getUserById((int) $social->user_id) : [];

        if ($user === [] && trim($email) !== '') {
            $user = $this->getUserByEmail($email);
        }

        if ($user === []) {
            throw new RuntimeException('LOGIN_SOCIAL_USER_NOT_FOUND');
        }

        return $user;
    }

    public function switchCurrentUserToEmail(int $userId, string $email, string $password): array
    {
        $normalizedEmail = strtolower(trim($email));

        if ($userId <= 0 || $normalizedEmail === '') {
            throw new RuntimeException('INVALID_CURRENT_USER');
        }

        return DB::transaction(function () use ($userId, $normalizedEmail, $password) {
            $existing = DB::table('users')
                ->select(['id'])
                ->where('email', $normalizedEmail)
                ->where('id', '<>', $userId)
                ->first();

            if ($existing) {
                throw new RuntimeException('EMAIL_ALREADY_EXISTS');
            }

            DB::table('users')
                ->where('id', $userId)
                ->update([
                    'email' => $normalizedEmail,
                    'email_verified' => 1,
                    'password_hash' => Hash::make($password),
                    'updated_at' => time(),
                ]);

            DB::table('social_accounts')
                ->where('user_id', $userId)
                ->delete();

            return $this->getUserById($userId);
        });
    }

    public function switchCurrentUserToSocial(
        int $userId,
        string $provider,
        string $providerSub,
        string $email,
        bool $emailVerified,
        string $name,
        string $avatar,
        bool $isPrivateEmail,
        array $rawClaims
    ): array {
        if ($userId <= 0 || $providerSub === '') {
            throw new RuntimeException('INVALID_CURRENT_USER');
        }

        return DB::transaction(function () use (
            $userId,
            $provider,
            $providerSub,
            $email,
            $emailVerified,
            $name,
            $avatar,
            $isPrivateEmail,
            $rawClaims
        ) {
            $now = time();
            $normalizedEmail = strtolower(trim($email));

            $existingSocial = DB::table('social_accounts')
                ->select(['id', 'user_id'])
                ->where('provider', $provider)
                ->where('provider_sub', $providerSub)
                ->first();

            if ($existingSocial && (int) $existingSocial->user_id !== $userId) {
                throw new RuntimeException('SOCIAL_ACCOUNT_ALREADY_LINKED');
            }

            if ($normalizedEmail !== '') {
                $existingEmailUser = DB::table('users')
                    ->select(['id'])
                    ->where('email', $normalizedEmail)
                    ->where('id', '<>', $userId)
                    ->first();

                if ($existingEmailUser) {
                    throw new RuntimeException('EMAIL_ALREADY_EXISTS');
                }
            }

            DB::table('users')
                ->where('id', $userId)
                ->update([
                    'name' => $name !== '' ? $name : DB::raw('name'),
                    'email' => $normalizedEmail !== '' ? $normalizedEmail : DB::raw('email'),
                    'email_verified' => $emailVerified ? 1 : DB::raw('email_verified'),
                    'password_hash' => '',
                    'avatar' => $avatar !== '' ? $avatar : DB::raw('avatar'),
                    'updated_at' => $now,
                ]);

            DB::table('social_accounts')
                ->where('user_id', $userId)
                ->where(function ($query) use ($provider, $providerSub) {
                    $query
                        ->where('provider', '<>', $provider)
                        ->orWhere('provider_sub', '<>', $providerSub);
                })
                ->delete();

            $claimsJson = json_encode($rawClaims, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (strlen((string) $claimsJson) > 4096) {
                $claimsJson = substr((string) $claimsJson, 0, 4096);
            }

            if ($existingSocial) {
                DB::table('social_accounts')
                    ->where('id', $existingSocial->id)
                    ->update([
                        'provider_email' => $normalizedEmail,
                        'provider_email_verified' => $emailVerified ? 1 : 0,
                        'is_private_email' => $isPrivateEmail ? 1 : 0,
                        'raw_claims' => (string) $claimsJson,
                        'updated_at' => $now,
                    ]);
            } else {
                DB::table('social_accounts')->insert([
                    'user_id' => $userId,
                    'provider' => $provider,
                    'provider_sub' => $providerSub,
                    'provider_email' => $normalizedEmail,
                    'provider_email_verified' => $emailVerified ? 1 : 0,
                    'is_private_email' => $isPrivateEmail ? 1 : 0,
                    'raw_claims' => (string) $claimsJson,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            return $this->getUserById($userId);
        });
    }

    public function getUserById(int $userId): array
    {
        $this->ensurePasswordResetRequiredColumn();
        $row = DB::table('users')
            ->select(['id', 'role', 'name', 'email', 'email_verified', 'password_reset_required', 'avatar'])
            ->where('id', $userId)
            ->first();

        if (! $row) {
            return [];
        }

        $provider = DB::table('social_accounts')
            ->where('user_id', $userId)
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->value('provider');

        return [
            'id' => (int) $row->id,
            'role' => (string) $row->role,
            'name' => (string) $row->name,
            'email' => $row->email ? (string) $row->email : '',
            'emailVerified' => (bool) $row->email_verified,
            'passwordResetRequired' => (bool) $row->password_reset_required,
            'avatar' => (string) $row->avatar,
            'provider' => $provider ? (string) $provider : '',
        ];
    }

    public function getUserByEmail(string $email): array
    {
        $row = DB::table('users')
            ->select(['id'])
            ->where('email', strtolower(trim($email)))
            ->first();

        if (! $row) {
            return [];
        }

        return $this->getUserById((int) $row->id);
    }

    public function markEmailAsVerified(string $email): void
    {
        DB::table('users')
            ->where('email', $email)
            ->update([
                'email_verified' => 1,
                'updated_at' => time(),
            ]);
    }

    public function createTemporaryPassword(string $email, string $temporaryPassword): array
    {
        $this->ensurePasswordResetRequiredColumn();
        $normalizedEmail = strtolower(trim($email));

        if ($normalizedEmail === '') {
            throw new RuntimeException('PASSWORD_RESET_EMAIL_INVALID');
        }

        $row = DB::table('users')
            ->select(['id', 'email_verified'])
            ->where('email', $normalizedEmail)
            ->first();

        if (! $row || ! (bool) $row->email_verified) {
            return [];
        }

        DB::table('users')
            ->where('id', (int) $row->id)
            ->update([
                'password_hash' => Hash::make($temporaryPassword),
                'password_reset_required' => 1,
                'updated_at' => time(),
            ]);

        return $this->getUserById((int) $row->id);
    }

    public function completeTemporaryPasswordChange(int $userId, string $password): array
    {
        $this->ensurePasswordResetRequiredColumn();

        if ($userId <= 0) {
            throw new RuntimeException('INVALID_CURRENT_USER');
        }

        $row = DB::table('users')
            ->select(['password_reset_required'])
            ->where('id', $userId)
            ->first();

        if (! $row) {
            throw new RuntimeException('LOGIN_USER_NOT_FOUND');
        }

        if (! (bool) $row->password_reset_required) {
            throw new RuntimeException('TEMPORARY_PASSWORD_NOT_REQUIRED');
        }

        DB::table('users')
            ->where('id', $userId)
            ->update([
                'password_hash' => Hash::make($password),
                'password_reset_required' => 0,
                'updated_at' => time(),
            ]);

        return $this->getUserById($userId);
    }

    public function deleteAccount(int $userId): array
    {
        if ($userId <= 0) {
            throw new RuntimeException('INVALID_CURRENT_USER');
        }

        $user = DB::table('users')
            ->select(['id', 'email', 'avatar'])
            ->where('id', $userId)
            ->first();

        if (! $user) {
            throw new RuntimeException('LOGIN_USER_NOT_FOUND');
        }

        $petIds = Schema::hasTable('ownerpet')
            ? DB::table('ownerpet')->where('user_id', $userId)->pluck('id')->map(fn ($id) => (int) $id)->all()
            : [];
        $calendarDayIds = Schema::hasTable('calendar_day')
            ? DB::table('calendar_day')->where('user_id', $userId)->pluck('id')->map(fn ($id) => (int) $id)->all()
            : [];
        $calendarSlotIds = $calendarDayIds !== [] && Schema::hasTable('calendar_day_slot')
            ? DB::table('calendar_day_slot')->whereIn('calendar_day_id', $calendarDayIds)->pluck('id')->map(fn ($id) => (int) $id)->all()
            : [];
        $messageIds = Schema::hasTable('message') && trim((string) $user->email) !== ''
            ? DB::table('message')->where('email', (string) $user->email)->pluck('id')->map(fn ($id) => (int) $id)->all()
            : [];
        $bookingIds = Schema::hasTable('booking')
            ? DB::table('booking')->where('owner_user_id', $userId)->orWhere('assistant_user_id', $userId)->pluck('id')->map(fn ($id) => (int) $id)->all()
            : [];

        $publicFiles = $this->collectAccountPublicFiles($userId, $petIds, (string) $user->avatar);
        $privateFiles = $this->collectAccountPrivateFiles($petIds);

        DB::transaction(function () use ($userId, $petIds, $calendarDayIds, $calendarSlotIds, $messageIds, $bookingIds) {
            if ($bookingIds !== []) {
                if (Schema::hasTable('booking_action_token')) {
                    DB::table('booking_action_token')->whereIn('booking_id', $bookingIds)->delete();
                }
                if (Schema::hasTable('booking_review')) {
                    DB::table('booking_review')->whereIn('booking_id', $bookingIds)->delete();
                }
                if (Schema::hasTable('reputation_event')) {
                    DB::table('reputation_event')->whereIn('booking_id', $bookingIds)->delete();
                }
                if (Schema::hasTable('booking_reschedule')) {
                    DB::table('booking_reschedule')->whereIn('booking_id', $bookingIds)->delete();
                }
                DB::table('booking')->whereIn('id', $bookingIds)->delete();
            }
            if (Schema::hasTable('booking_review')) {
                DB::table('booking_review')->where('reviewer_user_id', $userId)->orWhere('reviewed_user_id', $userId)->delete();
            }
            if (Schema::hasTable('reputation_event')) {
                DB::table('reputation_event')->where('user_id', $userId)->orWhere('actor_user_id', $userId)->delete();
            }
            $this->deleteByUserId('user_reputation', $userId);
            if ($calendarSlotIds !== [] && Schema::hasTable('calendar_day_slot_service')) {
                DB::table('calendar_day_slot_service')->whereIn('slot_id', $calendarSlotIds)->delete();
            }
            if ($calendarDayIds !== [] && Schema::hasTable('calendar_day_slot')) {
                DB::table('calendar_day_slot')->whereIn('calendar_day_id', $calendarDayIds)->delete();
            }
            $this->deleteByUserId('calendar_day', $userId);

            $this->deleteByUserId('operatorservicefeaturedata', $userId);
            $this->deleteByUserId('operatorservicedata', $userId);
            $this->deleteByUserId('operatorgallery', $userId);
            $this->deleteByUserId('housefeaturedata', $userId);
            $this->deleteByUserId('pettypedata', $userId);
            $this->deleteByUserId('petbreeddata', $userId);
            $this->deleteByUserId('operatortitledata', $userId);

            if (Schema::hasTable('operatordata') && Schema::hasTable('operatorassociatedata')) {
                $fiscalCode = trim((string) DB::table('operatordata')->where('user_id', $userId)->value('fiscal_code'));
                if ($fiscalCode !== '') {
                    DB::table('operatorassociatedata')->where('fiscal_code', $fiscalCode)->delete();
                }
            }
            $this->deleteByUserId('operatorassociatedata', $userId);
            $this->deleteByUserId('operatordata', $userId);

            if ($petIds !== []) {
                $this->deleteByPetIds('ownerpetbreeddata', $petIds);
                $this->deleteByPetIds('ownerpettypedata', $petIds);
                $this->deleteByPetIds('ownerpetgallery', $petIds);
                $this->deleteByPetIds('ownerpetdocument', $petIds);
            }
            $this->deleteByUserId('ownerpet', $userId);

            if ($messageIds !== [] && Schema::hasTable('messageback')) {
                DB::table('messageback')->whereIn('messageid', $messageIds)->delete();
            }
            if ($messageIds !== [] && Schema::hasTable('message')) {
                DB::table('message')->whereIn('id', $messageIds)->delete();
            }

            $this->deleteByUserId('personaldata', $userId);
            $this->deleteByUserId('social_accounts', $userId);
            DB::table('users')->where('id', $userId)->delete();
        });

        return [
            'publicFilesNotRemoved' => $this->deleteStorageFiles('public', $publicFiles),
            'privateFilesNotRemoved' => $this->deleteStorageFiles('local', $privateFiles),
        ];
    }

    private function collectAccountPublicFiles(int $userId, array $petIds, string $avatar): array
    {
        $paths = [$avatar];

        if (Schema::hasTable('personaldata')) {
            $paths[] = (string) DB::table('personaldata')->where('user_id', $userId)->value('photo');
        }
        if (Schema::hasTable('operatorgallery')) {
            $paths = array_merge($paths, DB::table('operatorgallery')->where('user_id', $userId)->pluck('photo')->all());
        }
        if ($petIds !== [] && Schema::hasTable('ownerpetgallery')) {
            $paths = array_merge($paths, DB::table('ownerpetgallery')->whereIn('pet_id', $petIds)->pluck('photo')->all());
        }

        return $this->normalizeStoragePaths($paths, true);
    }

    private function collectAccountPrivateFiles(array $petIds): array
    {
        if ($petIds === [] || ! Schema::hasTable('ownerpetdocument')) {
            return [];
        }

        return $this->normalizeStoragePaths(
            DB::table('ownerpetdocument')->whereIn('pet_id', $petIds)->pluck('file_path')->all(),
            false
        );
    }

    private function normalizeStoragePaths(array $paths, bool $public): array
    {
        $normalized = [];

        foreach ($paths as $path) {
            $value = trim((string) $path);
            if ($value === '' || preg_match('#^(?:https?:)?//#i', $value) || str_contains($value, '..')) {
                continue;
            }

            if ($public) {
                $value = preg_replace('#^/?storage/#', '', $value) ?? '';
            }
            $value = ltrim($value, '/');

            if ($value !== '') {
                $normalized[] = $value;
            }
        }

        return array_values(array_unique($normalized));
    }

    private function deleteStorageFiles(string $disk, array $paths): array
    {
        $failed = [];

        foreach ($paths as $path) {
            if (Storage::disk($disk)->exists($path) && ! Storage::disk($disk)->delete($path)) {
                $failed[] = $path;
            }
        }

        return $failed;
    }

    private function deleteByUserId(string $table, int $userId): void
    {
        if (Schema::hasTable($table)) {
            DB::table($table)->where('user_id', $userId)->delete();
        }
    }

    private function deleteByPetIds(string $table, array $petIds): void
    {
        if (Schema::hasTable($table)) {
            DB::table($table)->whereIn('pet_id', $petIds)->delete();
        }
    }

    private function ensurePasswordResetRequiredColumn(): void
    {
        if (! Schema::hasTable('users') || Schema::hasColumn('users', 'password_reset_required')) {
            return;
        }

        Schema::table('users', function ($table) {
            $table->boolean('password_reset_required')->default(false)->after('password_hash');
        });
    }
}
