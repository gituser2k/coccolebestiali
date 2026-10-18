<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class Admin extends Model
{
    public function getAdminPolicies(): array
    {
        return [
            'policies' => PortalPolicy::adminRows(),
            'history' => DB::table('policy_change_log')
                ->select(['id', 'batch_id', 'changes_json', 'recipient_count', 'delivery_count', 'failure_count', 'created_at'])
                ->orderByDesc('id')
                ->limit(20)
                ->get()
                ->map(function ($row) {
                    $row->changes = json_decode((string) $row->changes_json, true) ?: [];
                    unset($row->changes_json);

                    return $row;
                })
                ->values(),
        ];
    }

    public function saveAdminPolicies(array $submittedValues): array
    {
        $definitions = PortalPolicy::DEFINITIONS;
        $current = PortalPolicy::values();
        $changes = [];

        foreach ($submittedValues as $key => $rawValue) {
            if (! isset($definitions[$key])) {
                continue;
            }
            $value = (int) $rawValue;
            $definition = $definitions[$key];
            if ($value < (int) $definition['min'] || $value > (int) $definition['max']) {
                throw new \InvalidArgumentException('POLICY_VALUE_OUT_OF_RANGE');
            }
            if ($key === 'max_booking_duration_minutes' && $value % 30 !== 0) {
                throw new \InvalidArgumentException('POLICY_DURATION_STEP');
            }
            if ($value !== (int) $current[$key]) {
                $changes[] = [
                    'key' => $key,
                    'label' => $definition['label'],
                    'unit' => $definition['unit'],
                    'oldValue' => (int) $current[$key],
                    'newValue' => $value,
                ];
            }
        }

        if ($changes === []) {
            return ['changed' => false, 'changes' => [], 'recipients' => 0, 'delivered' => 0, 'failed' => 0];
        }

        $batchId = (string) Str::uuid();
        $now = time();
        $recipients = DB::table('users')
            ->whereIn('role', ['pet_owner', 'pet_assistant'])
            ->where('email_verified', 1)
            ->whereNotNull('email')
            ->where('email', '<>', '')
            ->distinct()
            ->pluck('email')
            ->map(static fn ($email) => trim((string) $email))
            ->filter()
            ->values()
            ->all();

        $logId = DB::transaction(function () use ($changes, $batchId, $now, $recipients) {
            foreach ($changes as $change) {
                DB::table('portal_policy')->updateOrInsert(
                    ['policy_key' => $change['key']],
                    ['value' => $change['newValue'], 'updated_at' => $now]
                );
            }

            return (int) DB::table('policy_change_log')->insertGetId([
                'batch_id' => $batchId,
                'changes_json' => json_encode($changes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'recipient_count' => count($recipients),
                'delivery_count' => 0,
                'failure_count' => 0,
                'created_at' => $now,
            ]);
        });

        [$delivered, $failed] = $this->notifyPolicyChanges($batchId, $changes, $recipients);
        DB::table('policy_change_log')->where('id', $logId)->update([
            'delivery_count' => $delivered,
            'failure_count' => $failed,
        ]);

        return [
            'changed' => true,
            'changes' => $changes,
            'recipients' => count($recipients),
            'delivered' => $delivered,
            'failed' => $failed,
        ];
    }

    private function notifyPolicyChanges(string $batchId, array $changes, array $recipients): array
    {
        if ($recipients === []) {
            return [0, 0];
        }

        $rows = implode('', array_map(static function (array $change) {
            return '<tr><td style="padding:10px;border-bottom:1px solid #dce6eb"><strong>'.e($change['label']).'</strong></td>'
                .'<td style="padding:10px;border-bottom:1px solid #dce6eb">'.e($change['oldValue'].' '.$change['unit']).'</td>'
                .'<td style="padding:10px;border-bottom:1px solid #dce6eb;color:#2f7a4a;font-weight:700">'.e($change['newValue'].' '.$change['unit']).'</td></tr>';
        }, $changes));
        $html = '<div style="font-family:Arial,sans-serif;color:#253b53;max-width:720px;margin:auto;padding:30px;border-radius:24px;background:#f3f7fb">'
            .'<h1 style="margin-top:0;color:#2f7a4a">Coccole Bestiali</h1>'
            .'<h2 style="color:#1f5fa7">Aggiornamento delle policy del portale</h2>'
            .'<p>Abbiamo aggiornato alcune condizioni che regolano prenotazioni, cancellazioni, recensioni e ranking.</p>'
            .'<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden"><thead><tr><th style="padding:10px;text-align:left">Policy</th><th style="padding:10px;text-align:left">Prima</th><th style="padding:10px;text-align:left">Adesso</th></tr></thead><tbody>'.$rows.'</tbody></table>'
            .'<p style="font-size:13px;color:#617283">Comunicazione '.$batchId.'. Le nuove policy sono applicate alle operazioni effettuate successivamente alla modifica.</p>'
            .'</div>';

        $delivered = 0;
        $failed = 0;
        foreach (array_chunk($recipients, 50) as $chunk) {
            try {
                Mail::html($html, function ($message) use ($chunk) {
                    $message->from('info@coccolebestiali.it', 'Coccole Bestiali')
                        ->to('info@coccolebestiali.it', 'Coccole Bestiali')
                        ->bcc($chunk)
                        ->subject('Coccole Bestiali - Aggiornamento policy del portale');
                });
                $delivered += count($chunk);
            } catch (\Throwable $exception) {
                $failed += count($chunk);
                Utility::saveError(['recipients' => $chunk, 'batchId' => $batchId], $exception->getMessage(), __METHOD__);
            }
        }

        return [$delivered, $failed];
    }

    public function getAdminErrors()
    {
        return DB::table('error')
            ->select(['id', 'params', 'msg', 'method', 'timestamp'])
            ->orderByDesc('id')
            ->get();
    }

    public function deleteAdminErrorsByIds(array $ids): int
    {
        return DB::table('error')
            ->whereIn('id', $ids)
            ->delete();
    }

    public function getAdminFeatures(): Collection
    {
        return DB::table('servicefeature')
            ->select(['id', 'name'])
            ->orderBy('name')
            ->get();
    }

    public function getAdminPetTypes(): Collection
    {
        return DB::table('pettype')
            ->select(['id', 'name', 'sortorder'])
            ->orderBy('sortorder')
            ->orderBy('name')
            ->get();
    }

    public function getAdminHouseFeatures(): Collection
    {
        return DB::table('housefeature')
            ->select(['id', 'name', 'sortorder'])
            ->orderBy('sortorder')
            ->orderBy('name')
            ->get();
    }

    public function saveAdminFeature(array $params): int
    {
        $now = time();

        if (! empty($params['id'])) {
            DB::table('servicefeature')
                ->where('id', (int) $params['id'])
                ->update([
                    'name' => $params['name'],
                    'updated_at' => $now,
                ]);

            return (int) $params['id'];
        }

        return (int) DB::table('servicefeature')->insertGetId([
            'name' => $params['name'],
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function saveAdminPetType(array $params): int
    {
        $now = time();
        $sortorder = (int) ($params['sortorder'] ?? 0);

        if (! empty($params['id'])) {
            DB::table('pettype')
                ->where('id', (int) $params['id'])
                ->update([
                    'name' => $params['name'],
                    'sortorder' => $sortorder,
                    'updated_at' => $now,
                ]);

            return (int) $params['id'];
        }

        return (int) DB::table('pettype')->insertGetId([
            'name' => $params['name'],
            'sortorder' => $sortorder,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function saveAdminHouseFeature(array $params): int
    {
        $now = time();
        $sortorder = (int) ($params['sortorder'] ?? 0);

        if (! empty($params['id'])) {
            DB::table('housefeature')
                ->where('id', (int) $params['id'])
                ->update([
                    'name' => $params['name'],
                    'sortorder' => $sortorder,
                    'updated_at' => $now,
                ]);

            return (int) $params['id'];
        }

        return (int) DB::table('housefeature')->insertGetId([
            'name' => $params['name'],
            'sortorder' => $sortorder,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function reorderAdminPetTypes(array $ids): void
    {
        DB::transaction(function () use ($ids) {
            $now = time();

            foreach (array_values($ids) as $index => $id) {
                $petTypeId = (int) $id;
                if ($petTypeId <= 0) {
                    continue;
                }

                DB::table('pettype')
                    ->where('id', $petTypeId)
                    ->update([
                        'sortorder' => ($index + 1) * 10,
                        'updated_at' => $now,
                    ]);
            }
        });
    }

    public function reorderAdminHouseFeatures(array $ids): void
    {
        DB::transaction(function () use ($ids) {
            $now = time();

            foreach (array_values($ids) as $index => $id) {
                $houseFeatureId = (int) $id;
                if ($houseFeatureId <= 0) {
                    continue;
                }

                DB::table('housefeature')
                    ->where('id', $houseFeatureId)
                    ->update([
                        'sortorder' => ($index + 1) * 10,
                        'updated_at' => $now,
                    ]);
            }
        });
    }

    public function deleteAdminFeatureById(int $featureId): void
    {
        DB::transaction(function () use ($featureId) {
            DB::table('operatorservicefeaturedata')
                ->where('feature_id', $featureId)
                ->delete();

            DB::table('servicefeaturedata')
                ->where('feature_id', $featureId)
                ->delete();

            DB::table('servicefeature')
                ->where('id', $featureId)
                ->delete();
        });
    }

    public function deleteAdminPetTypeById(int $petTypeId): void
    {
        DB::transaction(function () use ($petTypeId) {
            DB::table('pettypedata')
                ->where('pettype_id', $petTypeId)
                ->delete();

            DB::table('pettype')
                ->where('id', $petTypeId)
                ->delete();
        });
    }

    public function deleteAdminHouseFeatureById(int $houseFeatureId): void
    {
        DB::transaction(function () use ($houseFeatureId) {
            DB::table('housefeaturedata')
                ->where('housefeature_id', $houseFeatureId)
                ->delete();

            DB::table('housefeature')
                ->where('id', $houseFeatureId)
                ->delete();
        });
    }

    public function getAdminServices(): Collection
    {
        return DB::table('service as s')
            ->leftJoin('servicefeaturedata as sfd', 'sfd.service_id', '=', 's.id')
            ->leftJoin('servicefeature as sf', 'sf.id', '=', 'sfd.feature_id')
            ->select([
                's.id',
                's.name',
                's.description',
                DB::raw("GROUP_CONCAT(DISTINCT sf.id ORDER BY sf.name SEPARATOR ',') as feature_ids"),
                DB::raw("GROUP_CONCAT(DISTINCT sf.name ORDER BY sf.name SEPARATOR '||') as feature_names"),
            ])
            ->groupBy('s.id', 's.name', 's.description')
            ->orderBy('s.name')
            ->get();
    }

    public function saveAdminService(array $params): int
    {
        return DB::transaction(function () use ($params) {
            $now = time();
            $serviceId = ! empty($params['id']) ? (int) $params['id'] : 0;

            if ($serviceId > 0) {
                DB::table('service')
                    ->where('id', $serviceId)
                    ->update([
                        'name' => $params['name'],
                        'description' => $params['description'],
                        'updated_at' => $now,
                    ]);
            } else {
                $serviceId = (int) DB::table('service')->insertGetId([
                    'name' => $params['name'],
                    'description' => $params['description'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('servicefeaturedata')
                ->where('service_id', $serviceId)
                ->delete();

            $featureIds = array_values(array_unique(array_map('intval', $params['feature_ids'] ?? [])));
            $rows = [];

            foreach ($featureIds as $featureId) {
                if ($featureId <= 0) {
                    continue;
                }

                $rows[] = [
                    'service_id' => $serviceId,
                    'feature_id' => $featureId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            if ($rows !== []) {
                DB::table('servicefeaturedata')->insert($rows);
            }

            $cleanupQuery = DB::table('operatorservicefeaturedata')
                ->where('service_id', $serviceId);

            if ($featureIds === []) {
                $cleanupQuery->delete();
            } else {
                $cleanupQuery
                    ->whereNotIn('feature_id', $featureIds)
                    ->delete();
            }

            return $serviceId;
        });
    }

    public function deleteAdminServiceById(int $serviceId): void
    {
        DB::transaction(function () use ($serviceId) {
            DB::table('operatorservicefeaturedata')
                ->where('service_id', $serviceId)
                ->delete();

            DB::table('operatorservicedata')
                ->where('service_id', $serviceId)
                ->delete();

            DB::table('servicefeaturedata')
                ->where('service_id', $serviceId)
                ->delete();

            DB::table('service')
                ->where('id', $serviceId)
                ->delete();
        });
    }

    public function detachFeatureFromService(int $serviceId, int $featureId): void
    {
        DB::transaction(function () use ($serviceId, $featureId) {
            DB::table('servicefeaturedata')
                ->where('service_id', $serviceId)
                ->where('feature_id', $featureId)
                ->delete();

            DB::table('operatorservicefeaturedata')
                ->where('service_id', $serviceId)
                ->where('feature_id', $featureId)
                ->delete();
        });
    }

    public function detachFeatureFromAllServices(int $featureId): void
    {
        DB::transaction(function () use ($featureId) {
            DB::table('servicefeaturedata')
                ->where('feature_id', $featureId)
                ->delete();

            DB::table('operatorservicefeaturedata')
                ->where('feature_id', $featureId)
                ->delete();
        });
    }
}
