<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Booking;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class BookingFlowTest extends TestCase
{
    private string $date;

    private string $alternativeDate;

    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropAllTables();
        $this->createSchema();
        $this->seedScenario();
        Mail::fake();
    }

    public function test_booking_number_and_overlap_are_enforced(): void
    {
        $model = new Booking;
        $booking = $model->create(1, $this->payload());

        $this->assertMatchesRegularExpression('/^\d{4}-000001$/', $booking['bookingNumber']);
        $this->assertSame('pending', $booking['status']);

        $second = $model->create(1, [...$this->payload(), 'startTime' => '10:00', 'endTime' => '11:00']);
        $this->assertMatchesRegularExpression('/^\d{4}-000002$/', $second['bookingNumber']);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('BOOKING_OVERLAP');
        $model->create(1, $this->payload());
    }

    public function test_automatic_mode_confirms_immediately(): void
    {
        DB::table('operatordata')->where('user_id', 2)->update(['booking_confirmation_mode' => 'automatic']);

        $booking = (new Booking)->create(1, $this->payload());

        $this->assertSame('confirmed', $booking['status']);
        $this->assertGreaterThan(0, DB::table('booking')->where('id', $booking['id'])->value('accepted_at'));
    }

    public function test_late_owner_cancellation_and_reviews_change_reputation(): void
    {
        $model = new Booking;
        $booking = $model->create(1, $this->payload());
        $tomorrow = date('Y-m-d', time() + 43200);
        DB::table('booking')->where('id', $booking['id'])->update(['booking_date' => $tomorrow]);
        $model->cancel($booking['id'], 1, 'Test annullamento tardivo');
        $this->assertSame(55, (int) DB::table('user_reputation')->where('user_id', 1)->value('score'));

        $second = $model->create(1, [...$this->payload(), 'startTime' => '10:00', 'endTime' => '11:00']);
        DB::table('booking')->where('id', $second['id'])->update([
            'status' => 'completed',
            'booking_date' => date('Y-m-d', time() - 86400),
        ]);
        $model->review($second['id'], 1, 'positive', 'Servizio professionale e puntuale.');

        $this->assertSame(65, (int) DB::table('user_reputation')->where('user_id', 2)->value('score'));
        $this->assertDatabaseHas('booking_review', ['booking_id' => $second['id'], 'score_delta' => 5]);
    }

    public function test_booking_api_requires_session_and_enforces_role(): void
    {
        $this->getJson('/api/bookings')->assertUnauthorized();
        $booking = (new Booking)->create(1, $this->payload());

        $this->withSession(['cb_portal_user_id' => 1])
            ->postJson('/api/bookings/'.$booking['id'].'/accept')
            ->assertUnprocessable()
            ->assertJsonPath('ok', false);
    }

    public function test_minimum_notice_and_half_hour_blocks_are_enforced(): void
    {
        $model = new Booking;
        $tooSoon = date('Y-m-d', time() + 3600);
        DB::table('calendar_day')->where('id', 1)->update(['date' => $tooSoon]);

        try {
            $model->create(1, [...$this->payload(), 'date' => $tooSoon]);
            $this->fail('A booking inside the minimum notice was accepted.');
        } catch (RuntimeException $exception) {
            $this->assertSame('BOOKING_MINIMUM_NOTICE', $exception->getMessage());
        }

        DB::table('calendar_day')->where('id', 1)->update(['date' => $this->date]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('INVALID_BOOKING_INTERVAL');
        $model->create(1, [...$this->payload(), 'endTime' => '09:45']);
    }

    public function test_reschedule_accepts_an_available_slot_and_keeps_the_frozen_price(): void
    {
        $model = new Booking;
        $booking = $model->create(1, $this->payload());
        $model->proposeReschedule($booking['id'], 2, [
            'slotId' => 2,
            'date' => $this->alternativeDate,
            'startTime' => '14:00',
            'endTime' => '15:30',
            'message' => 'Nuova proposta',
        ]);

        $this->assertDatabaseHas('booking', ['id' => $booking['id'], 'status' => 'reschedule_pending']);
        $updated = $model->respondToReschedule($booking['id'], 1, true);

        $this->assertSame('confirmed', $updated['status']);
        $this->assertSame($this->alternativeDate, $updated['date']);
        $this->assertSame(37.5, $updated['totalPrice']);
        $this->assertDatabaseHas('booking_reschedule', ['booking_id' => $booking['id'], 'status' => 'accepted']);
    }

    public function test_email_action_token_can_only_be_consumed_once(): void
    {
        $model = new Booking;
        $booking = $model->create(1, $this->payload());
        $token = $model->createActionToken($booking['id'], 1, 'cancel', time() + 3600);

        $cancelled = $model->consumeCancelToken($token);
        $this->assertSame('cancelled', $cancelled['status']);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('ACTION_TOKEN_INVALID');
        $model->consumeCancelToken($token);
    }

    public function test_admin_policy_changes_are_versioned_notified_and_applied(): void
    {
        $result = (new Admin)->saveAdminPolicies([
            'booking_min_notice_hours' => 96,
            'owner_late_cancellation_penalty' => 8,
        ]);

        $this->assertTrue($result['changed']);
        $this->assertSame(2, $result['recipients']);
        $this->assertSame(2, $result['delivered']);
        $this->assertDatabaseHas('portal_policy', ['policy_key' => 'booking_min_notice_hours', 'value' => 96]);
        $this->assertDatabaseHas('policy_change_log', [
            'recipient_count' => 2,
            'delivery_count' => 2,
            'failure_count' => 0,
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('BOOKING_MINIMUM_NOTICE');
        (new Booking)->create(1, $this->payload());
    }

    public function test_admin_policy_api_requires_a_server_session(): void
    {
        $this->getJson('/api/admin/policies')->assertUnauthorized();
        $this->postJson('/api/admin/auth/login', [
            'username' => 'coccoadmin',
            'password' => 'cocco123.',
        ])->assertOk()->assertJsonPath('ok', true);
        $this->getJson('/api/admin/policies')
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(11, 'data.policies');
    }

    private function payload(): array
    {
        return [
            'assistantUserId' => 2,
            'petId' => 1,
            'serviceId' => 1,
            'slotId' => 1,
            'date' => $this->date,
            'startTime' => '09:00',
            'endTime' => '10:00',
            'message' => 'Richiesta di prova',
        ];
    }

    private function seedScenario(): void
    {
        $now = time();
        $this->date = date('Y-m-d', $now + (3 * 86400));
        $this->alternativeDate = date('Y-m-d', $now + (4 * 86400));
        DB::table('users')->insert([
            ['id' => 1, 'role' => 'pet_owner', 'name' => 'Owner', 'email' => 'owner@example.test'],
            ['id' => 2, 'role' => 'pet_assistant', 'name' => 'Assistant', 'email' => 'assistant@example.test'],
        ]);
        DB::table('user_reputation')->insert([
            ['user_id' => 1, 'score' => 60, 'updated_at' => $now],
            ['user_id' => 2, 'score' => 60, 'updated_at' => $now],
        ]);
        DB::table('operatordata')->insert(['user_id' => 2, 'booking_confirmation_mode' => 'manual', 'updated_at' => $now]);
        DB::table('ownerpet')->insert(['id' => 1, 'user_id' => 1, 'name' => 'Rex']);
        DB::table('service')->insert(['id' => 1, 'name' => 'Passeggiata']);
        DB::table('calendar_day')->insert(['id' => 1, 'user_id' => 2, 'date' => $this->date, 'enabled' => 1]);
        DB::table('calendar_day')->insert(['id' => 2, 'user_id' => 2, 'date' => $this->alternativeDate, 'enabled' => 1]);
        DB::table('calendar_day_slot')->insert(['id' => 1, 'calendar_day_id' => 1, 'start_time' => '09:00', 'end_time' => '12:00', 'enabled' => 1]);
        DB::table('calendar_day_slot')->insert(['id' => 2, 'calendar_day_id' => 2, 'start_time' => '14:00', 'end_time' => '17:00', 'enabled' => 1]);
        DB::table('calendar_day_slot_service')->insert(['slot_id' => 1, 'service_id' => 1, 'enabled' => 1, 'hour_price' => 20]);
        DB::table('calendar_day_slot_service')->insert(['slot_id' => 2, 'service_id' => 1, 'enabled' => 1, 'hour_price' => 25]);
    }

    private function createSchema(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->string('role');
            $table->string('name');
            $table->string('email')->nullable();
            $table->boolean('email_verified')->default(true);
        });
        Schema::create('user_reputation', function (Blueprint $table) {
            $table->unsignedInteger('user_id')->primary();
            $table->unsignedTinyInteger('score')->default(60);
            $table->integer('updated_at')->default(0);
        });
        Schema::create('operatordata', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id')->unique();
            $table->string('booking_confirmation_mode')->default('manual');
            $table->integer('updated_at')->default(0);
        });
        Schema::create('ownerpet', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->string('name');
        });
        Schema::create('service', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
        });
        Schema::create('calendar_day', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->date('date');
            $table->boolean('enabled');
        });
        Schema::create('calendar_day_slot', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('calendar_day_id');
            $table->string('start_time', 5);
            $table->string('end_time', 5);
            $table->boolean('enabled');
        });
        Schema::create('calendar_day_slot_service', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('slot_id');
            $table->unsignedInteger('service_id');
            $table->boolean('enabled');
            $table->decimal('hour_price', 10, 2);
        });
        Schema::create('booking_counter', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedInteger('last_value');
            $table->integer('updated_at');
        });
        Schema::create('booking', function (Blueprint $table) {
            $table->increments('id');
            $table->string('booking_number')->unique();
            $table->unsignedInteger('owner_user_id');
            $table->unsignedInteger('assistant_user_id');
            $table->unsignedInteger('pet_id');
            $table->unsignedInteger('service_id');
            $table->unsignedInteger('source_slot_id');
            $table->date('booking_date');
            $table->string('start_time', 5);
            $table->string('end_time', 5);
            $table->unsignedSmallInteger('duration_minutes');
            $table->decimal('hour_price', 10, 2);
            $table->decimal('total_price', 10, 2);
            $table->string('message', 4096);
            $table->string('confirmation_mode');
            $table->string('status');
            $table->integer('response_deadline');
            $table->integer('accepted_at');
            $table->integer('cancelled_at');
            $table->unsignedInteger('cancelled_by_user_id');
            $table->string('cancellation_reason', 2048);
            $table->integer('created_at');
            $table->integer('updated_at');
        });
        Schema::create('booking_reschedule', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('booking_id');
            $table->unsignedInteger('proposed_by_user_id');
            $table->unsignedInteger('source_slot_id');
            $table->date('booking_date');
            $table->string('start_time', 5);
            $table->string('end_time', 5);
            $table->unsignedSmallInteger('duration_minutes');
            $table->decimal('hour_price', 10, 2);
            $table->decimal('total_price', 10, 2);
            $table->string('message', 4096);
            $table->string('previous_status');
            $table->string('status');
            $table->integer('responded_at');
            $table->integer('created_at');
            $table->integer('updated_at');
        });
        Schema::create('booking_review', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('booking_id');
            $table->unsignedInteger('reviewer_user_id');
            $table->unsignedInteger('reviewed_user_id');
            $table->string('sentiment');
            $table->string('comment', 4096);
            $table->smallInteger('score_delta');
            $table->integer('created_at');
            $table->unique(['booking_id', 'reviewer_user_id']);
        });
        Schema::create('reputation_event', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('booking_id');
            $table->unsignedInteger('actor_user_id');
            $table->string('event_type');
            $table->smallInteger('delta');
            $table->unsignedTinyInteger('score_after');
            $table->string('note', 2048);
            $table->integer('created_at');
        });
        Schema::create('booking_action_token', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('booking_id');
            $table->unsignedInteger('user_id');
            $table->string('action');
            $table->string('token_hash', 64);
            $table->integer('expires_at');
            $table->integer('used_at');
            $table->integer('created_at');
        });
        Schema::create('error', function (Blueprint $table) {
            $table->increments('id');
            $table->string('params', 4096);
            $table->string('msg', 4096);
            $table->string('method');
            $table->integer('timestamp');
        });
        Schema::create('portal_policy', function (Blueprint $table) {
            $table->string('policy_key', 96)->primary();
            $table->integer('value');
            $table->integer('updated_at');
        });
        Schema::create('policy_change_log', function (Blueprint $table) {
            $table->increments('id');
            $table->string('batch_id', 36)->unique();
            $table->text('changes_json');
            $table->unsignedInteger('recipient_count');
            $table->unsignedInteger('delivery_count');
            $table->unsignedInteger('failure_count');
            $table->integer('created_at');
        });
    }
}
