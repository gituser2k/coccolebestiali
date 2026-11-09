<?php

namespace App\Support;

use Illuminate\Http\Request;

final class PortalSession
{
    public const USER_ID_KEY = 'cb_portal_user_id';

    public const LEGACY_ROLE_KEY = 'cb_portal_user_role';

    public static function userId(Request $request): int
    {
        if (! $request->hasSession()) {
            return 0;
        }

        return max(0, (int) $request->session()->get(self::USER_ID_KEY, 0));
    }

    public static function start(Request $request, int $userId): void
    {
        if ($userId <= 0 || ! $request->hasSession()) {
            return;
        }

        $request->session()->regenerate();
        $request->session()->put(self::USER_ID_KEY, $userId);
        $request->session()->forget(self::LEGACY_ROLE_KEY);
    }

    public static function invalidate(Request $request): void
    {
        if (! $request->hasSession()) {
            return;
        }

        $request->session()->forget([self::USER_ID_KEY, self::LEGACY_ROLE_KEY]);
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }
}
