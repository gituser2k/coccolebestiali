<?php

namespace App\Http\Controllers;

use App\Models\AssistantOnboarding;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use RuntimeException;

final class AssistantOnboardingController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'data' => (new AssistantOnboarding)->state($this->userId($request)),
        ]);
    }

    public function start(Request $request): JsonResponse
    {
        try {
            return response()->json([
                'ok' => true,
                'data' => (new AssistantOnboarding)->start($this->userId($request)),
                'message' => 'Percorso Pet Assistant avviato.',
            ]);
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
    }

    public function progress(Request $request): JsonResponse
    {
        $validated = $request->validate(['currentStep' => ['required', 'string', 'in:personal,operator,calendar,review']]);
        try {
            return response()->json([
                'ok' => true,
                'data' => (new AssistantOnboarding)->saveProgress($this->userId($request), (string) $validated['currentStep']),
            ]);
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
    }

    public function activate(Request $request): JsonResponse
    {
        try {
            return response()->json([
                'ok' => true,
                'data' => (new AssistantOnboarding)->activate($this->userId($request)),
                'message' => 'Profilo Pet Assistant pubblicato.',
            ]);
        } catch (RuntimeException $e) {
            return response()->json([
                'ok' => false,
                'message' => $e->getMessage(),
                'data' => (new AssistantOnboarding)->state($this->userId($request)),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
    }

    private function userId(Request $request): int
    {
        return (int) $request->attributes->get('portal_user_id', 0);
    }
}
