<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class UserAccount extends Model
{
    public function authenticateEmailUser(string $email, string $password): array
    {
        $normalizedEmail = strtolower(trim($email));

        $row = DB::table('users')
            ->select(['id', 'password_hash', 'email_verified'])
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

        return $this->getUserById((int) $row->id);
    }

    public function registerEmailUser(string $role, string $email, string $password): array
    {
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
            'avatar' => '',
            'created_at' => $now,
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

    public function getUserById(int $userId): array
    {
        $row = DB::table('users')
            ->select(['id', 'role', 'name', 'email', 'email_verified', 'avatar'])
            ->where('id', $userId)
            ->first();

        if (! $row) {
            return [];
        }

        return [
            'id' => (int) $row->id,
            'role' => (string) $row->role,
            'name' => (string) $row->name,
            'email' => $row->email ? (string) $row->email : '',
            'emailVerified' => (bool) $row->email_verified,
            'avatar' => (string) $row->avatar,
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
}
