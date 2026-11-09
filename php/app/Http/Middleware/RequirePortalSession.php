<?php

namespace App\Http\Middleware;

use App\Support\PortalSession;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

final class RequirePortalSession
{
    public function handle(Request $request, Closure $next): SymfonyResponse
    {
        $userId = PortalSession::userId($request);
        if ($userId <= 0) {
            return response()->json([
                'ok' => false,
                'message' => 'Sessione utente non disponibile.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $request->attributes->set('portal_user_id', $userId);

        return $next($request);
    }
}
