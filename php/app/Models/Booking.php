<?php

namespace App\Models;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use RuntimeException;

class Booking
{
    private const ACTIVE_STATUSES = ['pending', 'confirmed', 'reschedule_pending'];

    private DateTimeZone $timezone;

    public function __construct()
    {
        $this->timezone = new DateTimeZone('Europe/Rome');
    }

    public function reconcile(): void
    {
        $now = time();

        $expiredIds = DB::table('booking')
            ->where('status', 'pending')
            ->where('response_deadline', '>', 0)
            ->where('response_deadline', '<=', $now)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
        if ($expiredIds !== []) {
            $penalty = PortalPolicy::value('assistant_late_action_penalty');
            foreach ($expiredIds as $bookingId) {
                $expired = DB::table('booking')->where('id', $bookingId)->where('status', 'pending')
                    ->where('response_deadline', '<=', $now)->update(['status' => 'expired', 'updated_at' => $now]);
                if (! $expired) {
                    continue;
                }
                $booking = $this->getById($bookingId);
                if ($penalty > 0) {
                    DB::transaction(function () use ($bookingId, $booking, $penalty) {
                        $this->applyReputationDelta(
                            (int) $booking['assistantUserId'],
                            $bookingId,
                            (int) $booking['assistantUserId'],
                            'response_expired',
                            -$penalty,
                            'Richiesta scaduta senza risposta.'
                        );
                    });
                }
                $this->sendLifecycleEmails($booking, 'expired');
            }
        }

        $completedIds = DB::table('booking')
            ->where('status', 'confirmed')
            ->get(['id', 'booking_date', 'end_time'])
            ->filter(fn ($booking) => $this->toTimestamp((string) $booking->booking_date, (string) $booking->end_time) <= $now)
            ->pluck('id')
            ->all();
        if ($completedIds !== []) {
            DB::table('booking')->whereIn('id', $completedIds)->where('status', 'confirmed')->update(['status' => 'completed', 'updated_at' => $now]);
        }
    }

    public function create(int $ownerUserId, array $payload): array
    {
        $this->assertRole($ownerUserId, 'pet_owner');
        $petId = (int) ($payload['petId'] ?? 0);
        $this->assertOwnedPet($ownerUserId, $petId);
        $assistantUserId = (int) ($payload['assistantUserId'] ?? 0);
        $id = DB::transaction(function () use ($ownerUserId, $petId, $assistantUserId, $payload) {
            $operator = $this->lockAssistantSchedule($assistantUserId);

            return $this->insertBooking($ownerUserId, $petId, $assistantUserId, $operator, $payload);
        }, 3);

        return $this->notifyAndReturn($this->getById($id), 'created');
    }

    public function createBatch(int $ownerUserId, array $payload): array
    {
        $this->assertRole($ownerUserId, 'pet_owner');
        $assistantId = (int) $payload['assistantUserId'];
        $petId = (int) $payload['petId'];
        $items = $payload['items'];
        $hash = hash('sha256', json_encode([$assistantId, $petId, $items], JSON_THROW_ON_ERROR));
        [$batchId, $ids, $replayed] = DB::transaction(function () use ($ownerUserId, $assistantId, $petId, $items, $payload, $hash) {
            DB::table('users')->where('id', $ownerUserId)->lockForUpdate()->first();
            $existing = DB::table('booking_batch')->where('owner_user_id', $ownerUserId)
                ->where('request_key', $payload['requestKey'])->lockForUpdate()->first();
            if ($existing) {
                if ($existing->request_hash !== $hash) {
                    throw new RuntimeException('BOOKING_REQUEST_KEY_REUSED');
                }

                return [(int) $existing->id, DB::table('booking')->where('batch_id', $existing->id)->orderBy('id')->pluck('id')->all(), true];
            }

            $this->assertOwnedPet($ownerUserId, $petId, true);
            $operator = $this->lockAssistantSchedule($assistantId);
            $services = DB::table('operatorservicedata')->where('user_id', $assistantId)
                ->pluck('service_id')->map(fn ($id) => (int) $id)->all();
            $batchId = DB::table('booking_batch')->insertGetId([
                'owner_user_id' => $ownerUserId,
                'request_key' => $payload['requestKey'],
                'request_hash' => $hash,
                'created_at' => time(),
            ]);

            $ids = [];
            foreach ($items as $index => $item) {
                try {
                    if (! in_array((int) $item['serviceId'], $services, true)) {
                        throw new RuntimeException('SLOT_NOT_AVAILABLE');
                    }
                    $ids[] = $this->insertBooking($ownerUserId, $petId, $assistantId, $operator, $item, (int) $batchId);
                } catch (RuntimeException $error) {
                    if ($error instanceof QueryException) {
                        throw $error;
                    }
                    throw new BookingItemException($index, $error->getMessage());
                }
            }

            return [(int) $batchId, $ids, false];
        }, 3);

        return [
            'batchId' => $batchId,
            'bookings' => array_map(function ($id) use ($replayed) {
                $booking = $this->getById((int) $id);

                return $replayed ? $booking : $this->notifyAndReturn($booking, 'created');
            }, $ids),
        ];
    }

    private function assertOwnedPet(int $ownerUserId, int $petId, bool $lock = false): void
    {
        $pet = DB::table('ownerpet')->where('id', $petId)->where('user_id', $ownerUserId);
        if ($lock) {
            $pet->lockForUpdate();
        }
        if (! $pet->first(['id'])) {
            throw new RuntimeException('PET_NOT_AVAILABLE');
        }
    }

    private function lockAssistantSchedule(int $assistantUserId): object
    {
        $operator = DB::table('operatordata')->where('user_id', $assistantUserId)->lockForUpdate()->first();
        if (! $operator) {
            throw new RuntimeException('SLOT_NOT_AVAILABLE');
        }

        return $operator;
    }

    private function insertBooking(int $ownerUserId, int $petId, int $assistantUserId, object $operator, array $payload, ?int $batchId = null): int
    {
        $serviceId = (int) ($payload['serviceId'] ?? 0);
        $slotId = (int) ($payload['slotId'] ?? 0);
        $date = (string) ($payload['date'] ?? '');
        $startTime = (string) ($payload['startTime'] ?? '');
        $endTime = (string) ($payload['endTime'] ?? '');
        $featureIds = array_values(array_unique(array_map('intval', $payload['featureIds'] ?? [])));
        $policies = PortalPolicy::values();

        $slot = $this->resolveSlot($slotId, $assistantUserId, $serviceId, $date, true);
        $preferredFeatures = $this->resolvePreferredFeatures($assistantUserId, $serviceId, $featureIds);
        $timing = $this->validateRequestedInterval($date, $startTime, $endTime, $slot);
        $this->assertIntervalAvailable($assistantUserId, $date, $startTime, $endTime);

        $mode = $operator->booking_confirmation_mode;
        $mode = $mode === 'automatic' ? 'automatic' : 'manual';
        $status = $mode === 'automatic' ? 'confirmed' : 'pending';
        $now = time();
        $deadline = min(
            $now + ($policies['manual_response_hours'] * 3600),
            $timing['startTimestamp'] - ($policies['assistant_cutoff_hours'] * 3600)
        );
        $hourPrice = (float) $slot->hour_price;
        $totalPrice = round($hourPrice * ($timing['durationMinutes'] / 60), 2);

        if ($batchId !== null && (int) round($totalPrice * 100) !== (int) $payload['expectedTotalCents']) {
            throw new RuntimeException('BOOKING_PRICE_CHANGED');
        }

        $bookingId = (int) DB::table('booking')->insertGetId([
            'booking_number' => $this->nextBookingNumber((int) (new DateTimeImmutable('now', $this->timezone))->format('Y')),
            'owner_user_id' => $ownerUserId,
            'batch_id' => $batchId,
            'assistant_user_id' => $assistantUserId,
            'pet_id' => $petId,
            'service_id' => $serviceId,
            'source_slot_id' => $slotId,
            'booking_date' => $date,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'duration_minutes' => $timing['durationMinutes'],
            'hour_price' => $hourPrice,
            'total_price' => $totalPrice,
            'message' => mb_substr(trim((string) ($payload['message'] ?? '')), 0, 4096),
            'confirmation_mode' => $mode,
            'status' => $status,
            'response_deadline' => $deadline,
            'accepted_at' => $status === 'confirmed' ? $now : 0,
            'cancelled_at' => 0,
            'cancelled_by_user_id' => 0,
            'cancellation_reason' => '',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        foreach ($preferredFeatures as $feature) {
            DB::table('booking_feature_preference')->insert([
                'booking_id' => $bookingId,
                'feature_id' => (int) $feature->id,
                'feature_name_snapshot' => (string) $feature->name,
                'created_at' => $now,
            ]);
        }

        return $bookingId;
    }

    private function firstResponse(object $booking, int $now): ?int
    {
        return $booking->first_response_at !== null
            ? (int) $booking->first_response_at
            : ($booking->confirmation_mode === 'manual' ? $now : null);
    }

    public function listForUser(int $userId, bool $activeOnly = false): array
    {
        $this->reconcile();
        $role = $this->getRole($userId);
        if (! in_array($role, ['pet_owner', 'pet_assistant'], true)) {
            throw new RuntimeException('INVALID_ROLE');
        }

        $query = $this->baseQuery();
        if ($role === 'pet_owner') {
            $query->where('booking.owner_user_id', $userId);
        } else {
            $query->where('booking.assistant_user_id', $userId);
        }

        if ($activeOnly) {
            $query->whereIn('booking.status', self::ACTIVE_STATUSES);
        }
        $order = $activeOnly ? 'asc' : 'desc';

        return $query->orderBy('booking.booking_date', $order)
            ->orderBy('booking.start_time', $order)
            ->get()
            ->map(fn ($row) => $this->mapBooking($row, $userId))
            ->all();
    }

    public function accept(int $bookingId, int $assistantUserId): array
    {
        $booking = $this->ownedBooking($bookingId, $assistantUserId, 'pet_assistant');
        if ($booking->status !== 'pending') {
            throw new RuntimeException('BOOKING_NOT_PENDING');
        }
        if ((int) $booking->response_deadline <= time()) {
            throw new RuntimeException('BOOKING_RESPONSE_EXPIRED');
        }

        DB::transaction(function () use ($bookingId) {
            $current = DB::table('booking')->where('id', $bookingId)->lockForUpdate()->first();
            $now = time();
            if ($current->status !== 'pending') {
                throw new RuntimeException('BOOKING_NOT_PENDING');
            }
            if ((int) $current->response_deadline <= $now) {
                throw new RuntimeException('BOOKING_RESPONSE_EXPIRED');
            }

            DB::table('booking')->where('id', $bookingId)->update([
                'status' => 'confirmed',
                'accepted_at' => $now,
                'first_response_at' => $this->firstResponse($current, $now),
                'updated_at' => $now,
            ]);
        }, 3);
        $result = $this->getById($bookingId);

        return $this->notifyAndReturn($result, 'accepted');
    }

    public function decline(int $bookingId, int $assistantUserId, string $reason): array
    {
        $booking = $this->ownedBooking($bookingId, $assistantUserId, 'pet_assistant');
        if (! in_array($booking->status, ['pending', 'reschedule_pending'], true)) {
            throw new RuntimeException('BOOKING_NOT_ACTIONABLE');
        }

        DB::transaction(function () use ($bookingId, $assistantUserId, $reason) {
            $this->lockAssistantSchedule($assistantUserId);
            $booking = DB::table('booking')->where('id', $bookingId)->lockForUpdate()->first();
            if (! in_array($booking->status, ['pending', 'reschedule_pending'], true)) {
                throw new RuntimeException('BOOKING_NOT_ACTIONABLE');
            }
            $now = time();
            DB::table('booking')->where('id', $bookingId)->update([
                'status' => 'declined',
                'cancelled_at' => $now,
                'cancelled_by_user_id' => $assistantUserId,
                'cancellation_reason' => mb_substr(trim($reason), 0, 2048),
                'first_response_at' => $this->firstResponse($booking, $now),
                'updated_at' => $now,
            ]);
            $this->closePendingReschedules($bookingId, 'rejected');
        }, 3);
        $result = $this->getById($bookingId);

        return $this->notifyAndReturn($result, 'declined');
    }

    public function cancel(int $bookingId, int $userId, string $reason): array
    {
        $policies = PortalPolicy::values();
        $booking = $this->ownedBooking($bookingId, $userId);
        if (! in_array($booking->status, self::ACTIVE_STATUSES, true)) {
            throw new RuntimeException('BOOKING_NOT_ACTIONABLE');
        }

        $now = time();
        $startTimestamp = $this->toTimestamp((string) $booking->booking_date, (string) $booking->start_time);
        $penalty = false;
        $penaltyPoints = 0;
        if ((int) $booking->owner_user_id === $userId) {
            $penalty = ($startTimestamp - $now) <= ($policies['owner_free_cancellation_hours'] * 3600);
            $penaltyPoints = $policies['owner_late_cancellation_penalty'];
        } elseif ((int) $booking->assistant_user_id === $userId) {
            $penalty = $now > (int) $booking->response_deadline;
            $penaltyPoints = $policies['assistant_late_action_penalty'];
        }

        DB::transaction(function () use ($bookingId, $userId, $reason, $penalty, $penaltyPoints) {
            DB::table('booking')->where('id', $bookingId)->update([
                'status' => 'cancelled',
                'cancelled_at' => time(),
                'cancelled_by_user_id' => $userId,
                'cancellation_reason' => mb_substr(trim($reason), 0, 2048),
                'updated_at' => time(),
            ]);
            $this->closePendingReschedules($bookingId, 'rejected');
            if ($penalty && $penaltyPoints > 0) {
                $this->applyReputationDelta($userId, $bookingId, $userId, 'late_cancellation', -$penaltyPoints, 'Annullamento oltre il limite consentito.');
            }
        });

        $result = $this->getById($bookingId);

        return $this->notifyAndReturn($result, 'cancelled');
    }

    public function proposeReschedule(int $bookingId, int $assistantUserId, array $payload): array
    {
        $booking = $this->ownedBooking($bookingId, $assistantUserId, 'pet_assistant');
        if (! in_array($booking->status, ['pending', 'confirmed'], true)) {
            throw new RuntimeException('BOOKING_NOT_ACTIONABLE');
        }

        $slotId = (int) ($payload['slotId'] ?? 0);
        $date = (string) ($payload['date'] ?? '');
        $startTime = (string) ($payload['startTime'] ?? '');
        $endTime = (string) ($payload['endTime'] ?? '');

        DB::transaction(function () use ($bookingId, $assistantUserId, $slotId, $date, $startTime, $endTime, $payload) {
            $this->lockAssistantSchedule($assistantUserId);
            $booking = DB::table('booking')->where('id', $bookingId)->lockForUpdate()->first();
            if (! in_array($booking->status, ['pending', 'confirmed'], true)) {
                throw new RuntimeException('BOOKING_NOT_ACTIONABLE');
            }
            $slot = $this->resolveSlot($slotId, $assistantUserId, (int) $booking->service_id, $date, true);
            $timing = $this->validateRequestedInterval($date, $startTime, $endTime, $slot);
            $this->assertIntervalAvailable($assistantUserId, $date, $startTime, $endTime, $bookingId);
            $this->closePendingReschedules($bookingId, 'rejected');
            $hourPrice = (float) $slot->hour_price;

            DB::table('booking_reschedule')->insert([
                'booking_id' => $bookingId,
                'proposed_by_user_id' => $assistantUserId,
                'source_slot_id' => $slotId,
                'booking_date' => $date,
                'start_time' => $startTime,
                'end_time' => $endTime,
                'duration_minutes' => $timing['durationMinutes'],
                'hour_price' => $hourPrice,
                'total_price' => round($hourPrice * ($timing['durationMinutes'] / 60), 2),
                'message' => mb_substr(trim((string) ($payload['message'] ?? '')), 0, 4096),
                'previous_status' => (string) $booking->status,
                'status' => 'pending',
                'responded_at' => 0,
                'created_at' => time(),
                'updated_at' => time(),
            ]);
            DB::table('booking')->where('id', $bookingId)->update([
                'status' => 'reschedule_pending',
                'first_response_at' => $this->firstResponse($booking, time()),
                'updated_at' => time(),
            ]);
        });

        $result = $this->getById($bookingId);

        return $this->notifyAndReturn($result, 'rescheduled');
    }

    public function respondToReschedule(int $bookingId, int $ownerUserId, bool $accept): array
    {
        $booking = $this->ownedBooking($bookingId, $ownerUserId, 'pet_owner');
        if ($booking->status !== 'reschedule_pending') {
            throw new RuntimeException('RESCHEDULE_NOT_PENDING');
        }
        DB::transaction(function () use ($booking, $bookingId, $accept) {
            $this->lockAssistantSchedule((int) $booking->assistant_user_id);
            $proposal = DB::table('booking_reschedule')
                ->where('booking_id', $bookingId)
                ->where('status', 'pending')
                ->lockForUpdate()
                ->first();
            if (! $proposal) {
                throw new RuntimeException('RESCHEDULE_NOT_PENDING');
            }
            $now = time();
            DB::table('booking_reschedule')->where('id', $proposal->id)->update([
                'status' => $accept ? 'accepted' : 'rejected',
                'responded_at' => $now,
                'updated_at' => $now,
            ]);
            if ($accept) {
                DB::table('booking')->where('id', $bookingId)->update([
                    'source_slot_id' => $proposal->source_slot_id,
                    'booking_date' => $proposal->booking_date,
                    'start_time' => $proposal->start_time,
                    'end_time' => $proposal->end_time,
                    'duration_minutes' => $proposal->duration_minutes,
                    'hour_price' => $proposal->hour_price,
                    'total_price' => $proposal->total_price,
                    'status' => 'confirmed',
                    'accepted_at' => $now,
                    'updated_at' => $now,
                ]);
            } else {
                DB::table('booking')->where('id', $bookingId)->update([
                    'status' => $proposal->previous_status === 'pending' ? 'pending' : 'confirmed',
                    'updated_at' => $now,
                ]);
            }
        });

        $result = $this->getById($bookingId);

        return $this->notifyAndReturn($result, $accept ? 'reschedule_accepted' : 'reschedule_rejected');
    }

    public function review(int $bookingId, int $reviewerUserId, string $sentiment, string $comment, bool $publishComment = false): array
    {
        $policies = PortalPolicy::values();
        $booking = $this->ownedBooking($bookingId, $reviewerUserId);
        if ($booking->status !== 'completed') {
            throw new RuntimeException('BOOKING_NOT_COMPLETED');
        }
        $endTimestamp = $this->toTimestamp((string) $booking->booking_date, (string) $booking->end_time);
        if (time() > $endTimestamp + ($policies['review_window_days'] * 86400)) {
            throw new RuntimeException('REVIEW_WINDOW_EXPIRED');
        }
        if (DB::table('booking_review')->where('booking_id', $bookingId)->where('reviewer_user_id', $reviewerUserId)->exists()) {
            throw new RuntimeException('REVIEW_ALREADY_SENT');
        }

        $reviewedUserId = (int) $booking->owner_user_id === $reviewerUserId
            ? (int) $booking->assistant_user_id
            : (int) $booking->owner_user_id;
        $delta = $sentiment === 'positive'
            ? $policies['positive_review_points']
            : -$policies['negative_review_penalty'];

        DB::transaction(function () use ($bookingId, $reviewerUserId, $reviewedUserId, $sentiment, $comment, $delta, $publishComment, $booking) {
            DB::table('booking_review')->insert([
                'booking_id' => $bookingId,
                'reviewer_user_id' => $reviewerUserId,
                'reviewed_user_id' => $reviewedUserId,
                'sentiment' => $sentiment,
                'comment' => mb_substr(trim($comment), 0, 4096),
                'score_delta' => $delta,
                'publish_comment' => $publishComment && (int) $booking->owner_user_id === $reviewerUserId ? 1 : 0,
                'created_at' => time(),
            ]);
            $this->applyReputationDelta($reviewedUserId, $bookingId, $reviewerUserId, 'review_'.$sentiment, $delta, $comment);
        });

        return $this->getById($bookingId);
    }

    public function setConfirmationMode(int $assistantUserId, string $mode): string
    {
        $this->assertRole($assistantUserId, 'pet_assistant');
        $mode = $mode === 'automatic' ? 'automatic' : 'manual';
        DB::table('operatordata')->where('user_id', $assistantUserId)->update([
            'booking_confirmation_mode' => $mode,
            'updated_at' => time(),
        ]);

        return $mode;
    }

    public function getConfirmationMode(int $assistantUserId): string
    {
        $mode = (string) DB::table('operatordata')->where('user_id', $assistantUserId)->value('booking_confirmation_mode');

        return $mode === 'automatic' ? 'automatic' : 'manual';
    }

    public function getById(int $bookingId): array
    {
        $row = $this->baseQuery()->where('booking.id', $bookingId)->first();
        if (! $row) {
            throw new RuntimeException('BOOKING_NOT_FOUND');
        }

        return $this->mapBooking($row, 0);
    }

    public function getAlternativeSlots(int $bookingId, int $assistantUserId): array
    {
        $booking = $this->ownedBooking($bookingId, $assistantUserId, 'pet_assistant');
        $startDate = (new DateTimeImmutable('tomorrow', $this->timezone))->modify('+1 day')->format('Y-m-d');
        $endDate = (new DateTimeImmutable($startDate, $this->timezone))->modify('+62 days')->format('Y-m-d');

        return DB::table('calendar_day_slot as slot')
            ->join('calendar_day as day', 'day.id', '=', 'slot.calendar_day_id')
            ->join('calendar_day_slot_service as slot_service', 'slot_service.slot_id', '=', 'slot.id')
            ->where('day.user_id', $assistantUserId)
            ->whereBetween('day.date', [$startDate, $endDate])
            ->where('day.enabled', 1)
            ->where('slot.enabled', 1)
            ->where('slot_service.enabled', 1)
            ->where('slot_service.service_id', (int) $booking->service_id)
            ->orderBy('day.date')
            ->orderBy('slot.start_time')
            ->limit(120)
            ->get(['slot.id', 'day.date', 'slot.start_time', 'slot.end_time', 'slot_service.hour_price'])
            ->filter(fn ($row) => ($this->timeToMinutes((string) $row->end_time) - $this->timeToMinutes((string) $row->start_time)) >= (int) $booking->duration_minutes)
            ->filter(function ($row) use ($assistantUserId, $booking) {
                $endTime = $this->minutesToTime($this->timeToMinutes((string) $row->start_time) + (int) $booking->duration_minutes);
                try {
                    $this->assertIntervalAvailable($assistantUserId, (string) $row->date, (string) $row->start_time, $endTime, (int) $booking->id);

                    return true;
                } catch (RuntimeException) {
                    return false;
                }
            })
            ->map(fn ($row) => [
                'slotId' => (int) $row->id,
                'date' => (string) $row->date,
                'startTime' => (string) $row->start_time,
                'endTime' => (string) $row->end_time,
                'hourlyRate' => round((float) $row->hour_price, 2),
            ])
            ->all();
    }

    public function createActionToken(int $bookingId, int $userId, string $action, int $expiresAt): string
    {
        $token = bin2hex(random_bytes(32));
        DB::table('booking_action_token')->insert([
            'booking_id' => $bookingId,
            'user_id' => $userId,
            'action' => $action,
            'token_hash' => hash('sha256', $token),
            'expires_at' => $expiresAt,
            'used_at' => 0,
            'created_at' => time(),
        ]);

        return $token;
    }

    public function resolveActionToken(string $token): array
    {
        $row = DB::table('booking_action_token')
            ->where('token_hash', hash('sha256', $token))
            ->where('used_at', 0)
            ->where('expires_at', '>', time())
            ->first();
        if (! $row) {
            throw new RuntimeException('ACTION_TOKEN_INVALID');
        }

        return ['id' => (int) $row->id, 'bookingId' => (int) $row->booking_id, 'userId' => (int) $row->user_id, 'action' => (string) $row->action];
    }

    public function consumeCancelToken(string $token): array
    {
        $action = $this->resolveActionToken($token);
        if ($action['action'] !== 'cancel') {
            throw new RuntimeException('ACTION_TOKEN_INVALID');
        }
        $result = $this->cancel($action['bookingId'], $action['userId'], 'Annullamento richiesto tramite email.');
        DB::table('booking_action_token')->where('id', $action['id'])->update(['used_at' => time()]);

        return $result;
    }

    private function nextBookingNumber(int $year): string
    {
        DB::table('booking_counter')->insertOrIgnore(['year' => $year, 'last_value' => 0, 'updated_at' => time()]);
        $counter = DB::table('booking_counter')->where('year', $year)->lockForUpdate()->first();
        $next = ((int) $counter->last_value) + 1;
        DB::table('booking_counter')->where('year', $year)->update(['last_value' => $next, 'updated_at' => time()]);

        return sprintf('%04d-%06d', $year, $next);
    }

    private function resolveSlot(int $slotId, int $assistantUserId, int $serviceId, string $date, bool $lock): object
    {
        $query = DB::table('calendar_day_slot as slot')
            ->join('calendar_day as day', 'day.id', '=', 'slot.calendar_day_id')
            ->join('calendar_day_slot_service as slot_service', 'slot_service.slot_id', '=', 'slot.id')
            ->select(['slot.id', 'slot.start_time', 'slot.end_time', 'slot_service.hour_price'])
            ->where('slot.id', $slotId)
            ->where('day.user_id', $assistantUserId)
            ->where('day.date', $date)
            ->where('day.enabled', 1)
            ->where('slot.enabled', 1)
            ->where('slot_service.enabled', 1)
            ->where('slot_service.service_id', $serviceId);
        if ($lock) {
            $query->lockForUpdate();
        }
        $slot = $query->first();
        if (! $slot) {
            throw new RuntimeException('SLOT_NOT_AVAILABLE');
        }

        return $slot;
    }

    private function resolvePreferredFeatures(int $assistantUserId, int $serviceId, array $featureIds): array
    {
        if ($featureIds === []) {
            return [];
        }

        $features = DB::table('operatorservicefeaturedata as selected')
            ->join('servicefeature as feature', 'feature.id', '=', 'selected.feature_id')
            ->where('selected.user_id', $assistantUserId)
            ->where('selected.service_id', $serviceId)
            ->whereIn('selected.feature_id', $featureIds)
            ->orderBy('feature.name')
            ->get(['feature.id', 'feature.name'])
            ->all();
        if (count($features) !== count($featureIds)) {
            throw new RuntimeException('BOOKING_FEATURE_NOT_AVAILABLE');
        }

        return $features;
    }

    private function validateRequestedInterval(string $date, string $startTime, string $endTime, object $slot): array
    {
        $policies = PortalPolicy::values();
        $startTimestamp = $this->toTimestamp($date, $startTime);
        $endTimestamp = $this->toTimestamp($date, $endTime);
        $slotStart = $this->toTimestamp($date, (string) $slot->start_time);
        $slotEnd = $this->toTimestamp($date, (string) $slot->end_time);
        $duration = (int) (($endTimestamp - $startTimestamp) / 60);

        if ($startTimestamp < time() + ($policies['booking_min_notice_hours'] * 3600)) {
            throw new RuntimeException('BOOKING_MINIMUM_NOTICE');
        }
        if ($startTimestamp < $slotStart || $endTimestamp > $slotEnd || $duration < 30 || $duration > $policies['max_booking_duration_minutes'] || $duration % 30 !== 0) {
            throw new RuntimeException('INVALID_BOOKING_INTERVAL');
        }

        return ['startTimestamp' => $startTimestamp, 'endTimestamp' => $endTimestamp, 'durationMinutes' => $duration];
    }

    private function assertIntervalAvailable(int $assistantUserId, string $date, string $startTime, string $endTime, int $excludeBookingId = 0): void
    {
        $query = DB::table('booking')
            ->where('assistant_user_id', $assistantUserId)
            ->where('booking_date', $date)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime);
        if ($excludeBookingId > 0) {
            $query->where('id', '<>', $excludeBookingId);
        }
        if ($query->exists()) {
            throw new RuntimeException('BOOKING_OVERLAP');
        }

        $proposalQuery = DB::table('booking_reschedule as proposal')
            ->join('booking', 'booking.id', '=', 'proposal.booking_id')
            ->where('booking.assistant_user_id', $assistantUserId)
            ->where('proposal.booking_date', $date)
            ->where('proposal.status', 'pending')
            ->where('proposal.start_time', '<', $endTime)
            ->where('proposal.end_time', '>', $startTime);
        if ($excludeBookingId > 0) {
            $proposalQuery->where('proposal.booking_id', '<>', $excludeBookingId);
        }
        if ($proposalQuery->exists()) {
            throw new RuntimeException('BOOKING_OVERLAP');
        }
    }

    private function applyReputationDelta(int $userId, int $bookingId, int $actorUserId, string $type, int $delta, string $note): void
    {
        DB::table('user_reputation')->insertOrIgnore(['user_id' => $userId, 'score' => PortalPolicy::value('initial_reputation_score'), 'updated_at' => time()]);
        $row = DB::table('user_reputation')->where('user_id', $userId)->lockForUpdate()->first();
        $score = max(0, min(100, ((int) $row->score) + $delta));
        DB::table('user_reputation')->where('user_id', $userId)->update(['score' => $score, 'updated_at' => time()]);
        DB::table('reputation_event')->insert([
            'user_id' => $userId,
            'booking_id' => $bookingId,
            'actor_user_id' => $actorUserId,
            'event_type' => $type,
            'delta' => $delta,
            'score_after' => $score,
            'note' => mb_substr(trim($note), 0, 2048),
            'created_at' => time(),
        ]);
    }

    private function baseQuery()
    {
        return DB::table('booking')
            ->join('users as owner', 'owner.id', '=', 'booking.owner_user_id')
            ->join('users as assistant', 'assistant.id', '=', 'booking.assistant_user_id')
            ->join('ownerpet as pet', 'pet.id', '=', 'booking.pet_id')
            ->join('service', 'service.id', '=', 'booking.service_id')
            ->leftJoin('user_reputation as owner_rep', 'owner_rep.user_id', '=', 'owner.id')
            ->leftJoin('user_reputation as assistant_rep', 'assistant_rep.user_id', '=', 'assistant.id')
            ->select([
                'booking.*',
                'owner.name as owner_name', 'owner.email as owner_email',
                'assistant.name as assistant_name', 'assistant.email as assistant_email',
                'pet.name as pet_name', 'service.name as service_name',
                DB::raw('COALESCE(owner_rep.score, 60) as owner_score'),
                DB::raw('COALESCE(assistant_rep.score, 60) as assistant_score'),
            ]);
    }

    private function mapBooking(object $row, int $currentUserId): array
    {
        $reviewWindowDays = PortalPolicy::value('review_window_days');
        $proposal = DB::table('booking_reschedule')->where('booking_id', $row->id)->orderByDesc('id')->first();
        $reviewSent = $currentUserId > 0 && DB::table('booking_review')
            ->where('booking_id', $row->id)
            ->where('reviewer_user_id', $currentUserId)
            ->exists();
        $endTimestamp = $this->toTimestamp((string) $row->booking_date, (string) $row->end_time);

        return [
            'id' => (int) $row->id,
            'bookingNumber' => (string) $row->booking_number,
            'ownerUserId' => (int) $row->owner_user_id,
            'assistantUserId' => (int) $row->assistant_user_id,
            'ownerName' => (string) $row->owner_name,
            'assistantName' => (string) $row->assistant_name,
            'petId' => (int) $row->pet_id,
            'petName' => (string) $row->pet_name,
            'serviceId' => (int) $row->service_id,
            'serviceName' => (string) $row->service_name,
            'slotId' => (int) $row->source_slot_id,
            'date' => (string) $row->booking_date,
            'startTime' => (string) $row->start_time,
            'endTime' => (string) $row->end_time,
            'durationMinutes' => (int) $row->duration_minutes,
            'hourPrice' => round((float) $row->hour_price, 2),
            'totalPrice' => round((float) $row->total_price, 2),
            'message' => (string) $row->message,
            'preferredFeatures' => DB::table('booking_feature_preference')
                ->where('booking_id', $row->id)
                ->orderBy('id')
                ->get(['feature_id', 'feature_name_snapshot'])
                ->map(fn ($feature) => [
                    'id' => (int) $feature->feature_id,
                    'name' => (string) $feature->feature_name_snapshot,
                ])
                ->all(),
            'confirmationMode' => (string) $row->confirmation_mode,
            'status' => (string) $row->status,
            'responseDeadline' => (int) $row->response_deadline,
            'cancelledByUserId' => (int) $row->cancelled_by_user_id,
            'cancellationReason' => (string) $row->cancellation_reason,
            'ownerScore' => (int) $row->owner_score,
            'assistantScore' => (int) $row->assistant_score,
            'canReview' => $currentUserId > 0 && $row->status === 'completed' && ! $reviewSent && time() <= $endTimestamp + ($reviewWindowDays * 86400),
            'reviewSent' => $reviewSent,
            'reschedule' => $proposal ? [
                'id' => (int) $proposal->id,
                'date' => (string) $proposal->booking_date,
                'startTime' => (string) $proposal->start_time,
                'endTime' => (string) $proposal->end_time,
                'durationMinutes' => (int) $proposal->duration_minutes,
                'totalPrice' => round((float) $proposal->total_price, 2),
                'message' => (string) $proposal->message,
                'status' => (string) $proposal->status,
            ] : null,
        ];
    }

    private function ownedBooking(int $bookingId, int $userId, ?string $requiredRole = null): object
    {
        if ($requiredRole !== null) {
            $this->assertRole($userId, $requiredRole);
        }
        $booking = DB::table('booking')->where('id', $bookingId)->first();
        if (! $booking || ! in_array($userId, [(int) $booking->owner_user_id, (int) $booking->assistant_user_id], true)) {
            throw new RuntimeException('BOOKING_NOT_FOUND');
        }

        return $booking;
    }

    private function closePendingReschedules(int $bookingId, string $status): void
    {
        DB::table('booking_reschedule')->where('booking_id', $bookingId)->where('status', 'pending')->update([
            'status' => $status,
            'responded_at' => time(),
            'updated_at' => time(),
        ]);
    }

    private function assertRole(int $userId, string $role): void
    {
        if ($this->getRole($userId) !== $role) {
            throw new RuntimeException('INVALID_ROLE');
        }
    }

    private function getRole(int $userId): string
    {
        return (string) DB::table('users')->where('id', $userId)->value('role');
    }

    private function toTimestamp(string $date, string $time): int
    {
        $value = DateTimeImmutable::createFromFormat('!Y-m-d H:i', $date.' '.$time, $this->timezone);
        if (! $value) {
            throw new RuntimeException('INVALID_BOOKING_INTERVAL');
        }

        return $value->getTimestamp();
    }

    private function timeToMinutes(string $time): int
    {
        [$hours, $minutes] = array_map('intval', explode(':', $time));

        return ($hours * 60) + $minutes;
    }

    private function minutesToTime(int $minutes): string
    {
        return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
    }

    private function notifyAndReturn(array $booking, string $event): array
    {
        $booking['notificationWarning'] = ! $this->sendLifecycleEmails($booking, $event);

        return $booking;
    }

    private function sendLifecycleEmails(array $booking, string $event): bool
    {
        try {
            $policies = PortalPolicy::values();
            $row = DB::table('booking')
                ->join('users as owner', 'owner.id', '=', 'booking.owner_user_id')
                ->join('users as assistant', 'assistant.id', '=', 'booking.assistant_user_id')
                ->where('booking.id', $booking['id'])
                ->first(['owner.email as owner_email', 'assistant.email as assistant_email']);
            if (! $row) {
                return false;
            }

            $statusText = $this->bookingStatusLabel((string) $booking['status']);
            $summary = sprintf('%s · %s · %s %s–%s · %s', $booking['petName'], $booking['serviceName'], $booking['date'], $booking['startTime'], $booking['endTime'], number_format($booking['totalPrice'], 2, ',', '.').' €');
            $eventLabel = match ($event) {
                'created' => 'nuova richiesta',
                'accepted' => 'confermata',
                'declined' => 'rifiutata',
                'cancelled' => 'annullata',
                'expired' => 'scaduta',
                'rescheduled' => 'nuova proposta oraria',
                'reschedule_accepted' => 'nuovo orario confermato',
                'reschedule_rejected' => 'nuovo orario rifiutato',
                default => 'aggiornamento',
            };
            $recipients = [
                ['email' => (string) $row->owner_email, 'userId' => (int) $booking['ownerUserId'], 'role' => 'Pet Owner'],
                ['email' => (string) $row->assistant_email, 'userId' => (int) $booking['assistantUserId'], 'role' => 'Pet Assistant'],
            ];
            foreach ($recipients as $recipient) {
                $email = $recipient['email'];
                if (trim($email) === '') {
                    continue;
                }
                $isActionable = in_array($booking['status'], self::ACTIVE_STATUSES, true);
                $cancelUrl = '';
                if ($isActionable) {
                    $token = $this->createActionToken((int) $booking['id'], $recipient['userId'], 'cancel', $this->toTimestamp($booking['date'], $booking['startTime']));
                    $cancelUrl = url('/api/bookings/action/'.$token);
                }
                $isOwnerRecipient = $recipient['role'] === 'Pet Owner';
                $confirmationPolicy = $booking['confirmationMode'] === 'manual'
                    ? ($isOwnerRecipient
                        ? 'Il Pet Assistant deve rispondere entro il '.$this->formatTimestamp((int) $booking['responseDeadline']).'.'
                        : 'Devi rispondere entro il '.$this->formatTimestamp((int) $booking['responseDeadline']).'.')
                    : ($isOwnerRecipient
                        ? 'La prenotazione è confermata automaticamente; il Pet Assistant può annullare senza penalità entro il '.$this->formatTimestamp((int) $booking['responseDeadline']).'.'
                        : 'La prenotazione è confermata automaticamente; puoi annullare senza penalità entro il '.$this->formatTimestamp((int) $booking['responseDeadline']).'.');
                $rolePolicy = $isOwnerRecipient
                    ? 'Puoi annullare senza penalità fino a '.$policies['owner_free_cancellation_hours'].' ore prima; successivamente il ranking diminuisce di '.$policies['owner_late_cancellation_penalty'].' punti.'
                    : 'Il Pet Owner può annullare senza penalità fino a '.$policies['owner_free_cancellation_hours'].' ore prima. Oltre la scadenza prevista, un tuo annullamento comporta una penalità di '.$policies['assistant_late_action_penalty'].' punti.';
                $isCancelled = $event === 'cancelled';
                $cancelledByOwner = (int) ($booking['cancelledByUserId'] ?? 0) === (int) $booking['ownerUserId'];
                $informationText = $confirmationPolicy.' '.$rolePolicy;
                if ($isCancelled) {
                    if ($recipient['role'] === 'Pet Owner') {
                        $informationText = $cancelledByOwner
                            ? 'Abbiamo notificato al Pet Assistant l’annullamento della prenotazione '.$booking['bookingNumber'].'.'
                            : 'Il Pet Assistant ha annullato la prenotazione '.$booking['bookingNumber'].'.';
                    } else {
                        $informationText = $cancelledByOwner
                            ? 'Il Pet Owner ha annullato la prenotazione '.$booking['bookingNumber'].'.'
                            : 'Abbiamo notificato al Pet Owner l’annullamento della prenotazione '.$booking['bookingNumber'].'.';
                    }
                }
                $informationBlock = '<p style="margin:0;font-size:14px;line-height:1.7;color:#425466;">'.e($informationText).'</p>';
                $profileUrl = url($recipient['role'] === 'Pet Owner' ? '/profile/petowner' : '/profile/petassistant');
                $actions = $isActionable
                    ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0 0;">'
                        .'<tr><td style="padding:0 0 12px 0;">'
                            .'<a href="'.e($profileUrl).'" style="display:block;padding:14px 22px;border-radius:999px;background-color:#2F7A4A;background-image:linear-gradient(120deg,#2F7A4A 0%,#1F5FA7 100%);color:#ffffff;text-align:center;text-decoration:none;font-size:15px;font-weight:800;line-height:22px;">'
                                .'<span style="display:inline-block;margin-right:8px;font-size:18px;line-height:18px;vertical-align:-1px;">&#128197;</span>Gestisci prenotazione'
                            .'</a>'
                        .'</td></tr>'
                        .'<tr><td style="padding:0;">'
                            .'<a href="'.e($cancelUrl).'" style="display:block;padding:13px 22px;border:2px solid #b42318;border-radius:999px;background:#ffffff;color:#9f2118;text-align:center;text-decoration:none;font-size:15px;font-weight:800;line-height:22px;">'
                                .'<span style="display:inline-block;margin-right:8px;font-size:20px;line-height:18px;vertical-align:-1px;">&#10005;</span>Annulla prenotazione'
                            .'</a>'
                        .'</td></tr>'
                    .'</table>'
                    : '';
                $html = '<div style="margin:0;padding:28px 16px;background:#f3f5f6;font-family:Arial,sans-serif;color:#333333;">'
                    .'<div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d7e2ea;border-radius:22px;overflow:hidden;box-shadow:0 18px 40px rgba(17,42,77,0.12);">'
                        .'<div style="padding:24px 28px;background-color:#2F7A4A;background-image:linear-gradient(120deg,#2F7A4A 0%,#1F5FA7 100%);">'
                            .'<div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.82);font-weight:700;">Coccole Bestiali</div>'
                            .'<div style="margin-top:8px;font-size:28px;line-height:1.15;color:#ffffff;font-weight:800;">Prenotazione '.e($booking['bookingNumber']).'</div>'
                            .'<div style="margin-top:10px;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.9);">Aggiornamento per il tuo servizio di assistenza.</div>'
                        .'</div>'
                        .'<div style="padding:28px;">'
                            .'<div style="margin-bottom:18px;padding:16px 18px;border:1px solid rgba(31,95,167,0.14);border-radius:16px;background-color:#f3f8f5;background-image:linear-gradient(180deg,rgba(47,122,74,0.08) 0%,rgba(31,95,167,0.08) 100%);">'
                                .'<div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#1F5FA7;font-weight:800;">Stato prenotazione</div>'
                                .'<div style="margin-top:6px;font-size:18px;line-height:1.4;color:#17324d;font-weight:800;">'.e($statusText).'</div>'
                            .'</div>'
                            .'<div style="margin-bottom:18px;padding:16px 18px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;">'
                                .'<div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#2F7A4A;font-weight:800;">Riepilogo</div>'
                                .'<div style="margin-top:7px;font-size:16px;line-height:1.6;color:#253b53;font-weight:700;">'.e($summary).'</div>'
                            .'</div>'
                            .($booking['preferredFeatures'] !== [] ? '<div style="margin-bottom:18px;padding:15px 18px;border-left:4px solid #1F5FA7;border-radius:0 14px 14px 0;background:#f1f6fb;"><div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#1F5FA7;font-weight:800;">Preferenze richieste</div><div style="margin-top:6px;font-size:15px;line-height:1.65;color:#425466;">'.e(implode(' · ', array_column($booking['preferredFeatures'], 'name'))).'</div></div>' : '')
                            .($isCancelled ? $informationBlock : '')
                            .($booking['message'] !== '' ? '<div style="margin-bottom:18px;padding:15px 18px;border-left:4px solid #A7D08C;border-radius:0 14px 14px 0;background:#f6faf3;"><div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#2F7A4A;font-weight:800;">Messaggio</div><div style="margin-top:6px;font-size:15px;line-height:1.65;color:#425466;">'.nl2br(e($booking['message'])).'</div></div>' : '')
                            .(! $isCancelled ? $informationBlock : '')
                            .$actions
                            .'<p style="margin:24px 0 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">Coccole Bestiali · Il tuo pet assistant di fiducia</p>'
                        .'</div>'
                    .'</div>'
                .'</div>';
                Mail::html($html, function ($message) use ($email, $booking, $eventLabel) {
                    $message->from('info@coccolebestiali.it', 'Coccole Bestiali')
                        ->to($email)
                        ->subject('Coccole Bestiali - Prenotazione '.$booking['bookingNumber'].' - '.$eventLabel);
                });
            }

            return true;
        } catch (\Throwable $e) {
            Utility::saveError(['bookingId' => $booking['id'], 'event' => $event], $e->getMessage(), __METHOD__);

            return false;
        }
    }

    private function formatTimestamp(int $timestamp): string
    {
        return (new DateTimeImmutable('@'.$timestamp))
            ->setTimezone($this->timezone)
            ->format('d/m/Y H:i');
    }

    private function bookingStatusLabel(string $status): string
    {
        return match ($status) {
            'pending' => 'IN ATTESA DI ACCETTAZIONE',
            'confirmed' => 'CONFERMATA',
            'reschedule_pending' => 'RIPROGRAMMAZIONE IN ATTESA',
            'declined' => 'RIFIUTATA',
            'cancelled' => 'ANNULLATA',
            'expired' => 'SCADUTA',
            'completed' => 'COMPLETATA',
            default => 'STATO NON DISPONIBILE',
        };
    }
}
