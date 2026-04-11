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
}
