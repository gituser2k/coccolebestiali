<?php

namespace App\Http\Middleware;

use App\Models\UserCapability;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

final class RequireActiveCapability
{
    public function handle(Request $request, Closure $next, string $capability): SymfonyResponse
    {
        $userId = (int) $request->attributes->get('portal_user_id', 0);
        if ($userId <= 0) {
            return response()->json([
                'ok' => false,
                'message' => 'Sessione utente non disponibile.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (! (new UserCapability)->hasActive($userId, $capability)) {
            return response()->json([
                'ok' => false,
                'message' => 'Funzionalità non disponibile per questo account.',
            ], Response::HTTP_FORBIDDEN);
        }

        $request->attributes->set('portal_capability', $capability);

        return $next($request);
    }
}
