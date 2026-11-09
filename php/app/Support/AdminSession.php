<?php

namespace App\Support;

use Illuminate\Http\Request;

final class AdminSession
{
    public const KEY = 'cb_admin_authenticated';

    public static function authenticated(Request $request): bool
    {
        return $request->hasSession() && (bool) $request->session()->get(self::KEY, false);
    }

    public static function start(Request $request): void
    {
        $request->session()->regenerate();
        $request->session()->put(self::KEY, true);
    }

    public static function end(Request $request): void
    {
        $request->session()->forget(self::KEY);
        $request->session()->regenerateToken();
    }
}
