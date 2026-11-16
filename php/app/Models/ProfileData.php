<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class ProfileData
{
    public const OWNER = 'owner';

    public const ASSISTANT = 'assistant';

    public function read(int $userId, string $context): array
    {
        $this->assertContext($context);
        $user = DB::table('users')
            ->where('id', $userId)
            ->first(['id', 'name', 'email', 'avatar']);

        if (! $user) {
            return [];
        }

        $account = DB::table('account_profile')->where('user_id', $userId)->first();
        $contextTable = $this->contextTable($context);
        $location = DB::table($contextTable)->where('user_id', $userId)->first();

        return [
            'alias' => (string) ($user->name ?? ''),
            'email' => (string) ($user->email ?? ''),
            'avatar' => (string) ($user->avatar ?? ''),
            'name' => (string) ($account?->name ?? ''),
            'photo' => (string) ($account?->photo ?? ''),
            'age' => (int) ($account?->age ?? 0),
            'phone' => (string) ($account?->phone ?? ''),
            'city' => (string) ($location?->city ?? ''),
            'address' => (string) ($location?->address ?? ''),
            'addressnumber' => (string) ($location?->address_number ?? ''),
            'locationLat' => (float) ($location?->location_lat ?? 0),
            'locationLng' => (float) ($location?->location_lng ?? 0),
            'serviceRadiusKm' => $context === self::ASSISTANT
                ? max(1, (int) ($location?->service_radius_km ?? 5))
                : 5,
            'profileSources' => [
                'common' => $account !== null ? 'account_profile' : 'empty',
                'location' => $location !== null ? $contextTable : 'empty',
            ],
        ];
    }

    public function write(int $userId, string $context, array $payload, int $timestamp): void
    {
        $this->assertContext($context);
        $common = [
            'user_id' => $userId,
            'name' => (string) ($payload['name'] ?? ''),
            'photo' => (string) ($payload['photo'] ?? ''),
            'age' => (int) ($payload['age'] ?? 0),
            'phone' => (string) ($payload['phone'] ?? ''),
            'updated_at' => $timestamp,
        ];
        $location = [
            'user_id' => $userId,
            'city' => (string) ($payload['city'] ?? ''),
            'address' => (string) ($payload['address'] ?? ''),
            'address_number' => (string) ($payload['addressnumber'] ?? ''),
            'location_lat' => (float) ($payload['locationLat'] ?? 0),
            'location_lng' => (float) ($payload['locationLng'] ?? 0),
            'updated_at' => $timestamp,
        ];
        if ($context === self::ASSISTANT) {
            $location['service_radius_km'] = max(1, (int) ($payload['serviceRadiusKm'] ?? 5));
        }

        $this->upsert('account_profile', $userId, $common, $timestamp);
        $contextTable = $this->contextTable($context);
        $this->upsert($contextTable, $userId, $location, $timestamp);
    }

    public function syncCommonPhoto(int $userId, string $photo, int $timestamp): void
    {
        $data = [
            'user_id' => $userId,
            'photo' => $photo,
            'updated_at' => $timestamp,
        ];

        $this->upsert('account_profile', $userId, $data, $timestamp);
    }

    public function ownerLocation(int $userId): ?array
    {
        $profile = $this->read($userId, self::OWNER);
        $latitude = (float) ($profile['locationLat'] ?? 0);
        $longitude = (float) ($profile['locationLng'] ?? 0);

        if ($latitude === 0.0 || $longitude === 0.0) {
            return null;
        }

        return [$latitude, $longitude];
    }

    private function upsert(string $table, int $userId, array $data, int $timestamp): void
    {
        if (DB::table($table)->where('user_id', $userId)->exists()) {
            DB::table($table)->where('user_id', $userId)->update($data);

            return;
        }

        $data['created_at'] = $timestamp;
        DB::table($table)->insert($data);
    }

    private function contextTable(string $context): string
    {
        return $context === self::OWNER ? 'owner_profile' : 'assistant_profile';
    }

    private function assertContext(string $context): void
    {
        if (! in_array($context, [self::OWNER, self::ASSISTANT], true)) {
            throw new InvalidArgumentException('Invalid profile context.');
        }
    }
}
