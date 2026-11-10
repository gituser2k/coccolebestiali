<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;
use RuntimeException;

final class ProfileReputation
{
    public const OWNER = 'owner';

    public const ASSISTANT = 'assistant';

    public function score(int $userId, string $capability): int
    {
        $this->assertCapability($capability);

        if (Schema::hasTable('profile_reputation')) {
            $row = DB::table('profile_reputation')
                ->where('user_id', $userId)
                ->where('capability', $capability)
                ->first(['score']);
            if ($row) {
                return (int) $row->score;
            }
        }

        if (Schema::hasTable('user_reputation')) {
            $legacy = DB::table('user_reputation')->where('user_id', $userId)->value('score');
            $legacyRole = (string) DB::table('users')->where('id', $userId)->value('role');
            if ($legacy !== null && $this->legacyRoleMatches($legacyRole, $capability)) {
                return (int) $legacy;
            }
        }

        return PortalPolicy::value('initial_reputation_score');
    }

    public function initializeForLegacyRole(int $userId, string $legacyRole, int $timestamp): void
    {
        $initialScore = PortalPolicy::value('initial_reputation_score');

        if (Schema::hasTable('user_reputation')) {
            DB::table('user_reputation')->insertOrIgnore([
                'user_id' => $userId,
                'score' => $initialScore,
                'updated_at' => $timestamp,
            ]);
        }
        if (! Schema::hasTable('profile_reputation')) {
            return;
        }

        $this->insertIfMissing($userId, self::OWNER, $initialScore, $timestamp);
        if ($legacyRole === 'pet_assistant') {
            $this->insertIfMissing($userId, self::ASSISTANT, $initialScore, $timestamp);
        }
    }

    public function applyDelta(
        int $userId,
        string $capability,
        int $bookingId,
        int $actorUserId,
        string $type,
        int $delta,
        string $note
    ): int {
        $this->assertCapability($capability);
        $timestamp = time();
        $initialScore = PortalPolicy::value('initial_reputation_score');
        $legacyRole = (string) DB::table('users')->where('id', $userId)->value('role');

        if (Schema::hasTable('profile_reputation')) {
            $this->insertIfMissing($userId, $capability, $initialScore, $timestamp);
            $row = DB::table('profile_reputation')
                ->where('user_id', $userId)
                ->where('capability', $capability)
                ->lockForUpdate()
                ->first(['score']);
            $score = $this->boundedScore((int) $row->score, $delta);
            DB::table('profile_reputation')
                ->where('user_id', $userId)
                ->where('capability', $capability)
                ->update(['score' => $score, 'updated_at' => $timestamp]);

            if ($this->legacyRoleMatches($legacyRole, $capability)) {
                $this->writeLegacyScore($userId, $score, $timestamp, $initialScore);
            }
        } else {
            if (! $this->legacyRoleMatches($legacyRole, $capability)) {
                throw new RuntimeException('CONTEXTUAL_REPUTATION_SCHEMA_REQUIRED');
            }
            $legacyScore = $this->score($userId, $capability);
            $score = $this->boundedScore($legacyScore, $delta);
            $this->writeLegacyScore($userId, $score, $timestamp, $initialScore);
        }

        $event = [
            'user_id' => $userId,
            'booking_id' => $bookingId,
            'actor_user_id' => $actorUserId,
            'event_type' => $type,
            'delta' => $delta,
            'score_after' => $score,
            'note' => mb_substr(trim($note), 0, 2048),
            'created_at' => $timestamp,
        ];
        if (Schema::hasColumn('reputation_event', 'subject_capability')) {
            $event['subject_capability'] = $capability;
        }
        DB::table('reputation_event')->insert($event);

        return $score;
    }

    private function insertIfMissing(int $userId, string $capability, int $score, int $timestamp): void
    {
        DB::table('profile_reputation')->insertOrIgnore([
            'user_id' => $userId,
            'capability' => $capability,
            'score' => $score,
            'updated_at' => $timestamp,
        ]);
    }

    private function writeLegacyScore(int $userId, int $score, int $timestamp, int $initialScore): void
    {
        if (! Schema::hasTable('user_reputation')) {
            return;
        }
        DB::table('user_reputation')->insertOrIgnore([
            'user_id' => $userId,
            'score' => $initialScore,
            'updated_at' => $timestamp,
        ]);
        DB::table('user_reputation')->where('user_id', $userId)->update([
            'score' => $score,
            'updated_at' => $timestamp,
        ]);
    }

    private function boundedScore(int $current, int $delta): int
    {
        return max(0, min(100, $current + $delta));
    }

    private function legacyRoleMatches(string $legacyRole, string $capability): bool
    {
        return ($legacyRole === 'pet_owner' && $capability === self::OWNER)
            || ($legacyRole === 'pet_assistant' && $capability === self::ASSISTANT);
    }

    private function assertCapability(string $capability): void
    {
        if (! in_array($capability, [self::OWNER, self::ASSISTANT], true)) {
            throw new InvalidArgumentException('Invalid reputation capability.');
        }
    }
}
