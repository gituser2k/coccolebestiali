<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Utility extends Model
{
    public static function saveError(array $validated, string $errorMessage, string $methodName): bool
    {
        date_default_timezone_set('Europe/Rome');

        $params = json_encode($validated, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $msg = $errorMessage;

        if (strlen($params) > 4096) {
            $params = substr($params, 0, 4096);
        }

        if (strlen($msg) > 4096) {
            $msg = substr($msg, 0, 4096);
        }

        DB::table('error')->insertGetId([
            'params' => $params,
            'msg' => $msg,
            'method' => $methodName,
            'timestamp' => time(),
        ]);

        return true;
    }

}
