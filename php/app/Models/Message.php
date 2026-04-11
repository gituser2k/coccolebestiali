<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Message extends Model
{
    public function saveMessage(array $params): void
    {
        if (isset($params["id"])) {
            DB::table('message')
                ->where('id', $params['id'])
                ->update([
                    'name' => $params['name'],
                    'email' => $params['email'],
                    'msg' => $params['msg'],
                ]);
        }
        else {
            $id = DB::table('message')->insertGetId([
                'name' => $params['name'],
                'email' => $params['email'],
                'msg' => $params['msg'],
            ]);
        }
    }

    public function getAdminMessages()
    {
        return DB::table('message')
            ->select(['id', 'name', 'email', 'msg'])
            ->orderByDesc('id')
            ->get();
    }
}
