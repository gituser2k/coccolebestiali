<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\Utility;
use Exception;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function getAdminErrors(): JsonResponse
    {
        try {
            $m = new Admin();
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

            $m = new Admin();
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
