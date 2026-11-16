<?php

namespace Tests\Feature;

use App\Models\UserAccount;
use App\Support\PortalSession;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class NeutralAccountCompatibilityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropAllTables();
        Schema::create('users', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('name')->default('');
            $table->string('email')->nullable()->unique();
            $table->boolean('email_verified')->default(false);
            $table->string('password_hash')->default('');
            $table->boolean('password_reset_required')->default(false);
            $table->string('avatar', 1024)->default('');
            $table->integer('created_at')->default(0);
            $table->integer('updated_at')->default(0);
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
        Schema::create('social_accounts', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->string('provider', 32);
            $table->string('provider_sub');
            $table->string('provider_email')->default('');
            $table->boolean('provider_email_verified')->default(false);
            $table->boolean('is_private_email')->default(false);
            $table->text('raw_claims')->nullable();
            $table->integer('created_at')->default(0);
            $table->integer('updated_at')->default(0);
            $table->unique(['provider', 'provider_sub']);
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
        Mail::fake();
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_email_registration_without_a_role_creates_a_neutral_owner_account(): void
    {
        $response = $this->postJson('/api/auth/register/email', [
            'email' => 'neutral@example.test',
            'password' => 'Password1!',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.user.activeCapabilities.0', 'owner')
            ->assertJsonPath('data.user.modes.default', 'owner')
            ->assertJsonPath('data.user.capabilitySource', 'user_capabilities');
        $this->assertDatabaseHas('user_capabilities', [
            'user_id' => $response->json('data.user.id'),
            'capability' => 'owner',
            'status' => 'active',
        ]);
        $this->assertDatabaseCount('user_capabilities', 1);
        $this->assertDatabaseHas('profile_reputation', [
            'user_id' => $response->json('data.user.id'),
            'capability' => 'owner',
            'score' => 60,
        ]);
    }

    public function test_legacy_role_registration_payload_is_rejected(): void
    {
        $response = $this->postJson('/api/auth/register/email', [
            'role' => 'pet_assistant',
            'email' => 'legacy-assistant@example.test',
            'password' => 'Password1!',
        ]);

        $response->assertUnprocessable();
        $this->assertDatabaseMissing('users', ['email' => 'legacy-assistant@example.test']);
    }

    public function test_google_registration_without_a_role_creates_a_neutral_account(): void
    {
        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
                'iss' => 'https://accounts.google.com',
                'aud' => (string) env('GOOGLE_CLIENT_ID', ''),
                'sub' => 'neutral-google-sub',
                'email' => 'neutral-google@example.test',
                'email_verified' => 'true',
                'name' => 'Neutral Google',
                'picture' => '',
            ]),
        ]);

        $this->postJson('/api/auth/register/google', ['idToken' => 'valid-test-token'])
            ->assertOk()
            ->assertJsonPath('data.user.activeCapabilities', ['owner'])
            ->assertJsonPath('data.user.provider', 'google');
    }

    public function test_apple_mock_registration_without_a_role_creates_a_neutral_account(): void
    {
        $this->app->detectEnvironment(static fn (): string => 'local');
        $previous = getenv('APPLE_MOCK_AUTH');
        putenv('APPLE_MOCK_AUTH=true');
        $_ENV['APPLE_MOCK_AUTH'] = 'true';
        $_SERVER['APPLE_MOCK_AUTH'] = 'true';

        try {
            $this->postJson('/api/auth/register/apple/mock', [
                'mockEmail' => 'neutral-apple@example.test',
                'mockSub' => 'neutral-apple-sub',
            ])->assertOk()
                ->assertJsonPath('data.user.activeCapabilities', ['owner'])
                ->assertJsonPath('data.user.provider', 'apple');
        } finally {
            $restored = $previous === false ? 'false' : (string) $previous;
            putenv('APPLE_MOCK_AUTH='.$restored);
            $_ENV['APPLE_MOCK_AUTH'] = $restored;
            $_SERVER['APPLE_MOCK_AUTH'] = $restored;
        }
    }

    public function test_social_registration_never_changes_an_existing_role_or_capability_state(): void
    {
        $this->insertUser(10, 'existing@example.test');
        $this->insertCapability(10, 'owner', 'active');
        $this->insertCapability(10, 'assistant', 'suspended', 1234);

        $user = (new UserAccount)->upsertSocialUser(
            'google',
            'google-existing-10',
            'existing@example.test',
            true,
            'Existing User',
            '',
            false,
            ['sub' => 'google-existing-10']
        );

        $this->assertSame(['owner'], $user['activeCapabilities']);
        $this->assertSame('owner', $user['modes']['default']);
        $this->assertDatabaseHas('user_capabilities', [
            'user_id' => 10,
            'capability' => 'assistant',
            'status' => 'suspended',
            'suspended_at' => 1234,
        ]);
        $this->assertDatabaseCount('user_capabilities', 2);
    }

    public function test_capability_read_fails_closed_when_rows_are_missing(): void
    {
        $this->insertUser(20, 'fallback@example.test');

        $user = (new UserAccount)->getUserById(20);

        $this->assertSame('user_capabilities', $user['capabilitySource']);
        $this->assertSame([], $user['activeCapabilities']);
        $this->assertSame(['available' => [], 'default' => ''], $user['modes']);
        $this->assertDatabaseCount('user_capabilities', 0);
    }

    public function test_auth_me_exposes_capabilities_without_a_role_field(): void
    {
        $this->insertUser(30, 'session@example.test');
        $this->insertCapability(30, 'owner', 'active');

        $this->withSession([PortalSession::USER_ID_KEY => 30])
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonMissingPath('data.user.role')
            ->assertJsonPath('data.user.capabilities.0.capability', 'owner')
            ->assertJsonPath('data.user.capabilities.0.status', 'active')
            ->assertJsonPath('data.user.modes.default', 'owner');
    }

    public function test_only_neutral_email_verification_signatures_are_accepted(): void
    {
        $this->insertUser(40, 'new-link@example.test', false);
        $this->insertUser(41, 'legacy-link@example.test', false);
        $expires = time() + 600;
        $key = (string) config('app.key');

        $newSignature = hash_hmac('sha256', 'new-link@example.test|'.$expires, $key);
        $this->get('/api/auth/verify-email?'.http_build_query([
            'email' => 'new-link@example.test',
            'expires' => $expires,
            'signature' => $newSignature,
        ]))->assertRedirect('/?auth=login&verified=1');

        $legacySignature = hash_hmac('sha256', 'legacy-link@example.test|pet_assistant|'.$expires, $key);
        $this->get('/api/auth/verify-email?'.http_build_query([
            'email' => 'legacy-link@example.test',
            'role' => 'pet_assistant',
            'expires' => $expires,
            'signature' => $legacySignature,
        ]))->assertStatus(400);

        $this->assertSame(1, DB::table('users')->where('email_verified', 1)->count());
    }

    private function insertUser(int $id, string $email, bool $verified = true): void
    {
        DB::table('users')->insert([
            'id' => $id,
            'name' => '',
            'email' => $email,
            'email_verified' => $verified,
            'password_hash' => '',
            'password_reset_required' => false,
            'avatar' => '',
            'created_at' => 1000,
            'updated_at' => 1000,
        ]);
    }

    private function insertCapability(
        int $userId,
        string $capability,
        string $status,
        int $suspendedAt = 0
    ): void {
        DB::table('user_capabilities')->insert([
            'user_id' => $userId,
            'capability' => $capability,
            'status' => $status,
            'onboarding_version' => 1,
            'current_step' => 'complete',
            'completed_at' => 1000,
            'activated_at' => 1000,
            'suspended_at' => $suspendedAt,
            'disabled_at' => 0,
            'created_at' => 1000,
            'updated_at' => $suspendedAt > 0 ? $suspendedAt : 1000,
        ]);
    }
}
