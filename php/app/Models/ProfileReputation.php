<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class ProfileReputation
{
    public const OWNER = 'owner';

    public const ASSISTANT = 'assistant';

    public function score(int $userId, string $capability): int
    {
        $this->assertCapability($capability);

        $row = DB::table('profile_reputation')
            ->where('user_id', $userId)
            ->where('capability', $capability)
            ->first(['score']);
        if ($row) {
            return (int) $row->score;
        }

        return PortalPolicy::value('initial_reputation_score');
    }

    public function initialize(int $userId, string $capability, int $timestamp): void
    {
        $this->assertCapability($capability);
        $initialScore = PortalPolicy::value('initial_reputation_score');
        $this->insertIfMissing($userId, $capability, $initialScore, $timestamp);
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
        $event['subject_capability'] = $capability;
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

    private function boundedScore(int $current, int $delta): int
    {
        return max(0, min(100, $current + $delta));
    }

    private function assertCapability(string $capability): void
    {
        if (! in_array($capability, [self::OWNER, self::ASSISTANT], true)) {
            throw new InvalidArgumentException('Invalid reputation capability.');
        }
    }
}
