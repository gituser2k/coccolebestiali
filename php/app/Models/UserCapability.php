<?php

namespace App\Models;

use Illuminate\Database\Query\Builder;
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

    public function hasActive(int $userId, string $capability, ?string $legacyRole = null): bool
    {
        $this->assertCapability($capability);
        if ($userId <= 0) {
            return false;
        }

        $legacyRole ??= (string) DB::table('users')->where('id', $userId)->value('role');
        if (Schema::hasTable('user_capabilities')) {
            $rows = DB::table('user_capabilities')->where('user_id', $userId);
            if ((clone $rows)->exists()) {
                return (clone $rows)
                    ->where('capability', $capability)
                    ->where('status', self::STATUS_ACTIVE)
                    ->exists();
            }
        }

        return $this->legacyRoleGrants($legacyRole, $capability);
    }

    public function activeForUser(int $userId, ?string $legacyRole = null): array
    {
        if ($userId <= 0) {
            return [];
        }
        $legacyRole ??= (string) DB::table('users')->where('id', $userId)->value('role');

        return $this->resolveForUser($userId, $legacyRole)['active'];
    }

    public function hasAssistantProfileAccess(int $userId, ?string $legacyRole = null): bool
    {
        if ($userId <= 0) {
            return false;
        }

        $legacyRole ??= (string) DB::table('users')->where('id', $userId)->value('role');
        if (Schema::hasTable('user_capabilities')) {
            $rows = DB::table('user_capabilities')->where('user_id', $userId);
            if ((clone $rows)->exists()) {
                return (clone $rows)
                    ->where('capability', self::ASSISTANT)
                    ->whereIn('status', [self::STATUS_DRAFT, self::STATUS_PENDING_VERIFICATION, self::STATUS_ACTIVE])
                    ->exists();
            }
        }

        return $legacyRole === 'pet_assistant';
    }

    /**
     * Restrict a user-based query to an active capability. Accounts without
     * any backfilled row retain the legacy fallback; partial or inactive
     * capability state is always authoritative and fails closed.
     */
    public function scopeActive(
        Builder $query,
        string $userAlias,
        string $capability,
        string $capabilityAlias
    ): Builder {
        $this->assertCapability($capability);
        $this->assertAlias($userAlias);
        $this->assertAlias($capabilityAlias);
        $legacyRoles = $capability === self::ASSISTANT
            ? ['pet_assistant']
            : ['pet_owner', 'pet_assistant'];

        if (! Schema::hasTable('user_capabilities')) {
            return $query->whereIn($userAlias.'.role', $legacyRoles);
        }

        $allAlias = $capabilityAlias.'_all';
        $query->leftJoin('user_capabilities as '.$capabilityAlias, function ($join) use ($userAlias, $capabilityAlias, $capability) {
            $join->on($capabilityAlias.'.user_id', '=', $userAlias.'.id')
                ->where($capabilityAlias.'.capability', $capability);
        });

        return $query->where(function ($where) use ($userAlias, $capabilityAlias, $allAlias, $legacyRoles) {
            $where->where($capabilityAlias.'.status', self::STATUS_ACTIVE)
                ->orWhere(function ($fallback) use ($userAlias, $capabilityAlias, $allAlias, $legacyRoles) {
                    $fallback->whereNull($capabilityAlias.'.user_id')
                        ->whereIn($userAlias.'.role', $legacyRoles)
                        ->whereNotExists(function ($subquery) use ($userAlias, $allAlias) {
                            $subquery->selectRaw('1')
                                ->from('user_capabilities as '.$allAlias)
                                ->whereColumn($allAlias.'.user_id', $userAlias.'.id');
                        });
                });
        });
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

    private function legacyRoleGrants(string $legacyRole, string $capability): bool
    {
        return $capability === self::OWNER
            ? in_array($legacyRole, ['pet_owner', 'pet_assistant'], true)
            : $legacyRole === 'pet_assistant';
    }

    private function assertCapability(string $capability): void
    {
        if (! in_array($capability, [self::OWNER, self::ASSISTANT], true)) {
            throw new InvalidArgumentException('Invalid capability.');
        }
    }

    private function assertAlias(string $alias): void
    {
        if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $alias) !== 1) {
            throw new InvalidArgumentException('Invalid query alias.');
        }
    }
}
