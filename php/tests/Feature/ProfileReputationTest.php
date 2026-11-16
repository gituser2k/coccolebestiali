<?php

namespace Tests\Feature;

use App\Models\ProfileReputation;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProfileReputationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropAllTables();
        Schema::create('users', function (Blueprint $table): void {
            $table->increments('id');
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
        Schema::create('reputation_event', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->string('subject_capability', 16)->default('owner');
            $table->unsignedInteger('booking_id')->default(0);
            $table->unsignedInteger('actor_user_id')->default(0);
            $table->string('event_type', 32);
            $table->smallInteger('delta');
            $table->unsignedTinyInteger('score_after');
            $table->string('note', 2048)->default('');
            $table->integer('created_at');
        });
    }

    public function test_assistant_initialization_creates_independent_owner_and_assistant_scores(): void
    {
        DB::table('users')->insert(['id' => 1]);

        $reputation = new ProfileReputation;
        $reputation->initialize(1, ProfileReputation::OWNER, 1000);
        $reputation->initialize(1, ProfileReputation::ASSISTANT, 1000);

        $this->assertDatabaseHas('profile_reputation', [
            'user_id' => 1,
            'capability' => 'owner',
            'score' => 60,
        ]);
        $this->assertDatabaseHas('profile_reputation', [
            'user_id' => 1,
            'capability' => 'assistant',
            'score' => 60,
        ]);
    }

    public function test_deltas_update_only_the_subject_capability(): void
    {
        DB::table('users')->insert(['id' => 2]);
        DB::table('profile_reputation')->insert([
            ['user_id' => 2, 'capability' => 'owner', 'score' => 60, 'updated_at' => 1000],
            ['user_id' => 2, 'capability' => 'assistant', 'score' => 70, 'updated_at' => 1000],
        ]);
        $reputation = new ProfileReputation;

        $reputation->applyDelta(2, ProfileReputation::OWNER, 10, 2, 'late_cancellation', -5, 'Owner side');
        $this->assertSame(55, $reputation->score(2, ProfileReputation::OWNER));
        $this->assertSame(70, $reputation->score(2, ProfileReputation::ASSISTANT));

        $reputation->applyDelta(2, ProfileReputation::ASSISTANT, 11, 2, 'response_expired', -5, 'Assistant side');
        $this->assertSame(55, $reputation->score(2, ProfileReputation::OWNER));
        $this->assertSame(65, $reputation->score(2, ProfileReputation::ASSISTANT));
        $this->assertDatabaseHas('reputation_event', [
            'user_id' => 2,
            'subject_capability' => 'owner',
            'score_after' => 55,
        ]);
        $this->assertDatabaseHas('reputation_event', [
            'user_id' => 2,
            'subject_capability' => 'assistant',
            'score_after' => 65,
        ]);
    }

    public function test_missing_context_row_does_not_reuse_the_other_reputation(): void
    {
        DB::table('users')->insert(['id' => 3]);
        DB::table('profile_reputation')->insert([
            'user_id' => 3,
            'capability' => 'assistant',
            'score' => 88,
            'updated_at' => 1000,
        ]);
        $reputation = new ProfileReputation;

        $this->assertSame(60, $reputation->score(3, ProfileReputation::OWNER));
        $this->assertSame(88, $reputation->score(3, ProfileReputation::ASSISTANT));
    }

    public function test_initialization_is_idempotent_and_does_not_reset_a_score(): void
    {
        DB::table('users')->insert(['id' => 4]);
        $reputation = new ProfileReputation;
        $reputation->initialize(4, ProfileReputation::OWNER, 1000);
        DB::table('profile_reputation')->where('user_id', 4)->where('capability', 'owner')->update(['score' => 72]);
        $reputation->initialize(4, ProfileReputation::OWNER, 2000);

        $this->assertSame(72, $reputation->score(4, ProfileReputation::OWNER));
        $this->assertDatabaseCount('profile_reputation', 1);
    }
}
