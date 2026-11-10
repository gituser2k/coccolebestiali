<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;

final class UserCapability
{
    public const OWNER = 'owner';

    public const ASSISTANT = 'assistant';

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PENDING_VERIFICATION = 'pending_verification';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_SUSPENDED = 'suspended';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_DISABLED = 'disabled';

    /**
     * Preserve legacy access while dual-writing the additive capability model.
     * Existing rows are never overwritten, so a suspended or disabled profile
     * cannot be accidentally reactivated by login or account maintenance.
     */
    public function provisionForLegacyRole(int $userId, string $legacyRole, ?int $timestamp = null): void
    {
        if ($userId <= 0) {
            throw new InvalidArgumentException('Invalid user id.');
        }

        if (! in_array($legacyRole, ['pet_owner', 'pet_assistant'], true)) {
            throw new InvalidArgumentException('Invalid legacy role.');
        }

        $now = $timestamp ?? time();
        $this->insertActive($userId, self::OWNER, $now);

        if ($legacyRole === 'pet_assistant') {
            $this->insertActive($userId, self::ASSISTANT, $now);
        }
    }

    /**
     * Read the additive model and fall back to the legacy role while mixed
     * deployments or accounts without a completed backfill still exist.
     */
    public function resolveForUser(int $userId, string $legacyRole): array
    {
        if ($userId <= 0) {
            throw new InvalidArgumentException('Invalid user id.');
        }

        $rows = Schema::hasTable('user_capabilities')
            ? DB::table('user_capabilities')
                ->where('user_id', $userId)
                ->orderByRaw("CASE capability WHEN 'owner' THEN 1 WHEN 'assistant' THEN 2 ELSE 3 END")
                ->get()
            : collect();
        $source = $rows->isEmpty() ? 'legacy_fallback' : 'user_capabilities';

        if ($rows->isEmpty()) {
            $rows = collect($this->legacyFallbackRows($legacyRole));
        }

        $items = $rows->map(static fn ($row): array => [
            'capability' => (string) $row->capability,
            'status' => (string) $row->status,
            'onboardingVersion' => (int) $row->onboarding_version,
            'currentStep' => (string) $row->current_step,
            'completedAt' => (int) $row->completed_at,
            'activatedAt' => (int) $row->activated_at,
            'suspendedAt' => (int) $row->suspended_at,
            'disabledAt' => (int) $row->disabled_at,
        ])->values()->all();

        $active = array_values(array_map(
            static fn (array $item): string => $item['capability'],
            array_filter($items, static fn (array $item): bool => $item['status'] === self::STATUS_ACTIVE)
        ));
        $preferred = $legacyRole === 'pet_assistant' ? self::ASSISTANT : self::OWNER;
        $defaultMode = in_array($preferred, $active, true)
            ? $preferred
            : (in_array(self::OWNER, $active, true) ? self::OWNER : ($active[0] ?? ''));

        return [
            'items' => $items,
            'active' => $active,
            'modes' => [
                'available' => $active,
                'default' => $defaultMode,
            ],
            'source' => $source,
        ];
    }

    private function legacyFallbackRows(string $legacyRole): array
    {
        if (! in_array($legacyRole, ['pet_owner', 'pet_assistant'], true)) {
            return [];
        }

        $row = static fn (string $capability): object => (object) [
            'capability' => $capability,
            'status' => self::STATUS_ACTIVE,
            'onboarding_version' => 1,
            'current_step' => 'complete',
            'completed_at' => 0,
            'activated_at' => 0,
            'suspended_at' => 0,
            'disabled_at' => 0,
        ];

        return $legacyRole === 'pet_assistant'
            ? [$row(self::OWNER), $row(self::ASSISTANT)]
            : [$row(self::OWNER)];
    }

    private function insertActive(int $userId, string $capability, int $timestamp): void
    {
        DB::table('user_capabilities')->insertOrIgnore([
            'user_id' => $userId,
            'capability' => $capability,
            'status' => self::STATUS_ACTIVE,
            'onboarding_version' => 1,
            'current_step' => 'complete',
            'completed_at' => $timestamp,
            'activated_at' => $timestamp,
            'suspended_at' => 0,
            'disabled_at' => 0,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }
}
