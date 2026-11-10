<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
            ->first(['id', 'role', 'name', 'email', 'avatar']);

        if (! $user) {
            return [];
        }

        $legacy = Schema::hasTable('personaldata')
            ? DB::table('personaldata')->where('user_id', $userId)->first()
            : null;
        $account = Schema::hasTable('account_profile')
            ? DB::table('account_profile')->where('user_id', $userId)->first()
            : null;
        $contextTable = $this->contextTable($context);
        $location = Schema::hasTable($contextTable)
            ? DB::table($contextTable)->where('user_id', $userId)->first()
            : null;
        $legacyLocation = $location === null && $this->legacyRoleMatches((string) $user->role, $context)
            ? $legacy
            : null;

        return [
            'alias' => (string) ($user->name ?? ''),
            'email' => (string) ($user->email ?? ''),
            'avatar' => (string) ($user->avatar ?? ''),
            'name' => (string) ($account?->name ?? $legacy?->name ?? ''),
            'photo' => (string) ($account?->photo ?? $legacy?->photo ?? ''),
            'age' => (int) ($account?->age ?? $legacy?->age ?? 0),
            'phone' => (string) ($account?->phone ?? $legacy?->phone ?? ''),
            'city' => (string) ($location?->city ?? $legacyLocation?->city ?? ''),
            'address' => (string) ($location?->address ?? $legacyLocation?->address ?? ''),
            'addressnumber' => (string) ($location?->address_number ?? $legacyLocation?->addressnumber ?? ''),
            'locationLat' => (float) ($location?->location_lat ?? $legacyLocation?->location_lat ?? 0),
            'locationLng' => (float) ($location?->location_lng ?? $legacyLocation?->location_lng ?? 0),
            'serviceRadiusKm' => $context === self::ASSISTANT
                ? max(1, (int) ($location?->service_radius_km ?? $legacyLocation?->service_radius_km ?? 5))
                : 5,
            'profileSources' => [
                'common' => $account !== null ? 'account_profile' : ($legacy !== null ? 'personaldata' : 'empty'),
                'location' => $location !== null ? $contextTable : ($legacyLocation !== null ? 'personaldata' : 'empty'),
            ],
        ];
    }

    public function write(int $userId, string $context, array $payload, int $timestamp): void
    {
        $this->assertContext($context);
        $legacyRole = (string) DB::table('users')->where('id', $userId)->value('role');
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

        if (Schema::hasTable('account_profile')) {
            $this->upsert('account_profile', $userId, $common, $timestamp);
        }
        $contextTable = $this->contextTable($context);
        if (Schema::hasTable($contextTable)) {
            $this->upsert($contextTable, $userId, $location, $timestamp);
        }

        if (! Schema::hasTable('personaldata')) {
            return;
        }

        $legacy = [
            'user_id' => $userId,
            'name' => $common['name'],
            'photo' => $common['photo'],
            'age' => $common['age'],
            'phone' => $common['phone'],
            'updated_at' => $timestamp,
        ];
        if ($this->legacyRoleMatches($legacyRole, $context)) {
            $legacy += [
                'city' => $location['city'],
                'address' => $location['address'],
                'addressnumber' => $location['address_number'],
                'location_lat' => $location['location_lat'],
                'location_lng' => $location['location_lng'],
            ];
            if ($context === self::ASSISTANT) {
                $legacy['service_radius_km'] = $location['service_radius_km'];
            }
        }
        $this->upsert('personaldata', $userId, $legacy, $timestamp);
    }

    public function syncCommonPhoto(int $userId, string $photo, int $timestamp): void
    {
        $data = [
            'user_id' => $userId,
            'photo' => $photo,
            'updated_at' => $timestamp,
        ];

        if (Schema::hasTable('account_profile')) {
            $this->upsert('account_profile', $userId, $data, $timestamp);
        }
        if (Schema::hasTable('personaldata')) {
            $this->upsert('personaldata', $userId, $data, $timestamp);
        }
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

    private function legacyRoleMatches(string $legacyRole, string $context): bool
    {
        return ($context === self::OWNER && $legacyRole === 'pet_owner')
            || ($context === self::ASSISTANT && $legacyRole === 'pet_assistant');
    }

    private function assertContext(string $context): void
    {
        if (! in_array($context, [self::OWNER, self::ASSISTANT], true)) {
            throw new InvalidArgumentException('Invalid profile context.');
        }
    }
}
