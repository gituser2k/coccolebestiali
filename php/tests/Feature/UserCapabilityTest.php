<?php

namespace Tests\Feature;

use App\Models\UserCapability;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;
use Tests\TestCase;

class UserCapabilityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropAllTables();
        Schema::create('users', function (Blueprint $table): void {
            $table->increments('id');
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
    }

    public function test_new_account_receives_only_the_active_owner_capability(): void
    {
        (new UserCapability)->provisionOwner(10, 1234);

        $this->assertDatabaseHas('user_capabilities', [
            'user_id' => 10,
            'capability' => 'owner',
            'status' => 'active',
            'current_step' => 'complete',
            'activated_at' => 1234,
        ]);
        $this->assertDatabaseCount('user_capabilities', 1);
    }

    public function test_missing_capabilities_grant_no_access(): void
    {
        $this->assertSame([], (new UserCapability)->activeForUser(20));
        $this->assertFalse((new UserCapability)->hasActive(20, UserCapability::OWNER));
    }

    public function test_provisioning_is_idempotent_and_never_reactivates_an_existing_capability(): void
    {
        DB::table('user_capabilities')->insert([
            'user_id' => 30,
            'capability' => 'assistant',
            'status' => 'suspended',
            'onboarding_version' => 1,
            'current_step' => 'complete',
            'suspended_at' => 3000,
            'created_at' => 1000,
            'updated_at' => 3000,
        ]);

        $capabilities = new UserCapability;
        $capabilities->provisionOwner(30, 4000);
        $capabilities->provisionOwner(30, 5000);

        $this->assertDatabaseHas('user_capabilities', [
            'user_id' => 30,
            'capability' => 'assistant',
            'status' => 'suspended',
            'suspended_at' => 3000,
            'updated_at' => 3000,
        ]);
        $this->assertSame(2, DB::table('user_capabilities')->where('user_id', 30)->count());
    }

    public function test_invalid_user_ids_are_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        (new UserCapability)->provisionOwner(0);
    }

    public function test_no_ui_mode_is_granted_when_every_capability_is_inactive(): void
    {
        foreach ([['owner', 'disabled'], ['assistant', 'suspended']] as [$capability, $status]) {
            DB::table('user_capabilities')->insert([
                'user_id' => 50,
                'capability' => $capability,
                'status' => $status,
                'onboarding_version' => 1,
                'current_step' => 'complete',
                'created_at' => 1000,
                'updated_at' => 1000,
            ]);
        }

        $state = (new UserCapability)->resolveForUser(50);

        $this->assertSame([], $state['active']);
        $this->assertSame(['available' => [], 'default' => ''], $state['modes']);
    }

    public function test_active_scope_supports_dual_role_and_fails_closed_for_suspended_or_partial_state(): void
    {
        DB::table('users')->insert([
            ['id' => 61],
            ['id' => 62],
            ['id' => 63],
            ['id' => 64],
        ]);
        $this->insertCapability(61, 'owner', 'active');
        $this->insertCapability(61, 'assistant', 'active');
        $this->insertCapability(62, 'owner', 'active');
        $this->insertCapability(62, 'assistant', 'suspended');
        $this->insertCapability(64, 'owner', 'active');

        $capabilities = new UserCapability;
        $query = DB::table('users as account')->select('account.id');
        $ids = $capabilities->scopeActive($query, 'account', UserCapability::ASSISTANT, 'assistant_capability')
            ->orderBy('account.id')->pluck('account.id')->all();

        $this->assertSame([61], $ids);
        $this->assertTrue($capabilities->hasActive(61, UserCapability::ASSISTANT));
        $this->assertFalse($capabilities->hasActive(62, UserCapability::ASSISTANT));
        $this->assertFalse($capabilities->hasActive(63, UserCapability::OWNER));
        $this->assertFalse($capabilities->hasActive(64, UserCapability::ASSISTANT));
    }

    private function insertCapability(int $userId, string $capability, string $status): void
    {
        DB::table('user_capabilities')->insert([
            'user_id' => $userId,
            'capability' => $capability,
            'status' => $status,
            'onboarding_version' => 1,
            'current_step' => 'complete',
            'created_at' => 1000,
            'updated_at' => 1000,
        ]);
    }
}
