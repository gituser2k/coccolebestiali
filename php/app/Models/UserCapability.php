<?php

namespace App\Models;

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
