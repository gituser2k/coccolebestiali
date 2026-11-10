<?php

namespace Tests\Feature;

use App\Models\ProfileReputation;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class ProfileReputationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropAllTables();
        Schema::create('users', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('role', 32);
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
        Schema::create('user_reputation', function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
            $table->unsignedTinyInteger('score')->default(60);
            $table->integer('updated_at')->default(0);
        });
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
        DB::table('users')->insert(['id' => 1, 'role' => 'pet_assistant']);

        (new ProfileReputation)->initializeForLegacyRole(1, 'pet_assistant', 1000);

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
        $this->assertDatabaseHas('user_reputation', ['user_id' => 1, 'score' => 60]);
    }

    public function test_deltas_update_only_the_subject_capability_and_mirror_matching_legacy_role(): void
    {
        DB::table('users')->insert(['id' => 2, 'role' => 'pet_assistant']);
        DB::table('user_reputation')->insert(['user_id' => 2, 'score' => 70, 'updated_at' => 1000]);
        DB::table('profile_reputation')->insert([
            ['user_id' => 2, 'capability' => 'owner', 'score' => 60, 'updated_at' => 1000],
            ['user_id' => 2, 'capability' => 'assistant', 'score' => 70, 'updated_at' => 1000],
        ]);
        $reputation = new ProfileReputation;

        $reputation->applyDelta(2, ProfileReputation::OWNER, 10, 2, 'late_cancellation', -5, 'Owner side');
        $this->assertSame(55, $reputation->score(2, ProfileReputation::OWNER));
        $this->assertSame(70, $reputation->score(2, ProfileReputation::ASSISTANT));
        $this->assertDatabaseHas('user_reputation', ['user_id' => 2, 'score' => 70]);

        $reputation->applyDelta(2, ProfileReputation::ASSISTANT, 11, 2, 'response_expired', -5, 'Assistant side');
        $this->assertSame(55, $reputation->score(2, ProfileReputation::OWNER));
        $this->assertSame(65, $reputation->score(2, ProfileReputation::ASSISTANT));
        $this->assertDatabaseHas('user_reputation', ['user_id' => 2, 'score' => 65]);
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

    public function test_missing_context_row_does_not_reuse_the_other_legacy_reputation(): void
    {
        DB::table('users')->insert(['id' => 3, 'role' => 'pet_assistant']);
        DB::table('user_reputation')->insert(['user_id' => 3, 'score' => 88, 'updated_at' => 1000]);
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

    public function test_legacy_schema_fallback_remains_operational(): void
    {
        Schema::drop('profile_reputation');
        DB::table('users')->insert(['id' => 4, 'role' => 'pet_owner']);
        DB::table('user_reputation')->insert(['user_id' => 4, 'score' => 72, 'updated_at' => 1000]);
        $reputation = new ProfileReputation;

        $this->assertSame(72, $reputation->score(4, ProfileReputation::OWNER));
        $this->assertSame(60, $reputation->score(4, ProfileReputation::ASSISTANT));
        $reputation->applyDelta(4, ProfileReputation::OWNER, 12, 4, 'review_positive', 5, 'Legacy');

        $this->assertDatabaseHas('user_reputation', ['user_id' => 4, 'score' => 77]);
        $this->assertDatabaseHas('reputation_event', [
            'user_id' => 4,
            'subject_capability' => 'owner',
            'score_after' => 77,
        ]);

        try {
            $reputation->applyDelta(4, ProfileReputation::ASSISTANT, 13, 4, 'review_positive', 5, 'Wrong context');
            $this->fail('A legacy-only schema cannot store a second contextual score.');
        } catch (RuntimeException $exception) {
            $this->assertSame('CONTEXTUAL_REPUTATION_SCHEMA_REQUIRED', $exception->getMessage());
        }
        $this->assertDatabaseHas('user_reputation', ['user_id' => 4, 'score' => 77]);
    }
}
