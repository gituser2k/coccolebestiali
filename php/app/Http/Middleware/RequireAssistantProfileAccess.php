<?php

namespace App\Http\Middleware;

use App\Models\UserCapability;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

final class RequireAssistantProfileAccess
{
    public function handle(Request $request, Closure $next): SymfonyResponse
    {
        $userId = (int) $request->attributes->get('portal_user_id', 0);
        if ($userId <= 0) {
            return response()->json(['ok' => false, 'message' => 'Sessione utente non disponibile.'], Response::HTTP_UNAUTHORIZED);
        }

        if (! (new UserCapability)->hasAssistantProfileAccess($userId)) {
            return response()->json([
                'ok' => false,
                'message' => 'Avvia prima il percorso Pet Assistant.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
