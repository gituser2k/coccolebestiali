<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\Utility;
use Exception;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function saveMessage(Request $request): JsonResponse
    {
        $m = new Message();
        $validated = [];

        try {
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:255'],
                'msg' => ['required', 'string', 'max:4096'],
            ]);

            $m->saveMessage($validated);

            return response()->json([
                'ok' => true,
            ], 200);
        }
        catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);
            
            return response()->json([
                'ok' => false,
            ], 500);
        }
        catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function getAdminMessages(): JsonResponse
    {
        try {
            $m = new Message();
            $rows = $m->getAdminMessages();

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

    public function getAdminErrors(): JsonResponse
    {
        try {
            $m = new Message();
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
