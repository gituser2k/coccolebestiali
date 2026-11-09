<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\PetAssistantSearch;
use App\Models\PortalPolicy;
use App\Models\Utility;
use DateTimeImmutable;
use Exception;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use RuntimeException;

class PetAssistantSearchController extends Controller
{
    private const PORTAL_USER_ID_COOKIE = 'cb_portal_user_id';

    public function getOptions(Request $request): JsonResponse
    {
        try {
            $options = (new PetAssistantSearch)->getOptions($this->resolveCurrentUserId($request));
            $options['canFilterFavorites'] = $options['authenticatedRole'] === 'pet_owner'
                && (int) $request->session()->get(self::PORTAL_USER_ID_COOKIE, 0) > 0;

            return response()->json([
                'ok' => true,
                'data' => $options,
            ], Response::HTTP_OK)->header('Cache-Control', 'private, no-store');
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function search(Request $request): JsonResponse
    {
        $validated = [];
        $maximumDuration = PortalPolicy::value('max_booking_duration_minutes');

        try {
            $validated = $request->validate([
                'startDate' => ['required', 'date_format:Y-m-d'],
                'endDate' => ['required', 'date_format:Y-m-d', 'after_or_equal:startDate'],
                'serviceIds' => ['required', 'array', 'min:1', 'max:20'],
                'serviceIds.*' => ['required', 'integer', 'distinct', 'exists:service,id'],
                'petId' => ['nullable', 'integer', 'min:1'],
                'durationMinutes' => ['nullable', 'integer', 'min:30', 'max:'.$maximumDuration, 'multiple_of:30'],
                'sortBy' => ['nullable', 'string', 'in:ranking,distance,cost,cost_desc'],
                'onlyWithPhoto' => ['nullable', 'boolean'],
                'onlyFavorites' => ['nullable', 'boolean'],
                'optionFilters' => ['nullable', 'array', 'max:20'],
                'optionFilters.*.serviceId' => ['required', 'integer', 'distinct', 'exists:service,id'],
                'optionFilters.*.featureIds' => ['required', 'array', 'min:1', 'max:20'],
                'optionFilters.*.featureIds.*' => ['required', 'integer', 'exists:servicefeature,id'],
            ]);

            $onlyFavorites = (bool) ($validated['onlyFavorites'] ?? false);
            $sessionUserId = (int) $request->session()->get(self::PORTAL_USER_ID_COOKIE, 0);
            $userId = $onlyFavorites
                ? $sessionUserId
                : $this->resolveCurrentUserId($request);
            if ($onlyFavorites && $userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Accedi come Pet Owner per cercare tra i preferiti.',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $startDate = new DateTimeImmutable((string) $validated['startDate']);
            $endDate = new DateTimeImmutable((string) $validated['endDate']);
            if ($startDate->diff($endDate)->days > 62) {
                return response()->json([
                    'ok' => false,
                    'message' => 'L’intervallo di ricerca non può superare 62 giorni.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            (new Booking)->reconcile();
            $data = (new PetAssistantSearch)->search(
                $startDate->format('Y-m-d'),
                $endDate->format('Y-m-d'),
                $validated['serviceIds'],
                (int) ($validated['petId'] ?? 0),
                $userId,
                (int) ($validated['durationMinutes'] ?? 60),
                (string) ($validated['sortBy'] ?? 'ranking'),
                (bool) ($validated['onlyWithPhoto'] ?? false),
                $validated['optionFilters'] ?? [],
                $onlyFavorites,
                $sessionUserId > 0
            );

            return response()->json([
                'ok' => true,
                'data' => $data,
            ], Response::HTTP_OK)->header('Cache-Control', 'private, no-store');
        } catch (RuntimeException $e) {
            if ($e->getMessage() === 'FAVORITES_OWNER_REQUIRED') {
                return response()->json([
                    'ok' => false,
                    'message' => 'Il filtro preferiti è disponibile per i Pet Owner.',
                ], Response::HTTP_FORBIDDEN);
            }
            $messages = [
                'PET_OWNER_SESSION_REQUIRED' => 'Accedi come Pet Owner per cercare in base al tuo pet.',
                'PET_NOT_AVAILABLE' => 'Il pet selezionato non è disponibile.',
            ];

            return response()->json([
                'ok' => false,
                'message' => $messages[$e->getMessage()] ?? 'Ricerca non completata.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    private function resolveCurrentUserId(Request $request): int
    {
        $sessionUserId = (int) $request->session()->get(self::PORTAL_USER_ID_COOKIE, 0);
        if ($sessionUserId > 0) {
            return $sessionUserId;
        }

        $requestCookie = (int) $request->cookie(self::PORTAL_USER_ID_COOKIE, 0);

        return $requestCookie > 0 ? $requestCookie : 0;
    }
}
