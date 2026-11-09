<?php

namespace App\Http\Middleware;

use App\Support\AdminSession;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

final class RequireAdminSession
{
    public function handle(Request $request, Closure $next): SymfonyResponse
    {
        if (! AdminSession::authenticated($request)) {
            return response()->json([
                'ok' => false,
                'message' => 'Sessione amministrativa non disponibile.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        return $next($request);
    }
}
