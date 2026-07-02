<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

class Admin extends Model
{
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
