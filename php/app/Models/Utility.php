<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;

final class Utility
{
    public static function saveError(array $validated, string $errorMessage, string $methodName): bool
    {
        $params = json_encode($validated, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';

        DB::table('error')->insert([
            'params' => mb_substr($params, 0, 4096),
            'msg' => mb_substr($errorMessage, 0, 4096),
            'method' => mb_substr($methodName, 0, 255),
            'timestamp' => time(),
        ]);

        return true;
    }
}
