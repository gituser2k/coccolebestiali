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
            $table->string('role');
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

    public function test_legacy_owner_receives_only_the_active_owner_capability(): void
    {
        (new UserCapability)->provisionForLegacyRole(10, 'pet_owner', 1234);

        $this->assertDatabaseHas('user_capabilities', [
            'user_id' => 10,
            'capability' => 'owner',
            'status' => 'active',
            'current_step' => 'complete',
            'activated_at' => 1234,
        ]);
        $this->assertDatabaseCount('user_capabilities', 1);
    }

    public function test_legacy_assistant_receives_owner_and_assistant_capabilities(): void
    {
        (new UserCapability)->provisionForLegacyRole(20, 'pet_assistant', 2345);

        $this->assertSame(
            ['assistant', 'owner'],
            DB::table('user_capabilities')->where('user_id', 20)->orderBy('capability')->pluck('capability')->all()
        );
        $this->assertSame(2, DB::table('user_capabilities')->where('status', 'active')->count());
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
        $capabilities->provisionForLegacyRole(30, 'pet_assistant', 4000);
        $capabilities->provisionForLegacyRole(30, 'pet_assistant', 5000);

        $this->assertDatabaseHas('user_capabilities', [
            'user_id' => 30,
            'capability' => 'assistant',
            'status' => 'suspended',
            'suspended_at' => 3000,
            'updated_at' => 3000,
        ]);
        $this->assertSame(2, DB::table('user_capabilities')->where('user_id', 30)->count());
    }

    public function test_invalid_legacy_roles_are_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        (new UserCapability)->provisionForLegacyRole(40, 'administrator');
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

        $state = (new UserCapability)->resolveForUser(50, 'pet_assistant');

        $this->assertSame([], $state['active']);
        $this->assertSame(['available' => [], 'default' => ''], $state['modes']);
    }
}
