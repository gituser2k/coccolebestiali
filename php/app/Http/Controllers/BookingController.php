<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Utility;
use Exception;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class BookingController extends Controller
{
    private const PORTAL_USER_ID_COOKIE = 'cb_portal_user_id';

    public function index(Request $request): JsonResponse
    {
        return $this->run($request, fn (Booking $model, int $userId) => $model->listForUser($userId));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'assistantUserId' => ['required', 'integer', 'min:1'],
            'petId' => ['required', 'integer', 'min:1'],
            'serviceId' => ['required', 'integer', 'min:1'],
            'slotId' => ['required', 'integer', 'min:1'],
            'date' => ['required', 'date_format:Y-m-d'],
            'startTime' => ['required', 'date_format:H:i'],
            'endTime' => ['required', 'date_format:H:i'],
            'message' => ['nullable', 'string', 'max:4096'],
        ]);

        return $this->run($request, fn (Booking $model, int $userId) => $model->create($userId, $validated), Response::HTTP_CREATED);
    }

    public function accept(Request $request, int $bookingId): JsonResponse
    {
        return $this->run($request, fn (Booking $model, int $userId) => $model->accept($bookingId, $userId));
    }

    public function decline(Request $request, int $bookingId): JsonResponse
    {
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:2048']]);

        return $this->run($request, fn (Booking $model, int $userId) => $model->decline($bookingId, $userId, (string) ($validated['reason'] ?? '')));
    }

    public function cancel(Request $request, int $bookingId): JsonResponse
    {
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:2048']]);

        return $this->run($request, fn (Booking $model, int $userId) => $model->cancel($bookingId, $userId, (string) ($validated['reason'] ?? '')));
    }

    public function proposeReschedule(Request $request, int $bookingId): JsonResponse
    {
        $validated = $request->validate([
            'slotId' => ['required', 'integer', 'min:1'],
            'date' => ['required', 'date_format:Y-m-d'],
            'startTime' => ['required', 'date_format:H:i'],
            'endTime' => ['required', 'date_format:H:i'],
            'message' => ['required', 'string', 'max:4096'],
        ]);

        return $this->run($request, fn (Booking $model, int $userId) => $model->proposeReschedule($bookingId, $userId, $validated));
    }

    public function alternatives(Request $request, int $bookingId): JsonResponse
    {
        return $this->run($request, fn (Booking $model, int $userId) => $model->getAlternativeSlots($bookingId, $userId));
    }

    public function respondReschedule(Request $request, int $bookingId): JsonResponse
    {
        $validated = $request->validate(['accept' => ['required', 'boolean']]);

        return $this->run($request, fn (Booking $model, int $userId) => $model->respondToReschedule($bookingId, $userId, (bool) $validated['accept']));
    }

    public function review(Request $request, int $bookingId): JsonResponse
    {
        $validated = $request->validate([
            'sentiment' => ['required', 'string', 'in:positive,negative'],
            'comment' => ['required', 'string', 'max:4096'],
        ]);

        return $this->run($request, fn (Booking $model, int $userId) => $model->review($bookingId, $userId, $validated['sentiment'], $validated['comment']));
    }

    public function updateConfirmationMode(Request $request): JsonResponse
    {
        $validated = $request->validate(['mode' => ['required', 'string', 'in:manual,automatic']]);

        return $this->run($request, fn (Booking $model, int $userId) => ['mode' => $model->setConfirmationMode($userId, $validated['mode'])]);
    }

    public function showEmailAction(string $token): Response
    {
        try {
            $action = (new Booking)->resolveActionToken($token);
            $booking = (new Booking)->getById($action['bookingId']);
            $html = '<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                .'<title>Conferma annullamento</title><body style="font-family:Arial,sans-serif;background:#edf4f7;color:#253b53;padding:32px">'
                .'<main style="max-width:620px;margin:auto;background:white;padding:32px;border-radius:24px">'
                .'<h1 style="color:#2f7a4a">Conferma annullamento</h1><p>Prenotazione <strong>'.e($booking['bookingNumber']).'</strong></p>'
                .'<p>'.e($booking['serviceName'].' per '.$booking['petName'].' · '.$booking['date'].' '.$booking['startTime'].'–'.$booking['endTime']).'</p>'
                .'<form method="post" action="/api/bookings/action/'.e($token).'"><button style="border:0;border-radius:999px;padding:14px 24px;background:#a82323;color:white;font-weight:bold">Conferma annullamento</button></form>'
                .'</main></body></html>';

            return response($html, Response::HTTP_OK, ['Content-Type' => 'text/html; charset=UTF-8']);
        } catch (Exception) {
            return response('Link non valido o scaduto.', Response::HTTP_GONE);
        }
    }

    public function consumeEmailAction(string $token): Response
    {
        try {
            $booking = (new Booking)->consumeCancelToken($token);

            return response('<!doctype html><html lang="it"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;padding:40px"><h1>Prenotazione annullata</h1><p>La prenotazione '.e($booking['bookingNumber']).' è stata annullata.</p><a href="/">Torna alla Home</a></body></html>', Response::HTTP_OK, ['Content-Type' => 'text/html; charset=UTF-8']);
        } catch (Exception) {
            return response('Link non valido, scaduto o già utilizzato.', Response::HTTP_GONE);
        }
    }

    private function run(Request $request, callable $callback, int $successStatus = Response::HTTP_OK): JsonResponse
    {
        $userId = $this->resolveCurrentUserId($request);
        if ($userId <= 0) {
            return response()->json(['ok' => false, 'message' => 'Sessione utente non disponibile.'], Response::HTTP_UNAUTHORIZED);
        }

        try {
            $model = new Booking;
            $model->reconcile();

            return response()->json(['ok' => true, 'data' => $callback($model, $userId)], $successStatus);
        } catch (ValidationException $e) {
            throw $e;
        } catch (RuntimeException $e) {
            $messages = [
                'INVALID_ROLE' => 'Operazione non disponibile per questo profilo.',
                'PET_NOT_AVAILABLE' => 'Il pet selezionato non è disponibile.',
                'SLOT_NOT_AVAILABLE' => 'La fascia selezionata non è più disponibile.',
                'BOOKING_MINIMUM_NOTICE' => 'La prenotazione richiede almeno 24 ore di anticipo.',
                'INVALID_BOOKING_INTERVAL' => 'Seleziona un intervallo valido a blocchi di 30 minuti.',
                'BOOKING_OVERLAP' => 'La fascia è stata appena prenotata. Scegli un altro orario.',
                'BOOKING_NOT_FOUND' => 'Prenotazione non disponibile.',
                'BOOKING_NOT_PENDING' => 'La prenotazione non è più in attesa.',
                'BOOKING_NOT_ACTIONABLE' => 'La prenotazione non può essere modificata.',
                'BOOKING_RESPONSE_EXPIRED' => 'Il tempo disponibile per rispondere è terminato.',
                'RESCHEDULE_NOT_PENDING' => 'La proposta non è più disponibile.',
                'BOOKING_NOT_COMPLETED' => 'La recensione sarà disponibile al termine del servizio.',
                'REVIEW_WINDOW_EXPIRED' => 'Il periodo disponibile per la recensione è terminato.',
                'REVIEW_ALREADY_SENT' => 'Hai già inviato la recensione per questa prenotazione.',
            ];

            return response()->json(['ok' => false, 'message' => $messages[$e->getMessage()] ?? 'Operazione non completata.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false, 'message' => 'Operazione non completata.'], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false, 'message' => 'Operazione non completata.'], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    private function resolveCurrentUserId(Request $request): int
    {
        $sessionUserId = $request->hasSession() ? (int) $request->session()->get(self::PORTAL_USER_ID_COOKIE, 0) : 0;
        if ($sessionUserId > 0) {
            return $sessionUserId;
        }

        return (int) $request->cookie(self::PORTAL_USER_ID_COOKIE, 0);
    }
}
