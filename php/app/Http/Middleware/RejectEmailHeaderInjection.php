<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RejectEmailHeaderInjection
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($this->containsInvalidEmailValue($request->all())) {
            return new JsonResponse([
                'ok' => false,
                'message' => 'Indirizzo email non valido.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return $next($request);
    }

    private function containsInvalidEmailValue(array $values): bool
    {
        foreach ($values as $key => $value) {
            if (is_array($value) && $this->containsInvalidEmailValue($value)) {
                return true;
            }

            if (is_string($key) && str_contains(strtolower($key), 'email') && is_string($value)) {
                if (preg_match('/[\r\n\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value) === 1) {
                    return true;
                }
            }
        }

        return false;
    }
}
