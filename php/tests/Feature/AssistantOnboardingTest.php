<?php

namespace Tests\Feature;

use App\Models\UserCapability;
use App\Support\PortalSession;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AssistantOnboardingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropAllTables();
        Schema::create('users', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('name')->default('');
            $table->string('email')->default('');
            $table->boolean('email_verified')->default(false);
            $table->boolean('password_reset_required')->default(false);
            $table->string('avatar', 1024)->default('');
        });
        Schema::create('social_accounts', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->string('provider');
            $table->integer('updated_at')->default(0);
        });
        Schema::create('portal_policy', function (Blueprint $table): void {
            $table->string('policy_key')->primary();
            $table->integer('value');
            $table->integer('updated_at')->default(0);
        });
        DB::table('portal_policy')->insert([
            'policy_key' => 'initial_reputation_score',
            'value' => 60,
            'updated_at' => 1000,
        ]);
        Schema::create('profile_reputation', function (Blueprint $table): void {
            $table->unsignedInteger('user_id');
            $table->string('capability', 16);
            $table->unsignedTinyInteger('score')->default(60);
            $table->integer('updated_at')->default(0);
            $table->primary(['user_id', 'capability']);
        });
        Schema::create('user_capabilities', function (Blueprint $table): void {
            $table->unsignedInteger('user_id');
            $table->string('capability', 16);
            $table->string('status', 32)->default('draft');
            $table->unsignedSmallInteger('onboarding_version')->default(1);
            $table->string('current_step', 64)->default('');
            $table->unsignedInteger('completed_at')->default(0);
            $table->unsignedInteger('activated_at')->default(0);
            $table->unsignedInteger('suspended_at')->default(0);
            $table->unsignedInteger('disabled_at')->default(0);
            $table->integer('created_at')->default(0);
            $table->integer('updated_at')->default(0);
            $table->primary(['user_id', 'capability']);
        });
        Schema::create('account_profile', function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
            $table->string('name')->default('');
            $table->string('phone')->default('');
        });
        Schema::create('assistant_profile', function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
            $table->string('city')->default('');
            $table->string('address')->default('');
            $table->decimal('location_lat', 10, 7)->default(0);
            $table->decimal('location_lng', 10, 7)->default(0);
        });
        Schema::create('operatordata', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id')->unique();
            $table->string('operator_type')->default('person');
            $table->string('fiscal_code')->default('');
            $table->string('business_name')->default('');
            $table->string('vat_number')->default('');
            $table->text('bio')->nullable();
        });
        foreach (['operatortitledata', 'pettypedata', 'operatorgallery'] as $tableName) {
            Schema::create($tableName, function (Blueprint $table): void {
                $table->increments('id');
                $table->unsignedInteger('user_id');
            });
        }
        Schema::create('service', function (Blueprint $table): void {
            $table->increments('id');
            $table->boolean('requires_home_photo')->default(false);
        });
        Schema::create('operatorservicedata', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('service_id');
            $table->decimal('hour_price', 10, 2)->default(0);
            $table->boolean('home_photo_enabled')->default(false);
        });
        Schema::create('calendar_day', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->date('date');
            $table->boolean('enabled')->default(false);
        });
        Schema::create('calendar_day_slot', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('calendar_day_id');
            $table->boolean('enabled')->default(false);
        });

        DB::table('users')->insert([
            'id' => 1,
            'name' => '',
            'email' => 'globale@example.test',
            'email_verified' => true,
        ]);
        $this->insertCapability('owner', 'active');
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_owner_starts_a_private_draft_and_cannot_switch_to_it(): void
    {
        $this->withSession([PortalSession::USER_ID_KEY => 1])
            ->postJson('/api/profile/petassistant/onboarding/start')
            ->assertOk()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.isActive', false);

        $this->assertDatabaseHas('user_capabilities', [
            'user_id' => 1,
            'capability' => 'owner',
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('user_capabilities', [
            'user_id' => 1,
            'capability' => 'assistant',
            'status' => 'draft',
            'current_step' => 'personal',
        ]);
        $this->assertFalse((new UserCapability)->hasActive(1, UserCapability::ASSISTANT));

        $this->withSession([PortalSession::USER_ID_KEY => 1])
            ->postJson('/api/auth/mode', ['mode' => 'assistant'])
            ->assertForbidden();
    }

    public function test_activation_is_server_gated_and_enables_the_assistant_mode(): void
    {
        $this->withSession([PortalSession::USER_ID_KEY => 1])
            ->postJson('/api/profile/petassistant/onboarding/start')
            ->assertOk();
        $this->withSession([PortalSession::USER_ID_KEY => 1])
            ->postJson('/api/profile/petassistant/onboarding/activate')
            ->assertUnprocessable()
            ->assertJsonPath('data.canActivate', false)
            ->assertJsonPath('data.missingRequiredFields.0', 'Alias')
            ->assertJsonPath('data.missingRequiredFields.1', 'Città')
            ->assertJsonPath('message', 'Completa e salva Alias e Città nella sezione Dati personali prima di pubblicare il profilo.');

        DB::table('users')->where('id', 1)->update(['name' => 'Account globale']);
        DB::table('assistant_profile')->insert([
            'user_id' => 1,
            'city' => 'Roma',
        ]);

        $this->withSession([PortalSession::USER_ID_KEY => 1])
            ->postJson('/api/profile/petassistant/onboarding/activate')
            ->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.missingRequiredFields', [])
            ->assertJsonPath('data.completionPercentage', 25);
        $this->assertTrue((new UserCapability)->hasActive(1, UserCapability::OWNER));
        $this->assertTrue((new UserCapability)->hasActive(1, UserCapability::ASSISTANT));
        $this->assertDatabaseHas('profile_reputation', [
            'user_id' => 1,
            'capability' => 'assistant',
            'score' => 60,
        ]);

        $this->withSession([PortalSession::USER_ID_KEY => 1])
            ->postJson('/api/auth/mode', ['mode' => 'assistant'])
            ->assertOk()
            ->assertJsonPath('data.user.modes.current', 'assistant');
    }

    public function test_suspended_assistant_cannot_be_reactivated_by_starting_again(): void
    {
        $this->insertCapability('assistant', 'suspended');

        $this->withSession([PortalSession::USER_ID_KEY => 1])
            ->postJson('/api/profile/petassistant/onboarding/start')
            ->assertUnprocessable();
        $this->assertDatabaseHas('user_capabilities', [
            'user_id' => 1,
            'capability' => 'assistant',
            'status' => 'suspended',
        ]);
    }

    private function insertCapability(string $capability, string $status): void
    {
        DB::table('user_capabilities')->insert([
            'user_id' => 1,
            'capability' => $capability,
            'status' => $status,
            'onboarding_version' => 1,
            'current_step' => $status === 'active' ? 'complete' : 'personal',
            'created_at' => 1000,
            'updated_at' => 1000,
        ]);
    }
}
