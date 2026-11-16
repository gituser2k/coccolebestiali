<?php

namespace Tests\Feature;

use App\Models\PublicPetAssistant;
use App\Models\UserCapability;
use App\Support\PortalSession;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class CapabilityDiscoveryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropAllTables();
        Schema::create('users', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('role', 32);
            $table->string('name')->default('');
            $table->string('avatar', 1024)->default('');
        });
        Schema::create('user_capabilities', function (Blueprint $table): void {
            $table->unsignedInteger('user_id');
            $table->string('capability', 16);
            $table->string('status', 32);
            $table->primary(['user_id', 'capability']);
        });
        Schema::create('operatordata', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id')->unique();
            $table->string('business_name')->default('');
        });
        Schema::create('personaldata', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id')->unique();
            $table->string('photo', 1024)->default('');
            $table->string('city')->default('');
        });
        Schema::create('operator_public_profile', function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
        });
        Schema::create('user_reputation', function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
            $table->unsignedTinyInteger('score')->default(60);
        });
        Schema::create('pet_assistant_favorite', function (Blueprint $table): void {
            $table->unsignedInteger('owner_user_id');
            $table->unsignedInteger('assistant_user_id');
            $table->integer('created_at');
            $table->primary(['owner_user_id', 'assistant_user_id']);
        });

        DB::table('users')->insert([
            ['id' => 1, 'role' => 'pet_owner', 'name' => 'Dual Role'],
            ['id' => 2, 'role' => 'pet_assistant', 'name' => 'Suspended Assistant'],
            ['id' => 3, 'role' => 'pet_assistant', 'name' => 'Legacy Assistant'],
            ['id' => 4, 'role' => 'pet_owner', 'name' => 'Suspended Owner'],
        ]);
        foreach ([1, 2, 3] as $userId) {
            DB::table('operatordata')->insert(['user_id' => $userId]);
            DB::table('personaldata')->insert(['user_id' => $userId, 'city' => 'Roma']);
        }
        $this->insertCapability(1, UserCapability::OWNER, 'active');
        $this->insertCapability(1, UserCapability::ASSISTANT, 'active');
        $this->insertCapability(2, UserCapability::OWNER, 'active');
        $this->insertCapability(2, UserCapability::ASSISTANT, 'suspended');
        $this->insertCapability(4, UserCapability::OWNER, 'suspended');
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_public_discovery_uses_active_assistant_capability_with_legacy_fallback(): void
    {
        $profiles = new PublicPetAssistant;

        $this->assertTrue($profiles->exists(1));
        $this->assertFalse($profiles->exists(2));
        $this->assertTrue($profiles->exists(3));
    }

    public function test_dual_role_account_can_favorite_another_assistant_but_not_itself(): void
    {
        $this->withSession([PortalSession::USER_ID_KEY => 1])
            ->putJson('/api/pet-assistants/1/favorite', ['favorite' => true])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Non puoi aggiungere il tuo profilo Assistant ai preferiti.');

        $this->withSession([PortalSession::USER_ID_KEY => 1])
            ->putJson('/api/pet-assistants/3/favorite', ['favorite' => true])
            ->assertOk()
            ->assertJsonPath('data.favorite', true);
        $this->assertDatabaseHas('pet_assistant_favorite', [
            'owner_user_id' => 1,
            'assistant_user_id' => 3,
        ]);

        $this->withSession([PortalSession::USER_ID_KEY => 1])
            ->getJson('/api/pet-assistant-favorites')
            ->assertOk()
            ->assertJsonPath('data.0.id', 3);
    }

    public function test_suspended_owner_capability_cannot_use_favorites(): void
    {
        $this->withSession([PortalSession::USER_ID_KEY => 4])
            ->getJson('/api/pet-assistant-favorites')
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_model_defense_rejects_self_favorite(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SELF_FAVORITE_NOT_ALLOWED');

        (new PublicPetAssistant)->setFavorite(1, 1, true);
    }

    private function insertCapability(int $userId, string $capability, string $status): void
    {
        DB::table('user_capabilities')->insert([
            'user_id' => $userId,
            'capability' => $capability,
            'status' => $status,
        ]);
    }
}
