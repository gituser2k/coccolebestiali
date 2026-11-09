<?php

namespace App\Http\Controllers;

use App\Models\PetAssistantSearch;
use App\Models\PublicPetAssistant;
use DateTimeImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PublicPetAssistantController extends Controller
{
    public function show(Request $request, int $assistantId): JsonResponse
    {
        $profile = (new PublicPetAssistant)->get($assistantId, $this->viewerId($request));
        abort_unless($profile, 404, 'Profilo Pet Assistant non disponibile.');

        return $this->data($profile);
    }

    public function availability(Request $request, int $assistantId): JsonResponse
    {
        abort_unless((new PublicPetAssistant)->exists($assistantId), 404, 'Profilo Pet Assistant non disponibile.');
        $dates = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $days = (new DateTimeImmutable($dates['from']))->diff(new DateTimeImmutable($dates['to']))->days;
        abort_if($days > 62, 422, 'Seleziona un intervallo di massimo 62 giorni.');

        return $this->data((new PetAssistantSearch)->assistantAvailability($assistantId, $dates['from'], $dates['to']));
    }

    public function favorites(Request $request): JsonResponse
    {
        return $this->data((new PublicPetAssistant)->listFavorites($this->requireOwner($request)));
    }

    public function setFavorite(Request $request, int $assistantId): JsonResponse
    {
        $ownerId = $this->requireOwner($request);
        $model = new PublicPetAssistant;
        abort_unless($model->exists($assistantId), 404, 'Profilo Pet Assistant non disponibile.');
        $payload = $request->validate(['favorite' => ['required', 'boolean']]);
        $favorite = (bool) $payload['favorite'];
        $model->setFavorite($ownerId, $assistantId, $favorite);

        return $this->data(['favorite' => $favorite]);
    }

    private function data(array $data): JsonResponse
    {
        return response()->json(['ok' => true, 'data' => $data])->header('Cache-Control', 'private, no-store');
    }

    private function viewerId(Request $request): int
    {
        return (int) $request->session()->get('cb_portal_user_id', 0);
    }

    private function requireOwner(Request $request): int
    {
        $id = $this->viewerId($request);
        abort_if($id <= 0, 401, 'Accedi come Pet Owner per usare i preferiti.');
        abort_unless(DB::table('users')->where('id', $id)->where('role', 'pet_owner')->exists(), 403);

        return $id;
    }
}
