<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Admin extends Model
{
    public function getAdminErrors()
    {
        return DB::table('error')
            ->select(['id', 'params', 'msg', 'method', 'timestamp'])
            ->orderByDesc('id')
            ->get();
    }
}
