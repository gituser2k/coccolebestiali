<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Message extends Model
{
    public function saveMessage($params)
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
}
