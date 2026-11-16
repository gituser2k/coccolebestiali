<?php

namespace App\Models;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
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

    public function provisionOwner(int $userId, ?int $timestamp = null): void
    {
        if ($userId <= 0) {
            throw new InvalidArgumentException('Invalid user id.');
        }

        $now = $timestamp ?? time();
        $this->insertActive($userId, self::OWNER, $now);
    }

    /** Read the authoritative capability model. Missing rows grant no access. */
    public function resolveForUser(int $userId): array
    {
        if ($userId <= 0) {
            throw new InvalidArgumentException('Invalid user id.');
        }

        $rows = DB::table('user_capabilities')
            ->where('user_id', $userId)
            ->orderByRaw("CASE capability WHEN 'owner' THEN 1 WHEN 'assistant' THEN 2 ELSE 3 END")
            ->get();

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
        $defaultMode = in_array(self::OWNER, $active, true) ? self::OWNER : ($active[0] ?? '');

        return [
            'items' => $items,
            'active' => $active,
            'modes' => [
                'available' => $active,
                'default' => $defaultMode,
            ],
            'source' => 'user_capabilities',
        ];
    }

    public function hasActive(int $userId, string $capability): bool
    {
        $this->assertCapability($capability);
        if ($userId <= 0) {
            return false;
        }

        return DB::table('user_capabilities')
            ->where('user_id', $userId)
            ->where('capability', $capability)
            ->where('status', self::STATUS_ACTIVE)
            ->exists();
    }

    public function activeForUser(int $userId): array
    {
        if ($userId <= 0) {
            return [];
        }
        return $this->resolveForUser($userId)['active'];
    }

    public function hasAssistantProfileAccess(int $userId): bool
    {
        if ($userId <= 0) {
            return false;
        }

        return DB::table('user_capabilities')
            ->where('user_id', $userId)
            ->where('capability', self::ASSISTANT)
            ->whereIn('status', [self::STATUS_DRAFT, self::STATUS_PENDING_VERIFICATION, self::STATUS_ACTIVE])
            ->exists();
    }

    /** Restrict a user-based query to an active capability. */
    public function scopeActive(
        Builder $query,
        string $userAlias,
        string $capability,
        string $capabilityAlias
    ): Builder {
        $this->assertCapability($capability);
        $this->assertAlias($userAlias);
        $this->assertAlias($capabilityAlias);
        $query->join('user_capabilities as '.$capabilityAlias, function ($join) use ($userAlias, $capabilityAlias, $capability) {
            $join->on($capabilityAlias.'.user_id', '=', $userAlias.'.id')
                ->where($capabilityAlias.'.capability', $capability)
                ->where($capabilityAlias.'.status', self::STATUS_ACTIVE);
        });

        return $query;
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
