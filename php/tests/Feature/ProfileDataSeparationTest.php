<?php

namespace Tests\Feature;

use App\Models\ProfileData;
use App\Support\PortalSession;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProfileDataSeparationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropAllTables();

        Schema::create('users', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('role', 32);
            $table->string('name')->default('');
            $table->string('email')->default('');
            $table->string('avatar', 1024)->default('');
            $table->integer('created_at')->default(0);
            $table->integer('updated_at')->default(0);
        });
        Schema::create('personaldata', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id')->unique();
            $table->string('name')->default('');
            $table->string('photo', 1024)->default('');
            $table->unsignedInteger('age')->default(0);
            $table->string('city')->default('');
            $table->string('phone')->default('');
            $table->string('address')->default('');
            $table->string('addressnumber', 32)->default('');
            $table->decimal('location_lat', 10, 7)->default(0);
            $table->decimal('location_lng', 10, 7)->default(0);
            $table->unsignedInteger('service_radius_km')->default(5);
            $table->integer('created_at')->default(0);
            $table->integer('updated_at')->default(0);
        });
        Schema::create('account_profile', function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
            $table->string('name')->default('');
            $table->string('photo', 1024)->default('');
            $table->unsignedInteger('age')->default(0);
            $table->string('phone')->default('');
            $table->integer('created_at')->default(0);
            $table->integer('updated_at')->default(0);
        });
        Schema::create('owner_profile', function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
            $table->string('city')->default('');
            $table->string('address')->default('');
            $table->string('address_number', 32)->default('');
            $table->decimal('location_lat', 10, 7)->default(0);
            $table->decimal('location_lng', 10, 7)->default(0);
            $table->integer('created_at')->default(0);
            $table->integer('updated_at')->default(0);
        });
        Schema::create('assistant_profile', function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
            $table->string('city')->default('');
            $table->string('address')->default('');
            $table->string('address_number', 32)->default('');
            $table->decimal('location_lat', 10, 7)->default(0);
            $table->decimal('location_lng', 10, 7)->default(0);
            $table->unsignedInteger('service_radius_km')->default(5);
            $table->integer('created_at')->default(0);
            $table->integer('updated_at')->default(0);
        });
    }

    public function test_legacy_location_is_exposed_only_in_its_original_role_context(): void
    {
        $this->insertLegacyUser(1, 'pet_assistant', 'Milano', 45.4642, 9.1900);
        $this->insertLegacyUser(2, 'pet_owner', 'Roma', 41.9028, 12.4964);
        $profiles = new ProfileData;

        $assistant = $profiles->read(1, ProfileData::ASSISTANT);
        $assistantAsOwner = $profiles->read(1, ProfileData::OWNER);
        $owner = $profiles->read(2, ProfileData::OWNER);
        $ownerAsAssistant = $profiles->read(2, ProfileData::ASSISTANT);

        $this->assertSame('Milano', $assistant['city']);
        $this->assertSame('personaldata', $assistant['profileSources']['location']);
        $this->assertSame('', $assistantAsOwner['city']);
        $this->assertSame('empty', $assistantAsOwner['profileSources']['location']);
        $this->assertSame('Roma', $owner['city']);
        $this->assertSame('', $ownerAsAssistant['city']);
        $this->assertSame('Legacy User 1', $assistantAsOwner['name']);
        $this->assertSame('Legacy User 2', $ownerAsAssistant['name']);
    }

    public function test_saving_owner_profile_for_legacy_assistant_does_not_overwrite_operational_area(): void
    {
        $this->insertLegacyUser(10, 'pet_assistant', 'Milano', 45.4642, 9.1900);
        DB::table('account_profile')->insert($this->commonRow(10, 'Assistant Name'));
        DB::table('assistant_profile')->insert($this->locationRow(10, 'Milano', 45.4642, 9.1900, 25));

        (new ProfileData)->write(10, ProfileData::OWNER, [
            'name' => 'Shared New Name',
            'photo' => '/uploads/new.jpg',
            'age' => 36,
            'phone' => '+39 333 0000000',
            'city' => 'Torino',
            'address' => 'Via Po',
            'addressnumber' => '12',
            'locationLat' => 45.0703,
            'locationLng' => 7.6869,
        ], 2000);

        $owner = (new ProfileData)->read(10, ProfileData::OWNER);
        $assistant = (new ProfileData)->read(10, ProfileData::ASSISTANT);

        $this->assertSame('Torino', $owner['city']);
        $this->assertSame('Milano', $assistant['city']);
        $this->assertSame('Shared New Name', $owner['name']);
        $this->assertSame('Shared New Name', $assistant['name']);
        $this->assertDatabaseHas('assistant_profile', [
            'user_id' => 10,
            'city' => 'Milano',
            'service_radius_km' => 25,
        ]);
        $this->assertDatabaseHas('personaldata', [
            'user_id' => 10,
            'name' => 'Shared New Name',
            'city' => 'Milano',
            'service_radius_km' => 25,
        ]);
    }

    public function test_saving_assistant_profile_for_legacy_owner_does_not_overwrite_residence(): void
    {
        $this->insertLegacyUser(20, 'pet_owner', 'Bologna', 44.4949, 11.3426);
        DB::table('account_profile')->insert($this->commonRow(20, 'Owner Name'));
        DB::table('owner_profile')->insert($this->locationRow(20, 'Bologna', 44.4949, 11.3426));

        (new ProfileData)->write(20, ProfileData::ASSISTANT, [
            'name' => 'Shared Owner Name',
            'photo' => '/uploads/owner.jpg',
            'age' => 42,
            'phone' => '+39 333 1111111',
            'city' => 'Firenze',
            'address' => 'Via Roma',
            'addressnumber' => '8',
            'locationLat' => 43.7696,
            'locationLng' => 11.2558,
            'serviceRadiusKm' => 40,
        ], 3000);

        $profiles = new ProfileData;
        $this->assertSame('Bologna', $profiles->read(20, ProfileData::OWNER)['city']);
        $this->assertSame('Firenze', $profiles->read(20, ProfileData::ASSISTANT)['city']);
        $this->assertSame([44.4949, 11.3426], $profiles->ownerLocation(20));
        $this->assertDatabaseHas('personaldata', [
            'user_id' => 20,
            'city' => 'Bologna',
        ]);
    }

    public function test_common_photo_is_synchronized_without_touching_either_location(): void
    {
        $this->insertLegacyUser(30, 'pet_assistant', 'Napoli', 40.8518, 14.2681);
        DB::table('account_profile')->insert($this->commonRow(30, 'Shared'));
        DB::table('owner_profile')->insert($this->locationRow(30, 'Caserta', 41.0747, 14.3323));
        DB::table('assistant_profile')->insert($this->locationRow(30, 'Napoli', 40.8518, 14.2681, 30));

        (new ProfileData)->syncCommonPhoto(30, '/uploads/shared.jpg', 4000);

        $this->assertDatabaseHas('account_profile', ['user_id' => 30, 'photo' => '/uploads/shared.jpg']);
        $this->assertDatabaseHas('personaldata', ['user_id' => 30, 'photo' => '/uploads/shared.jpg', 'city' => 'Napoli']);
        $this->assertDatabaseHas('owner_profile', ['user_id' => 30, 'city' => 'Caserta']);
        $this->assertDatabaseHas('assistant_profile', ['user_id' => 30, 'city' => 'Napoli']);
    }

    public function test_owner_profile_endpoint_persists_the_geocoded_residence(): void
    {
        $this->insertLegacyUser(40, 'pet_owner', 'Roma', 41.9028, 12.4964);
        DB::table('account_profile')->insert($this->commonRow(40, 'Owner'));
        DB::table('owner_profile')->insert($this->locationRow(40, 'Roma', 41.9028, 12.4964));

        $this->withoutMiddleware(ValidateCsrfToken::class)
            ->withSession([PortalSession::USER_ID_KEY => 40])
            ->post('/api/profile/petowner/personal', [
                'alias' => 'owner-40',
                'email' => 'owner40@example.test',
                'name' => 'Owner Updated',
                'age' => 40,
                'city' => 'Torino',
                'phone' => '+39 333 4000000',
                'address' => 'Via Po',
                'addressnumber' => '20',
                'locationLat' => 45.0703,
                'locationLng' => 7.6869,
            ])
            ->assertOk()
            ->assertJsonPath('data.city', 'Torino')
            ->assertJsonPath('data.locationLat', 45.0703)
            ->assertJsonPath('data.locationLng', 7.6869)
            ->assertJsonPath('data.profileSources.location', 'owner_profile');

        $this->assertDatabaseHas('owner_profile', [
            'user_id' => 40,
            'city' => 'Torino',
            'location_lat' => 45.0703,
            'location_lng' => 7.6869,
        ]);
        $this->assertDatabaseHas('personaldata', [
            'user_id' => 40,
            'city' => 'Torino',
            'location_lat' => 45.0703,
            'location_lng' => 7.6869,
        ]);
    }

    private function insertLegacyUser(int $id, string $role, string $city, float $lat, float $lng): void
    {
        DB::table('users')->insert([
            'id' => $id,
            'role' => $role,
            'name' => 'alias-'.$id,
            'email' => 'user'.$id.'@example.test',
            'avatar' => '',
        ]);
        DB::table('personaldata')->insert([
            'user_id' => $id,
            'name' => 'Legacy User '.$id,
            'photo' => '/uploads/legacy-'.$id.'.jpg',
            'age' => 30,
            'city' => $city,
            'phone' => '+39 333 1234567',
            'address' => 'Via Legacy',
            'addressnumber' => '1',
            'location_lat' => $lat,
            'location_lng' => $lng,
            'service_radius_km' => 25,
            'created_at' => 1000,
            'updated_at' => 1000,
        ]);
    }

    private function commonRow(int $userId, string $name): array
    {
        return [
            'user_id' => $userId,
            'name' => $name,
            'photo' => '/uploads/common.jpg',
            'age' => 35,
            'phone' => '+39 333 9999999',
            'created_at' => 1000,
            'updated_at' => 1000,
        ];
    }

    private function locationRow(int $userId, string $city, float $lat, float $lng, ?int $radius = null): array
    {
        $row = [
            'user_id' => $userId,
            'city' => $city,
            'address' => 'Via Test',
            'address_number' => '10',
            'location_lat' => $lat,
            'location_lng' => $lng,
            'created_at' => 1000,
            'updated_at' => 1000,
        ];
        if ($radius !== null) {
            $row['service_radius_km'] = $radius;
        }

        return $row;
    }
}
