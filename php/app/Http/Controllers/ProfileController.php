<?php

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Models\Utility;
use DateTimeImmutable;
use Exception;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    private const PORTAL_USER_ID_COOKIE = 'cb_portal_user_id';

    public function getLanguages(): JsonResponse
    {
        try {
            $model = new Profile();

            return response()->json([
                'ok' => true,
                'data' => $model->getLanguages(),
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function getPetAssistantPersonalProfile(Request $request): JsonResponse
    {
        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Sessione utente non disponibile.',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $model = new Profile();
            $profile = $model->getPersonalProfile($userId);

            if ($profile === []) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Utente non trovato.',
                ], Response::HTTP_NOT_FOUND);
            }

            return response()->json([
                'ok' => true,
                'data' => $profile,
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function getPetOwnerPersonalProfile(Request $request): JsonResponse
    {
        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Sessione utente non disponibile.',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $model = new Profile();
            $profile = $model->getPersonalProfile($userId);

            if ($profile === []) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Utente non trovato.',
                ], Response::HTTP_NOT_FOUND);
            }

            return response()->json([
                'ok' => true,
                'data' => $profile,
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function getOperatorOptions(): JsonResponse
    {
        try {
            $model = new Profile();

            return response()->json([
                'ok' => true,
                'data' => $model->getOperatorOptions(),
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [
                    'titles' => [],
                    'breeds' => [],
                    'petTypes' => [],
                    'houseFeatures' => [],
                    'services' => [],
                ],
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [
                    'titles' => [],
                    'breeds' => [],
                    'petTypes' => [],
                    'houseFeatures' => [],
                    'services' => [],
                ],
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function getPetAssistantOperatorProfile(Request $request): JsonResponse
    {
        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Sessione utente non disponibile.',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $model = new Profile();

            return response()->json([
                'ok' => true,
                'data' => $model->getOperatorProfile($userId),
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function savePetAssistantPersonalProfile(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Sessione utente non disponibile.',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $validated = $request->validate([
                'alias' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:255'],
                'name' => ['nullable', 'string', 'max:255'],
                'age' => ['nullable', 'integer', 'min:18', 'max:100'],
                'city' => ['nullable', 'string', 'max:255'],
                'phone' => ['nullable', 'string', 'max:64'],
                'address' => ['nullable', 'string', 'max:255'],
                'addressnumber' => ['nullable', 'string', 'max:64'],
                'languageIds' => ['nullable', 'array'],
                'languageIds.*' => ['required', 'integer', 'min:1'],
                'photo' => ['nullable', 'image', 'max:4096'],
            ]);

            $model = new Profile();
            $current = $model->getPersonalProfile($userId);
            $photoPath = (string) ($current['photo'] ?? '');

            if ($request->hasFile('photo')) {
                if ($photoPath !== '' && ! str_starts_with($photoPath, 'http://') && ! str_starts_with($photoPath, 'https://')) {
                    Storage::disk('public')->delete($photoPath);
                }

                $file = $request->file('photo');
                $filename = 'petassistant-'.$userId.'-'.time().'.'.$file->getClientOriginalExtension();
                $photoPath = $file->storeAs('profile-photos', $filename, 'public');
            }

            $profile = $model->savePersonalProfile($userId, [
                'alias' => (string) $validated['alias'],
                'email' => strtolower((string) $validated['email']),
                'name' => (string) ($validated['name'] ?? ''),
                'age' => isset($validated['age']) ? (int) $validated['age'] : 0,
                'city' => (string) ($validated['city'] ?? ''),
                'phone' => (string) ($validated['phone'] ?? ''),
                'address' => (string) ($validated['address'] ?? ''),
                'addressnumber' => (string) ($validated['addressnumber'] ?? ''),
                'languageIds' => $validated['languageIds'] ?? [],
                'photo' => $photoPath,
            ]);

            return response()->json([
                'ok' => true,
                'data' => $profile,
                'message' => 'Dati personali salvati con successo.',
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'message' => 'Salvataggio non completato.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function changePetAssistantPassword(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Sessione utente non disponibile.',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $validated = $request->validate([
                'email' => ['required', 'email', 'max:255'],
                'password' => [
                    'nullable',
                    'string',
                    'min:10',
                    'max:255',
                    'regex:/[A-Z]/',
                    'regex:/[a-z]/',
                    'regex:/[0-9]/',
                    'regex:/[^A-Za-z0-9\\s]/',
                    'not_regex:/\\s/',
                ],
                'password_confirmation' => ['nullable', 'same:password'],
            ], [
                'password.min' => 'La password deve contenere almeno 10 caratteri.',
                'password.regex' => 'La password deve contenere almeno una maiuscola, una minuscola, un numero e un simbolo.',
                'password.not_regex' => 'La password non puo contenere spazi.',
                'password_confirmation.same' => 'Le password inserite non coincidono.',
            ]);

            $model = new Profile();
            $data = $model->updateUserCredentials(
                $userId,
                strtolower((string) $validated['email']),
                isset($validated['password']) ? (string) $validated['password'] : null
            );

            return response()->json([
                'ok' => true,
                'message' => 'Credenziali aggiornate con successo.',
                'data' => $data,
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'message' => 'Salvataggio credenziali non completato.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function savePetOwnerPersonalProfile(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Sessione utente non disponibile.',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $validated = $request->validate([
                'alias' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:255'],
                'name' => ['nullable', 'string', 'max:255'],
                'age' => ['nullable', 'integer', 'min:18', 'max:100'],
                'city' => ['nullable', 'string', 'max:255'],
                'phone' => ['nullable', 'string', 'max:64'],
                'address' => ['nullable', 'string', 'max:255'],
                'addressnumber' => ['nullable', 'string', 'max:64'],
                'photo' => ['nullable', 'image', 'max:4096'],
            ]);

            $model = new Profile();
            $current = $model->getPersonalProfile($userId);
            $photoPath = (string) ($current['photo'] ?? '');

            if ($request->hasFile('photo')) {
                if ($photoPath !== '' && ! str_starts_with($photoPath, 'http://') && ! str_starts_with($photoPath, 'https://')) {
                    Storage::disk('public')->delete($photoPath);
                }

                $file = $request->file('photo');
                $filename = 'petowner-'.$userId.'-'.time().'.'.$file->getClientOriginalExtension();
                $photoPath = $file->storeAs('profile-photos', $filename, 'public');
            }

            $profile = $model->savePersonalProfile($userId, [
                'alias' => (string) $validated['alias'],
                'email' => strtolower((string) $validated['email']),
                'name' => (string) ($validated['name'] ?? ''),
                'age' => isset($validated['age']) ? (int) $validated['age'] : 0,
                'city' => (string) ($validated['city'] ?? ''),
                'phone' => (string) ($validated['phone'] ?? ''),
                'address' => (string) ($validated['address'] ?? ''),
                'addressnumber' => (string) ($validated['addressnumber'] ?? ''),
                'languageIds' => [],
                'photo' => $photoPath,
            ]);

            return response()->json([
                'ok' => true,
                'data' => $profile,
                'message' => 'Dati personali salvati con successo.',
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'message' => 'Salvataggio non completato.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function changePetOwnerPassword(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Sessione utente non disponibile.',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $validated = $request->validate([
                'email' => ['required', 'email', 'max:255'],
                'password' => [
                    'nullable',
                    'string',
                    'min:10',
                    'max:255',
                    'regex:/[A-Z]/',
                    'regex:/[a-z]/',
                    'regex:/[0-9]/',
                    'regex:/[^A-Za-z0-9\\s]/',
                    'not_regex:/\\s/',
                ],
                'password_confirmation' => ['nullable', 'same:password'],
            ], [
                'password.min' => 'La password deve contenere almeno 10 caratteri.',
                'password.regex' => 'La password deve contenere almeno una maiuscola, una minuscola, un numero e un simbolo.',
                'password.not_regex' => 'La password non puo contenere spazi.',
                'password_confirmation.same' => 'Le password inserite non coincidono.',
            ]);

            $model = new Profile();
            $data = $model->updateUserCredentials(
                $userId,
                strtolower((string) $validated['email']),
                isset($validated['password']) ? (string) $validated['password'] : null
            );

            return response()->json([
                'ok' => true,
                'message' => 'Credenziali aggiornate con successo.',
                'data' => $data,
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'message' => 'Salvataggio credenziali non completato.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function savePetAssistantOperatorProfile(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Sessione utente non disponibile.',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $validated = $request->validate([
                'bio' => ['nullable', 'string', 'max:4096'],
                'experienceYears' => ['nullable', 'integer', 'min:0', 'max:80'],
                'titleIds' => ['nullable', 'array'],
                'titleIds.*' => ['required', 'integer', 'min:1'],
                'dogWeightLimit' => ['nullable', 'integer', 'min:0', 'max:120'],
                'breedIds' => ['nullable', 'array'],
                'breedIds.*' => ['required', 'integer', 'min:1'],
                'petTypeIds' => ['nullable', 'array'],
                'petTypeIds.*' => ['required', 'integer', 'min:1'],
                'houseFeatureIds' => ['nullable', 'array'],
                'houseFeatureIds.*' => ['required', 'integer', 'min:1'],
                'services' => ['nullable', 'array'],
                'services.*.serviceId' => ['required', 'integer', 'min:1'],
                'services.*.hourlyRate' => ['nullable', 'numeric', 'min:0', 'max:9999.99'],
                'services.*.featureIds' => ['nullable', 'array'],
                'services.*.featureIds.*' => ['required', 'integer', 'min:1'],
                'gallery' => ['nullable', 'array'],
                'gallery.*.caption' => ['nullable', 'string', 'max:255'],
                'galleryPhotos' => ['nullable', 'array'],
                'galleryPhotos.*' => ['nullable', 'image', 'max:4096'],
                'existingGallery' => ['nullable', 'array'],
                'existingGallery.*.photo' => ['nullable', 'string', 'max:1024'],
                'existingGallery.*.caption' => ['nullable', 'string', 'max:255'],
            ]);

            $galleryItems = [];
            $existingGallery = $request->input('existingGallery', []);
            if (is_array($existingGallery)) {
                foreach ($existingGallery as $item) {
                    if (! is_array($item)) {
                        continue;
                    }

                    $photo = trim((string) ($item['photo'] ?? ''));
                    $caption = trim((string) ($item['caption'] ?? ''));
                    if ($photo === '') {
                        continue;
                    }

                    $galleryItems[] = [
                        'photo' => $photo,
                        'caption' => $caption,
                    ];
                }
            }

            $galleryMeta = $request->input('gallery', []);
            $galleryPhotos = $request->file('galleryPhotos', []);

            if (is_array($galleryPhotos)) {
                foreach ($galleryPhotos as $index => $file) {
                    if (! $file) {
                        continue;
                    }

                    $filename = 'petassistant-operator-'.$userId.'-'.Str::uuid().'.'.$file->getClientOriginalExtension();
                    $photoPath = $file->storeAs('operator-gallery', $filename, 'public');

                    $caption = '';
                    if (is_array($galleryMeta) && isset($galleryMeta[$index]) && is_array($galleryMeta[$index])) {
                        $caption = trim((string) ($galleryMeta[$index]['caption'] ?? ''));
                    }

                    $galleryItems[] = [
                        'photo' => $photoPath,
                        'caption' => $caption,
                    ];
                }
            }

            $model = new Profile();
            $profile = $model->saveOperatorProfile($userId, [
                'bio' => (string) ($validated['bio'] ?? ''),
                'experienceYears' => isset($validated['experienceYears']) ? (int) $validated['experienceYears'] : 0,
                'titleIds' => $validated['titleIds'] ?? [],
                'dogWeightLimit' => isset($validated['dogWeightLimit']) ? (int) $validated['dogWeightLimit'] : 0,
                'breedIds' => $validated['breedIds'] ?? [],
                'petTypeIds' => $validated['petTypeIds'] ?? [],
                'houseFeatureIds' => $validated['houseFeatureIds'] ?? [],
                'services' => $validated['services'] ?? [],
                'gallery' => $galleryItems,
            ]);

            return response()->json([
                'ok' => true,
                'data' => $profile,
                'message' => 'Dati operatore salvati con successo.',
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'message' => 'Salvataggio non completato.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function getPetAssistantCalendarMonth(Request $request): JsonResponse
    {
        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json(['ok' => false, 'message' => 'Sessione utente non disponibile.'], Response::HTTP_UNAUTHORIZED);
            }

            $year = max(2024, min(2100, (int) $request->query('year', date('Y'))));
            $month = max(1, min(12, (int) $request->query('month', date('n'))));

            $model = new Profile();

            return response()->json([
                'ok' => true,
                'data' => $model->getCalendarMonthOverview($userId, $year, $month),
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function getPetAssistantCalendarDay(Request $request): JsonResponse
    {
        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json(['ok' => false, 'message' => 'Sessione utente non disponibile.'], Response::HTTP_UNAUTHORIZED);
            }

            $date = (string) $request->query('date', '');
            if (! $this->isValidIsoDate($date)) {
                return response()->json(['ok' => false, 'message' => 'Data non valida.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $model = new Profile();

            return response()->json([
                'ok' => true,
                'data' => $model->getCalendarDay($userId, $date),
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function savePetAssistantCalendarDay(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json(['ok' => false, 'message' => 'Sessione utente non disponibile.'], Response::HTTP_UNAUTHORIZED);
            }

            $validated = $request->validate([
                'date' => ['required', 'string'],
                'enabled' => ['required', 'boolean'],
                'slots' => ['nullable', 'array'],
                'slots.*.startTime' => ['required', 'string'],
                'slots.*.endTime' => ['required', 'string'],
                'slots.*.enabled' => ['required', 'boolean'],
                'slots.*.services' => ['nullable', 'array'],
                'slots.*.services.*.serviceId' => ['required', 'integer', 'min:1'],
                'slots.*.services.*.enabled' => ['required', 'boolean'],
                'slots.*.services.*.hourlyRate' => ['nullable', 'numeric', 'min:0', 'max:9999.99'],
            ]);

            if (! $this->isValidIsoDate((string) $validated['date'])) {
                return response()->json(['ok' => false, 'message' => 'Data non valida.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $slots = is_array($validated['slots'] ?? null) ? $validated['slots'] : [];
            $calendarValidationError = $this->validateCalendarSlots($slots);
            if ($calendarValidationError !== null) {
                return response()->json(['ok' => false, 'message' => $calendarValidationError], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $model = new Profile();
            $day = $model->saveCalendarDay($userId, [
                'date' => (string) $validated['date'],
                'enabled' => (bool) $validated['enabled'],
                'slots' => $slots,
            ]);

            return response()->json([
                'ok' => true,
                'data' => $day,
                'message' => 'Disponibilita calendario salvata con successo.',
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function copyPetAssistantCalendarDay(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json(['ok' => false, 'message' => 'Sessione utente non disponibile.'], Response::HTTP_UNAUTHORIZED);
            }

            $validated = $request->validate([
                'sourceDate' => ['required', 'string'],
                'targetDates' => ['required', 'array', 'min:1'],
                'targetDates.*' => ['required', 'string'],
            ]);

            $sourceDate = (string) $validated['sourceDate'];
            if (! $this->isValidIsoDate($sourceDate)) {
                return response()->json(['ok' => false, 'message' => 'Data sorgente non valida.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $targetDates = [];
            foreach ($validated['targetDates'] as $targetDate) {
                $targetDate = (string) $targetDate;
                if (! $this->isValidIsoDate($targetDate)) {
                    return response()->json(['ok' => false, 'message' => 'Una delle date di destinazione non e valida.'], Response::HTTP_UNPROCESSABLE_ENTITY);
                }
                $targetDates[] = $targetDate;
            }

            $model = new Profile();
            $result = $model->copyCalendarDay($userId, $sourceDate, $targetDates);

            return response()->json([
                'ok' => true,
                'data' => $result,
                'message' => 'Disponibilita copiata con successo.',
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function searchItalianCities(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'query' => ['required', 'string', 'min:2', 'max:255'],
            ]);

            $query = trim((string) $validated['query']);
            $dataset = Cache::remember('cb_italian_cities_dataset', 60 * 60 * 24, function () {
                $response = Http::acceptJson()
                    ->timeout(20)
                    ->get('https://cdn.jsdelivr.net/gh/matteocontrini/comuni-json@master/comuni.json');

                if (! $response->ok()) {
                    throw new Exception('CITY_SERVICE_UNAVAILABLE');
                }

                $payload = $response->json();
                if (! is_array($payload)) {
                    throw new Exception('CITY_SERVICE_INVALID_PAYLOAD');
                }

                return $payload;
            });

            $normalizedNeedle = $this->normalizeCitySearchValue($query);
            $results = [];

            foreach ($dataset as $row) {
                if (! is_array($row)) {
                    continue;
                }

                $name = (string) ($row['nome'] ?? '');
                if ($name === '') {
                    continue;
                }

                $province = (string) ($row['sigla'] ?? '');
                $region = (string) (($row['regione']['nome'] ?? $row['regione'] ?? ''));
                $normalizedName = $this->normalizeCitySearchValue($name);

                if (! str_contains($normalizedName, $normalizedNeedle)) {
                    continue;
                }

                $results[] = [
                    'name' => $name,
                    'province' => $province,
                    'region' => $region,
                    'label' => trim($name.($province !== '' ? ' ('.$province.')' : '').($region !== '' ? ' - '.$region : '')),
                ];
            }

            usort($results, function (array $left, array $right) use ($normalizedNeedle) {
                $leftName = $this->normalizeCitySearchValue((string) ($left['name'] ?? ''));
                $rightName = $this->normalizeCitySearchValue((string) ($right['name'] ?? ''));
                $leftStarts = str_starts_with($leftName, $normalizedNeedle) ? 0 : 1;
                $rightStarts = str_starts_with($rightName, $normalizedNeedle) ? 0 : 1;

                if ($leftStarts !== $rightStarts) {
                    return $leftStarts <=> $rightStarts;
                }

                return strcmp((string) ($left['name'] ?? ''), (string) ($right['name'] ?? ''));
            });

            return response()->json([
                'ok' => true,
                'data' => array_slice($results, 0, 12),
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function geocodeItalianAddress(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'city' => ['required', 'string', 'max:255'],
                'address' => ['required', 'string', 'max:255'],
                'addressnumber' => ['required', 'string', 'max:64'],
            ]);

            $city = trim((string) $validated['city']);
            $address = trim((string) $validated['address']);
            $addressNumber = trim((string) $validated['addressnumber']);
            $cacheKey = 'cb_geocode_v2_'.md5($city.'|'.$address.'|'.$addressNumber);

            $result = Cache::remember($cacheKey, 60 * 60 * 24 * 7, function () use ($city, $address, $addressNumber) {
                $street = trim($address.' '.$addressNumber);
                $cityContext = $this->resolveItalianCityContext($city);
                $headers = [
                    'User-Agent' => 'CoccoleBestiali/1.0 (contact: info@coccolebestiali.it)',
                    'Referer' => rtrim((string) config('app.url', 'http://localhost'), '/'),
                ];

                $candidateFeatures = [];
                $candidateFeatures = array_merge(
                    $candidateFeatures,
                    $this->fetchNominatimCandidates(
                        [
                            'format' => 'geocodejson',
                            'addressdetails' => 1,
                            'limit' => 5,
                            'countrycodes' => 'it',
                            'email' => 'info@coccolebestiali.it',
                            'city' => $city,
                            'street' => $street,
                            'state' => (string) ($cityContext['region'] ?? ''),
                        ],
                        $headers
                    )
                );

                $fullTextQuery = trim($street.', '.$city.(isset($cityContext['region']) ? ', '.$cityContext['region'] : '').', Italia');
                $candidateFeatures = array_merge(
                    $candidateFeatures,
                    $this->fetchNominatimCandidates(
                        [
                            'format' => 'geocodejson',
                            'addressdetails' => 1,
                            'limit' => 5,
                            'countrycodes' => 'it',
                            'email' => 'info@coccolebestiali.it',
                            'q' => $fullTextQuery,
                        ],
                        $headers
                    )
                );

                foreach ($candidateFeatures as $feature) {
                    if (! is_array($feature)) {
                        continue;
                    }

                    $normalized = $this->normalizeGeocodeFeature($feature);
                    if (! $this->isMatchingGeocodeCandidate($normalized, $city, $address, $addressNumber)) {
                        continue;
                    }

                    return [
                        'lat' => (float) ($normalized['lat'] ?? 0),
                        'lng' => (float) ($normalized['lng'] ?? 0),
                        'label' => (string) ($normalized['label'] ?? ''),
                    ];
                }

                return [];
            });

            if ($result === [] || ! isset($result['lat'], $result['lng']) || $result['lat'] === 0.0 || $result['lng'] === 0.0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Non è stato possibile identificare le coordinate gps dell\'indirizzo indicato',
                ], Response::HTTP_NOT_FOUND);
            }

            return response()->json([
                'ok' => true,
                'data' => $result,
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'message' => 'Geolocalizzazione non disponibile.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    private function resolveCurrentUserId(Request $request): int
    {
        $requestCookie = (int) $request->cookie(self::PORTAL_USER_ID_COOKIE, 0);
        if ($requestCookie > 0) {
            return $requestCookie;
        }

        $globalCookie = (int) ($_COOKIE[self::PORTAL_USER_ID_COOKIE] ?? 0);
        if ($globalCookie > 0) {
            return $globalCookie;
        }

        $rawCookieHeader = (string) $request->headers->get('cookie', '');
        if ($rawCookieHeader !== '') {
            preg_match('/(?:^|;\s*)'.preg_quote(self::PORTAL_USER_ID_COOKIE, '/').'=(\d+)/', $rawCookieHeader, $matches);
            if (isset($matches[1])) {
                return (int) $matches[1];
            }
        }

        return 0;
    }

    private function normalizeCitySearchValue(string $value): string
    {
        $normalized = mb_strtolower(trim($value));
        $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $normalized);

        return $transliterated !== false ? $transliterated : $normalized;
    }

    private function fetchNominatimCandidates(array $query, array $headers): array
    {
        $filteredQuery = array_filter($query, static fn ($value) => $value !== null && $value !== '');
        $response = Http::acceptJson()
            ->withHeaders($headers)
            ->timeout(20)
            ->get('https://nominatim.openstreetmap.org/search', $filteredQuery);

        if (! $response->ok()) {
            throw new Exception('GEOCODING_SERVICE_UNAVAILABLE');
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            return [];
        }

        if (($payload['type'] ?? '') === 'FeatureCollection' && isset($payload['features']) && is_array($payload['features'])) {
            return $payload['features'];
        }

        return [];
    }

    private function normalizeGeocodeFeature(array $feature): array
    {
        $geocoding = $feature['properties']['geocoding'] ?? [];
        $coordinates = $feature['geometry']['coordinates'] ?? [];

        return [
            'lat' => isset($coordinates[1]) ? (float) $coordinates[1] : 0,
            'lng' => isset($coordinates[0]) ? (float) $coordinates[0] : 0,
            'label' => (string) ($geocoding['label'] ?? ''),
            'street' => (string) ($geocoding['street'] ?? ''),
            'housenumber' => (string) ($geocoding['housenumber'] ?? ''),
            'city' => (string) ($geocoding['city'] ?? ''),
            'town' => (string) ($geocoding['town'] ?? ''),
            'village' => (string) ($geocoding['village'] ?? ''),
            'municipality' => (string) ($geocoding['municipality'] ?? ''),
            'locality' => (string) ($geocoding['locality'] ?? ''),
            'district' => (string) ($geocoding['district'] ?? ''),
            'admin_level8' => (string) (($geocoding['admin']['level8'] ?? '')),
        ];
    }

    private function isMatchingGeocodeCandidate(array $candidate, string $city, string $address, string $addressNumber): bool
    {
        if (($candidate['lat'] ?? 0) === 0.0 || ($candidate['lng'] ?? 0) === 0.0) {
            return false;
        }

        $selectedCity = $this->normalizeLooseText($city);
        $selectedStreet = $this->normalizeLooseText($address);
        $selectedNumber = $this->normalizeCompactText($addressNumber);

        $candidateCities = array_filter([
            $candidate['city'] ?? '',
            $candidate['town'] ?? '',
            $candidate['village'] ?? '',
            $candidate['municipality'] ?? '',
            $candidate['locality'] ?? '',
            $candidate['district'] ?? '',
            $candidate['admin_level8'] ?? '',
        ]);

        $cityMatches = false;
        foreach ($candidateCities as $candidateCity) {
            if ($this->normalizeLooseText((string) $candidateCity) === $selectedCity) {
                $cityMatches = true;
                break;
            }
        }

        if (! $cityMatches) {
            return false;
        }

        if ($this->normalizeCompactText((string) ($candidate['housenumber'] ?? '')) !== $selectedNumber) {
            return false;
        }

        return $this->streetsLookEquivalent(
            $selectedStreet,
            $this->normalizeLooseText((string) ($candidate['street'] ?? ''))
        );
    }

    private function streetsLookEquivalent(string $selectedStreet, string $candidateStreet): bool
    {
        if ($selectedStreet === '' || $candidateStreet === '') {
            return false;
        }

        if ($selectedStreet === $candidateStreet) {
            return true;
        }

        $selectedTokens = $this->extractSignificantStreetTokens($selectedStreet);
        $candidateTokens = $this->extractSignificantStreetTokens($candidateStreet);

        if ($selectedTokens === [] || $candidateTokens === []) {
            return false;
        }

        return count(array_diff($selectedTokens, $candidateTokens)) === 0;
    }

    private function extractSignificantStreetTokens(string $value): array
    {
        $normalized = $this->normalizeLooseText($value);
        $tokens = preg_split('/\s+/', $normalized) ?: [];
        $ignored = [
            'via',
            'viale',
            'piazza',
            'piazzale',
            'corso',
            'largo',
            'vicolo',
            'strada',
            'lungomare',
            'contrada',
            'localita',
            'loc',
            'rotatoria',
        ];

        return array_values(array_filter($tokens, static function (string $token) use ($ignored) {
            return $token !== '' && ! in_array($token, $ignored, true);
        }));
    }

    private function normalizeLooseText(string $value): string
    {
        $normalized = $this->normalizeCitySearchValue($value);
        $normalized = preg_replace('/[^a-z0-9\s]/', ' ', $normalized) ?? $normalized;

        return trim((string) preg_replace('/\s+/', ' ', $normalized));
    }

    private function isValidIsoDate(string $value): bool
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return false;
        }

        $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);

        return $date instanceof DateTimeImmutable && $date->format('Y-m-d') === $value;
    }

    private function validateCalendarSlots(array $slots): ?string
    {
        $ranges = [];

        foreach ($slots as $slot) {
            if (! is_array($slot)) {
                return 'Formato fascia oraria non valido.';
            }

            $startTime = (string) ($slot['startTime'] ?? '');
            $endTime = (string) ($slot['endTime'] ?? '');
            if (! preg_match('/^\d{2}:\d{2}$/', $startTime) || ! preg_match('/^\d{2}:\d{2}$/', $endTime)) {
                return 'Ogni fascia deve avere orari validi nel formato HH:MM.';
            }

            if ($startTime >= $endTime) {
                return "L'orario di fine deve essere successivo all'orario di inizio.";
            }

            $isEnabled = (bool) ($slot['enabled'] ?? false);
            $services = $slot['services'] ?? [];
            if ($isEnabled && (! is_array($services) || count($services) === 0)) {
                return 'Seleziona almeno un servizio per ogni fascia attiva prima di salvare.';
            }

            $ranges[] = [$startTime, $endTime];
        }

        usort($ranges, static fn (array $a, array $b) => strcmp($a[0], $b[0]));
        for ($index = 1; $index < count($ranges); $index += 1) {
            if ($ranges[$index][0] < $ranges[$index - 1][1]) {
                return 'Le fasce orarie dello stesso giorno non possono sovrapporsi.';
            }
        }

        return null;
    }

    private function normalizeCompactText(string $value): string
    {
        $normalized = $this->normalizeCitySearchValue($value);

        return (string) preg_replace('/[^a-z0-9]/', '', $normalized);
    }

    private function resolveItalianCityContext(string $city): array
    {
        $dataset = Cache::remember('cb_italian_cities_dataset', 60 * 60 * 24, function () {
            $response = Http::acceptJson()
                ->timeout(20)
                ->get('https://cdn.jsdelivr.net/gh/matteocontrini/comuni-json@master/comuni.json');

            if (! $response->ok()) {
                throw new Exception('CITY_SERVICE_UNAVAILABLE');
            }

            $payload = $response->json();
            if (! is_array($payload)) {
                throw new Exception('CITY_SERVICE_INVALID_PAYLOAD');
            }

            return $payload;
        });

        $needle = $this->normalizeCitySearchValue($city);
        foreach ($dataset as $row) {
            if (! is_array($row)) {
                continue;
            }

            $name = (string) ($row['nome'] ?? '');
            if ($name === '' || $this->normalizeCitySearchValue($name) !== $needle) {
                continue;
            }

            return [
                'province' => (string) ($row['sigla'] ?? ''),
                'region' => (string) (($row['regione']['nome'] ?? $row['regione'] ?? '')),
            ];
        }

        return [];
    }
}
