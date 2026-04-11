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
        return DB::table('message as m')
            ->select([
                'm.id',
                'm.name',
                'm.email',
                'm.msg',
                DB::raw('(SELECT mb.method FROM messageback mb WHERE mb.messageid = m.id ORDER BY mb.id DESC LIMIT 1) as replymsg'),
            ])
            ->orderByDesc('m.id')
            ->get();
    }

    public function deleteAdminMessagesByIds(array $ids): int
    {
        return DB::transaction(function () use ($ids) {
            DB::table('messageback')
                ->whereIn('messageid', $ids)
                ->delete();

            return DB::table('message')
                ->whereIn('id', $ids)
                ->delete();
        });
    }

    public function saveMessageBack(int $messageId, string $reply): int
    {
        return DB::table('messageback')->insertGetId([
            'messageid' => $messageId,
            'method' => $reply,
        ]);
    }

    public function getMessageById(int $messageId): ?object
    {
        return DB::table('message')
            ->select(['id', 'name', 'email', 'msg'])
            ->where('id', $messageId)
            ->first();
    }

    public function getLastMessageBackByMessageId(int $messageId): ?string
    {
        $row = DB::table('messageback')
            ->select(['method'])
            ->where('messageid', $messageId)
            ->orderByDesc('id')
            ->first();

        return $row ? (string) $row->method : null;
    }
}
