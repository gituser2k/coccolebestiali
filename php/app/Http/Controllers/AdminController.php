<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\DemoData;
use App\Models\Utility;
use Exception;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Throwable;

class AdminController extends Controller
{
    private const ADMIN_SESSION_KEY = 'cb_admin_authenticated';

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:100'],
            'password' => ['required', 'string', 'max:255'],
        ]);
        $expectedUsername = (string) env('CMS_ADMIN_USERNAME', 'coccoadmin');
        $expectedPassword = (string) env('CMS_ADMIN_PASSWORD', 'cocco123.');
        if (! hash_equals($expectedUsername, $validated['username']) || ! hash_equals($expectedPassword, $validated['password'])) {
            return response()->json(['ok' => false, 'message' => 'Credenziali non valide.'], 401);
        }

        $request->session()->put(self::ADMIN_SESSION_KEY, true);
        $request->session()->regenerate();

        return response()->json(['ok' => true]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->session()->forget(self::ADMIN_SESSION_KEY);
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    public function session(Request $request): JsonResponse
    {
        return response()->json(['ok' => (bool) $request->session()->get(self::ADMIN_SESSION_KEY, false)]);
    }

    public function restoreSystemData(Request $request): JsonResponse
    {
        if (! $request->session()->get(self::ADMIN_SESSION_KEY, false)) {
            return response()->json(['ok' => false, 'message' => 'Sessione amministrativa non disponibile.'], 401);
        }

        try {
            return response()->json(['ok' => true, 'data' => (new DemoData)->restoreSystemConfiguration()]);
        } catch (Throwable $exception) {
            Utility::saveError([], $exception->getMessage(), __METHOD__);

            return response()->json(['ok' => false, 'message' => 'Ripristino della configurazione non completato.'], 500);
        }
    }

    public function clearAllData(Request $request): JsonResponse
    {
        if (! $request->session()->get(self::ADMIN_SESSION_KEY, false)) {
            return response()->json(['ok' => false, 'message' => 'Sessione amministrativa non disponibile.'], 401);
        }

        try {
            return response()->json(['ok' => true, 'data' => (new DemoData)->clearAll()]);
        } catch (Throwable $exception) {
            Utility::saveError([], $exception->getMessage(), __METHOD__);

            return response()->json(['ok' => false, 'message' => 'Svuotamento completo del database non riuscito.'], 500);
        }
    }

    public function seedDemoData(Request $request): JsonResponse
    {
        if (! $request->session()->get(self::ADMIN_SESSION_KEY, false)) {
            return response()->json(['ok' => false, 'message' => 'Sessione amministrativa non disponibile.'], 401);
        }

        try {
            return response()->json(['ok' => true, 'data' => (new DemoData)->seed()]);
        } catch (Throwable $exception) {
            Utility::saveError([], $exception->getMessage(), __METHOD__);

            return response()->json(['ok' => false, 'message' => 'Creazione dati demo non completata.'], 500);
        }
    }

    public function getAdminPolicies(Request $request): JsonResponse
    {
        if (! $request->session()->get(self::ADMIN_SESSION_KEY, false)) {
            return response()->json(['ok' => false, 'message' => 'Sessione amministrativa non disponibile.'], 401);
        }
        try {
            return response()->json(['ok' => true, 'data' => (new Admin)->getAdminPolicies()]);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false, 'data' => []], 500);
        }
    }

    public function saveAdminPolicies(Request $request): JsonResponse
    {
        if (! $request->session()->get(self::ADMIN_SESSION_KEY, false)) {
            return response()->json(['ok' => false, 'message' => 'Sessione amministrativa non disponibile.'], 401);
        }
        $validated = $request->validate([
            'values' => ['required', 'array', 'min:1'],
            'values.*' => ['required', 'integer'],
        ]);

        try {
            $result = (new Admin)->saveAdminPolicies($validated['values']);

            return response()->json(['ok' => true, 'data' => $result]);
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'ok' => false,
                'message' => $e->getMessage() === 'POLICY_DURATION_STEP'
                    ? 'La durata massima deve essere un multiplo di 30 minuti.'
                    : 'Uno o più valori non rispettano i limiti previsti.',
            ], 422);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json(['ok' => false, 'message' => 'Aggiornamento policy non completato.'], 500);
        }
    }

    public function getAdminFeatures(): JsonResponse
    {
        try {
            $m = new Admin;
            $rows = $m->getAdminFeatures();

            return response()->json([
                'ok' => true,
                'data' => $rows,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        }
    }

    public function getAdminPetTypes(): JsonResponse
    {
        try {
            $m = new Admin;
            $rows = $m->getAdminPetTypes();

            return response()->json([
                'ok' => true,
                'data' => $rows,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        }
    }

    public function getAdminHouseFeatures(): JsonResponse
    {
        try {
            $m = new Admin;
            $rows = $m->getAdminHouseFeatures();

            return response()->json([
                'ok' => true,
                'data' => $rows,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        }
    }

    public function saveAdminFeature(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'id' => ['nullable', 'integer', 'min:1'],
                'name' => ['required', 'string', 'max:255'],
            ]);

            $m = new Admin;
            $featureId = $m->saveAdminFeature($validated);

            return response()->json([
                'ok' => true,
                'id' => $featureId,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function saveAdminPetType(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'id' => ['nullable', 'integer', 'min:1'],
                'name' => ['required', 'string', 'max:160'],
                'sortorder' => ['nullable', 'integer', 'min:0'],
            ]);

            $m = new Admin;
            $petTypeId = $m->saveAdminPetType($validated);

            return response()->json([
                'ok' => true,
                'id' => $petTypeId,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function saveAdminHouseFeature(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'id' => ['nullable', 'integer', 'min:1'],
                'name' => ['required', 'string', 'max:255'],
                'sortorder' => ['nullable', 'integer', 'min:0'],
            ]);

            $m = new Admin;
            $houseFeatureId = $m->saveAdminHouseFeature($validated);

            return response()->json([
                'ok' => true,
                'id' => $houseFeatureId,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function reorderAdminPetTypes(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'ids' => ['required', 'array', 'min:1'],
                'ids.*' => ['required', 'integer', 'min:1'],
            ]);

            $m = new Admin;
            $m->reorderAdminPetTypes($validated['ids']);

            return response()->json([
                'ok' => true,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function reorderAdminHouseFeatures(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'ids' => ['required', 'array', 'min:1'],
                'ids.*' => ['required', 'integer', 'min:1'],
            ]);

            $m = new Admin;
            $m->reorderAdminHouseFeatures($validated['ids']);

            return response()->json([
                'ok' => true,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function deleteAdminFeature(int $featureId): JsonResponse
    {
        try {
            $m = new Admin;
            $m->deleteAdminFeatureById($featureId);

            return response()->json([
                'ok' => true,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError(['feature_id' => $featureId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError(['feature_id' => $featureId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function deleteAdminPetType(int $petTypeId): JsonResponse
    {
        try {
            $m = new Admin;
            $m->deleteAdminPetTypeById($petTypeId);

            return response()->json([
                'ok' => true,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError(['pettype_id' => $petTypeId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError(['pettype_id' => $petTypeId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function deleteAdminHouseFeature(int $houseFeatureId): JsonResponse
    {
        try {
            $m = new Admin;
            $m->deleteAdminHouseFeatureById($houseFeatureId);

            return response()->json([
                'ok' => true,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError(['housefeature_id' => $houseFeatureId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError(['housefeature_id' => $houseFeatureId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function getAdminServices(): JsonResponse
    {
        try {
            $m = new Admin;
            $rows = $m->getAdminServices()->map(function ($row) {
                $featureIds = trim((string) ($row->feature_ids ?? '')) === ''
                    ? []
                    : array_values(array_filter(array_map('intval', explode(',', (string) $row->feature_ids))));

                $featureNames = trim((string) ($row->feature_names ?? '')) === ''
                    ? []
                    : array_values(array_filter(explode('||', (string) $row->feature_names)));

                return [
                    'id' => (int) $row->id,
                    'name' => (string) $row->name,
                    'description' => (string) $row->description,
                    'requires_home_photo' => (bool) $row->requires_home_photo,
                    'feature_ids' => $featureIds,
                    'feature_names' => $featureNames,
                ];
            })->values();

            return response()->json([
                'ok' => true,
                'data' => $rows,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        }
    }

    public function saveAdminService(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'id' => ['nullable', 'integer', 'min:1'],
                'name' => ['required', 'string', 'max:255'],
                'description' => ['required', 'string', 'max:4096'],
                'requires_home_photo' => ['nullable', 'boolean'],
                'feature_ids' => ['nullable', 'array'],
                'feature_ids.*' => ['integer', 'min:1'],
            ]);

            $validated['feature_ids'] = $validated['feature_ids'] ?? [];
            $validated['requires_home_photo'] = (bool) ($validated['requires_home_photo'] ?? false);

            $m = new Admin;
            $serviceId = $m->saveAdminService($validated);

            return response()->json([
                'ok' => true,
                'id' => $serviceId,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function deleteAdminService(int $serviceId): JsonResponse
    {
        try {
            $m = new Admin;
            $m->deleteAdminServiceById($serviceId);

            return response()->json([
                'ok' => true,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError(['service_id' => $serviceId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError(['service_id' => $serviceId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function detachAdminServiceFeature(int $serviceId, int $featureId): JsonResponse
    {
        try {
            $m = new Admin;
            $m->detachFeatureFromService($serviceId, $featureId);

            return response()->json([
                'ok' => true,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError(['service_id' => $serviceId, 'feature_id' => $featureId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError(['service_id' => $serviceId, 'feature_id' => $featureId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function detachAdminFeatureFromAllServices(int $featureId): JsonResponse
    {
        try {
            $m = new Admin;
            $m->detachFeatureFromAllServices($featureId);

            return response()->json([
                'ok' => true,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError(['feature_id' => $featureId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError(['feature_id' => $featureId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function getAdminErrors(): JsonResponse
    {
        try {
            $m = new Admin;
            $rows = $m->getAdminErrors();

            return response()->json([
                'ok' => true,
                'data' => $rows,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        }
    }

    public function deleteAdminErrors(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'ids' => ['required', 'array', 'min:1'],
                'ids.*' => ['required', 'integer', 'min:1'],
            ]);

            $m = new Admin;
            $deleted = $m->deleteAdminErrorsByIds($validated['ids']);

            return response()->json([
                'ok' => true,
                'deleted' => $deleted,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }
}
