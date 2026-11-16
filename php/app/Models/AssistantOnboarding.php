<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

final class AssistantOnboarding
{
    public const VERSION = 1;

    private const STEPS = ['personal', 'operator', 'calendar', 'review'];

    public function start(int $userId): array
    {
        $user = DB::table('users')->select(['id', 'role'])->where('id', $userId)->first();
        if (! $user || ! Schema::hasTable('user_capabilities')) {
            throw new RuntimeException('Account non disponibile.');
        }

        $capabilities = new UserCapability;
        if (! DB::table('user_capabilities')->where('user_id', $userId)->exists()) {
            $capabilities->provisionForLegacyRole($userId, (string) $user->role);
        }

        $existing = DB::table('user_capabilities')
            ->where('user_id', $userId)
            ->where('capability', UserCapability::ASSISTANT)
            ->first();
        if ($existing && in_array((string) $existing->status, [
            UserCapability::STATUS_SUSPENDED,
            UserCapability::STATUS_REJECTED,
            UserCapability::STATUS_DISABLED,
        ], true)) {
            throw new RuntimeException('Il profilo Pet Assistant non può essere riattivato autonomamente.');
        }

        if (! $existing) {
            $now = time();
            DB::table('user_capabilities')->insertOrIgnore([
                'user_id' => $userId,
                'capability' => UserCapability::ASSISTANT,
                'status' => UserCapability::STATUS_DRAFT,
                'onboarding_version' => self::VERSION,
                'current_step' => 'personal',
                'completed_at' => 0,
                'activated_at' => 0,
                'suspended_at' => 0,
                'disabled_at' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        return $this->state($userId);
    }

    public function saveProgress(int $userId, string $step): array
    {
        if (! in_array($step, self::STEPS, true)) {
            throw new RuntimeException('Fase onboarding non valida.');
        }

        $updated = DB::table('user_capabilities')
            ->where('user_id', $userId)
            ->where('capability', UserCapability::ASSISTANT)
            ->whereIn('status', [UserCapability::STATUS_DRAFT, UserCapability::STATUS_PENDING_VERIFICATION])
            ->update(['current_step' => $step, 'updated_at' => time()]);
        if ($updated === 0 && ! (new UserCapability)->hasActive($userId, UserCapability::ASSISTANT)) {
            throw new RuntimeException('Percorso Pet Assistant non disponibile.');
        }

        return $this->state($userId);
    }

    public function activate(int $userId): array
    {
        DB::transaction(function () use ($userId): void {
            $capability = DB::table('user_capabilities')
                ->where('user_id', $userId)
                ->where('capability', UserCapability::ASSISTANT)
                ->lockForUpdate()
                ->first();
            if ($capability && (string) $capability->status === UserCapability::STATUS_ACTIVE) {
                return;
            }

            $state = $this->state($userId);
            if (! ($state['canActivate'] ?? false)) {
                $missing = implode(' e ', $state['missingRequiredFields'] ?? []);
                throw new RuntimeException(sprintf(
                    'Completa e salva %s nella sezione Dati personali prima di pubblicare il profilo.',
                    $missing !== '' ? $missing : 'i campi obbligatori'
                ));
            }

            $now = time();
            $updated = DB::table('user_capabilities')
                ->where('user_id', $userId)
                ->where('capability', UserCapability::ASSISTANT)
                ->whereIn('status', [UserCapability::STATUS_DRAFT, UserCapability::STATUS_PENDING_VERIFICATION])
                ->update([
                    'status' => UserCapability::STATUS_ACTIVE,
                    'current_step' => 'complete',
                    'completed_at' => $now,
                    'activated_at' => $now,
                    'suspended_at' => 0,
                    'disabled_at' => 0,
                    'updated_at' => $now,
                ]);
            if ($updated !== 1) {
                throw new RuntimeException('Attivazione del profilo non completata.');
            }
        });

        return $this->state($userId);
    }

    public function state(int $userId): array
    {
        $capability = Schema::hasTable('user_capabilities')
            ? DB::table('user_capabilities')
                ->where('user_id', $userId)
                ->where('capability', UserCapability::ASSISTANT)
                ->first()
            : null;
        $checks = $this->checks($userId);
        $requiredPersonalFields = $this->requiredPersonalFields($userId);
        $completed = count(array_filter($checks, static fn (array $check): bool => $check['complete']));
        $total = count($checks);
        $status = (string) ($capability->status ?? 'not_started');
        $missingRequiredFields = array_values(array_map(
            static fn (array $field): string => $field['label'],
            array_filter($requiredPersonalFields, static fn (array $field): bool => ! $field['complete'])
        ));

        return [
            'started' => $capability !== null,
            'status' => $status,
            'currentStep' => (string) ($capability->current_step ?? 'personal'),
            'onboardingVersion' => (int) ($capability->onboarding_version ?? self::VERSION),
            'checks' => array_values($checks),
            'requiredPersonalFields' => array_values($requiredPersonalFields),
            'missingRequiredFields' => $missingRequiredFields,
            'completionPercentage' => $total > 0 ? (int) floor(($completed / $total) * 100) : 0,
            'canActivate' => $capability !== null
                && in_array($status, [UserCapability::STATUS_DRAFT, UserCapability::STATUS_PENDING_VERIFICATION], true)
                && $missingRequiredFields === [],
            'isActive' => $status === UserCapability::STATUS_ACTIVE,
        ];
    }

    private function requiredPersonalFields(int $userId): array
    {
        $user = DB::table('users')->select(['name'])->where('id', $userId)->first();
        $assistantProfile = Schema::hasTable('assistant_profile')
            ? DB::table('assistant_profile')->select(['city'])->where('user_id', $userId)->first()
            : null;

        return [
            ['key' => 'alias', 'label' => 'Alias', 'complete' => trim((string) ($user->name ?? '')) !== ''],
            ['key' => 'city', 'label' => 'Città', 'complete' => trim((string) ($assistantProfile->city ?? '')) !== ''],
        ];
    }

    private function checks(int $userId): array
    {
        $user = DB::table('users')->select(['email_verified'])->where('id', $userId)->first();
        $account = Schema::hasTable('account_profile')
            ? DB::table('account_profile')->where('user_id', $userId)->first()
            : null;
        $area = Schema::hasTable('assistant_profile')
            ? DB::table('assistant_profile')->where('user_id', $userId)->first()
            : null;
        $operator = Schema::hasTable('operatordata')
            ? DB::table('operatordata')->where('user_id', $userId)->first()
            : null;

        $identityComplete = $account
            && trim((string) $account->name) !== ''
            && trim((string) $account->phone) !== '';
        $areaComplete = $area
            && trim((string) $area->city) !== ''
            && trim((string) $area->address) !== ''
            && (float) $area->location_lat !== 0.0
            && (float) $area->location_lng !== 0.0;
        $operatorType = (string) ($operator->operator_type ?? 'person');
        $fiscalComplete = $operator && ($operatorType === 'association'
            ? trim((string) $operator->business_name) !== '' && trim((string) $operator->vat_number) !== ''
            : trim((string) $operator->fiscal_code) !== '');
        $professionalComplete = $operator
            && trim((string) $operator->bio) !== ''
            && $this->exists('operatortitledata', $userId)
            && $this->exists('pettypedata', $userId);
        $servicesComplete = Schema::hasTable('operatorservicedata')
            && DB::table('operatorservicedata')->where('user_id', $userId)->where('hour_price', '>', 0)->exists();
        $galleryRequired = false;
        if ($servicesComplete && Schema::hasTable('service')) {
            $galleryRequired = DB::table('operatorservicedata as selected')
                ->join('service as service', 'service.id', '=', 'selected.service_id')
                ->where('selected.user_id', $userId)
                ->where('selected.home_photo_enabled', 1)
                ->where('service.requires_home_photo', 1)
                ->exists();
        }
        $galleryComplete = ! $galleryRequired || $this->exists('operatorgallery', $userId);
        $calendarComplete = false;
        if (Schema::hasTable('calendar_day') && Schema::hasTable('calendar_day_slot')) {
            $calendarComplete = DB::table('calendar_day as day')
                ->join('calendar_day_slot as slot', 'slot.calendar_day_id', '=', 'day.id')
                ->where('day.user_id', $userId)
                ->where('day.enabled', 1)
                ->where('slot.enabled', 1)
                ->where('day.date', '>=', date('Y-m-d'))
                ->exists();
        }

        return [
            ['key' => 'identity', 'label' => 'Identità e recapiti', 'section' => 'personal', 'complete' => (bool) $identityComplete],
            ['key' => 'area', 'label' => 'Area operativa geolocalizzata', 'section' => 'personal', 'complete' => (bool) $areaComplete],
            ['key' => 'fiscal', 'label' => 'Identità fiscale', 'section' => 'operator', 'complete' => (bool) $fiscalComplete],
            ['key' => 'professional', 'label' => 'Esperienza e animali assistiti', 'section' => 'operator', 'complete' => (bool) $professionalComplete],
            ['key' => 'services', 'label' => 'Almeno un servizio con tariffa', 'section' => 'operator', 'complete' => $servicesComplete],
            ['key' => 'gallery', 'label' => 'Foto della struttura quando richiesta', 'section' => 'operator', 'complete' => $galleryComplete],
            ['key' => 'calendar', 'label' => 'Almeno una disponibilità futura', 'section' => 'calendar', 'complete' => $calendarComplete],
            ['key' => 'verification', 'label' => 'Email verificata', 'section' => 'review', 'complete' => (bool) ($user->email_verified ?? false)],
        ];
    }

    private function exists(string $table, int $userId): bool
    {
        return Schema::hasTable($table) && DB::table($table)->where('user_id', $userId)->exists();
    }
}
