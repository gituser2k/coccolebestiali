<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class Profile extends Model
{
    public function getPersonalProfile(int $userId): array
    {
        $this->ensureLanguageSeeded();

        $row = DB::table('users')
            ->leftJoin('personaldata', 'personaldata.user_id', '=', 'users.id')
            ->select([
                'users.id',
                'users.name as alias',
                'users.email',
                'users.avatar',
                'personaldata.name',
                'personaldata.photo',
                'personaldata.age',
                'personaldata.city',
                'personaldata.phone',
                'personaldata.address',
                'personaldata.addressnumber',
            ])
            ->where('users.id', $userId)
            ->first();

        if (! $row) {
            return [];
        }

        $languageIds = DB::table('languagedata')
            ->where('user_id', $userId)
            ->orderBy('language_id')
            ->pluck('language_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $photo = (string) ($row->photo ?? '');
        $avatar = (string) ($row->avatar ?? '');
        $photoPath = $photo !== '' ? $photo : $avatar;

        return [
            'alias' => (string) ($row->alias ?? ''),
            'email' => (string) ($row->email ?? ''),
            'name' => (string) ($row->name ?? ''),
            'photo' => $photo,
            'photoUrl' => $this->normalizePhotoUrl($photoPath),
            'age' => (int) ($row->age ?? 0),
            'city' => (string) ($row->city ?? ''),
            'phone' => (string) ($row->phone ?? ''),
            'address' => (string) ($row->address ?? ''),
            'addressnumber' => (string) ($row->addressnumber ?? ''),
            'languageIds' => $languageIds,
        ];
    }

    public function getLanguages(): array
    {
        $this->ensureLanguageSeeded();

        return DB::table('language')
            ->select(['id', 'name'])
            ->orderBy('sortorder')
            ->orderBy('name')
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'name' => (string) $row->name,
            ])
            ->all();
    }

    public function getOperatorOptions(): array
    {
        $this->ensureOperatorMetadataSeeded();

        $services = DB::table('service as s')
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
            ->get()
            ->map(function ($row) {
                $featureIds = trim((string) ($row->feature_ids ?? '')) === ''
                    ? []
                    : array_values(array_filter(array_map('intval', explode(',', (string) $row->feature_ids))));

                $featureNames = trim((string) ($row->feature_names ?? '')) === ''
                    ? []
                    : array_values(array_filter(explode('||', (string) $row->feature_names)));

                $features = [];
                foreach ($featureNames as $index => $featureName) {
                    $featureId = (int) ($featureIds[$index] ?? 0);
                    if ($featureId <= 0) {
                        continue;
                    }

                    $features[] = [
                        'id' => $featureId,
                        'name' => (string) $featureName,
                    ];
                }

                return [
                    'id' => (int) $row->id,
                    'name' => (string) $row->name,
                    'description' => (string) $row->description,
                    'features' => $features,
                ];
            })
            ->all();

        return [
            'titles' => DB::table('operatortitle')
                ->select(['id', 'name'])
                ->orderBy('sortorder')
                ->orderBy('name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'name' => (string) $row->name,
                ])
                ->all(),
            'breeds' => DB::table('dogbreed')
                ->select(['id', 'name'])
                ->orderBy('sortorder')
                ->orderBy('name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'name' => (string) $row->name,
                ])
                ->all(),
            'petTypes' => DB::table('pettype')
                ->select(['id', 'name'])
                ->orderBy('sortorder')
                ->orderBy('name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'name' => (string) $row->name,
                ])
                ->all(),
            'houseFeatures' => DB::table('housefeature')
                ->select(['id', 'name'])
                ->orderBy('sortorder')
                ->orderBy('name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'name' => (string) $row->name,
                ])
                ->all(),
            'services' => $services,
        ];
    }

    public function getOperatorProfile(int $userId): array
    {
        $this->ensureOperatorMetadataSeeded();

        $row = DB::table('operatordata')
            ->select(['bio', 'experience_years', 'dog_weight_limit', 'service_hour_price'])
            ->where('user_id', $userId)
            ->first();

        $titleIds = DB::table('operatortitledata')
            ->where('user_id', $userId)
            ->orderBy('title_id')
            ->pluck('title_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $breedIds = DB::table('dogbreeddata')
            ->where('user_id', $userId)
            ->orderBy('breed_id')
            ->pluck('breed_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $petTypeIds = DB::table('pettypedata')
            ->where('user_id', $userId)
            ->orderBy('pettype_id')
            ->pluck('pettype_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $houseFeatureIds = DB::table('housefeaturedata')
            ->where('user_id', $userId)
            ->orderBy('housefeature_id')
            ->pluck('housefeature_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $gallery = DB::table('operatorgallery')
            ->select(['id', 'photo', 'caption', 'sortorder'])
            ->where('user_id', $userId)
            ->orderBy('sortorder')
            ->orderBy('id')
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'photo' => (string) $row->photo,
                'photoUrl' => $this->normalizePhotoUrl((string) $row->photo),
                'caption' => (string) $row->caption,
                'sortorder' => (int) $row->sortorder,
            ])
            ->all();

        $defaultFeaturesMap = DB::table('servicefeaturedata')
            ->select(['service_id', 'feature_id'])
            ->get()
            ->groupBy('service_id')
            ->map(fn ($rows) => $rows
                ->pluck('feature_id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all()
            );

        $selectedFeaturesMap = DB::table('operatorservicefeaturedata')
            ->select(['service_id', 'feature_id'])
            ->where('user_id', $userId)
            ->get()
            ->groupBy('service_id')
            ->map(fn ($rows) => $rows
                ->pluck('feature_id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all()
            );

        $services = DB::table('operatorservicedata')
            ->select(['service_id', 'hour_price'])
            ->where('user_id', $userId)
            ->orderBy('service_id')
            ->get()
            ->map(fn ($row) => [
                'serviceId' => (int) $row->service_id,
                'hourlyRate' => round((float) ($row->hour_price ?? 0), 2),
                'featureIds' => $selectedFeaturesMap->get((int) $row->service_id, $defaultFeaturesMap->get((int) $row->service_id, [])),
            ])
            ->all();

        return [
            'bio' => (string) ($row->bio ?? ''),
            'experienceYears' => (int) ($row->experience_years ?? 0),
            'titleIds' => $titleIds,
            'dogWeightLimit' => (int) ($row->dog_weight_limit ?? 0),
            'breedIds' => $breedIds,
            'petTypeIds' => $petTypeIds,
            'houseFeatureIds' => $houseFeatureIds,
            'services' => $services,
            'gallery' => $gallery,
        ];
    }

    public function savePersonalProfile(int $userId, array $payload): array
    {
        $now = time();
        $email = strtolower(trim((string) ($payload['email'] ?? '')));

        if ($email !== '') {
            $existingEmailUser = DB::table('users')
                ->select(['id'])
                ->where('email', $email)
                ->where('id', '<>', $userId)
                ->first();

            if ($existingEmailUser) {
                throw new \RuntimeException('Email gia associata a un altro account.');
            }
        }

        DB::transaction(function () use ($userId, $payload, $now, $email) {
            DB::table('users')
                ->where('id', $userId)
                ->update([
                    'name' => (string) ($payload['alias'] ?? ''),
                    'email' => $email,
                    'updated_at' => $now,
                ]);

            $existing = DB::table('personaldata')
                ->select(['id'])
                ->where('user_id', $userId)
                ->first();

            $personalData = [
                'user_id' => $userId,
                'name' => (string) ($payload['name'] ?? ''),
                'photo' => (string) ($payload['photo'] ?? ''),
                'age' => (int) ($payload['age'] ?? 0),
                'city' => (string) ($payload['city'] ?? ''),
                'phone' => (string) ($payload['phone'] ?? ''),
                'address' => (string) ($payload['address'] ?? ''),
                'addressnumber' => (string) ($payload['addressnumber'] ?? ''),
                'updated_at' => $now,
            ];

            if ($existing) {
                DB::table('personaldata')
                    ->where('user_id', $userId)
                    ->update($personalData);
            } else {
                $personalData['created_at'] = $now;
                DB::table('personaldata')->insert($personalData);
            }

            DB::table('languagedata')
                ->where('user_id', $userId)
                ->delete();

            $languageIds = array_values(array_unique(array_map('intval', $payload['languageIds'] ?? [])));
            foreach ($languageIds as $languageId) {
                if ($languageId <= 0) {
                    continue;
                }

                DB::table('languagedata')->insert([
                    'user_id' => $userId,
                    'language_id' => $languageId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        });

        return $this->getPersonalProfile($userId);
    }

    public function updateUserCredentials(int $userId, string $email, ?string $password): array
    {
        $normalizedEmail = strtolower(trim($email));

        $existingEmailUser = DB::table('users')
            ->select(['id'])
            ->where('email', $normalizedEmail)
            ->where('id', '<>', $userId)
            ->first();

        if ($existingEmailUser) {
            throw new \RuntimeException('Email gia associata a un altro account.');
        }

        $updates = [
            'email' => $normalizedEmail,
            'updated_at' => time(),
        ];

        if ($password !== null && $password !== '') {
            $updates['password_hash'] = Hash::make($password);
        }

        DB::table('users')
            ->where('id', $userId)
            ->update($updates);

        return [
            'email' => $normalizedEmail,
        ];
    }

    public function changeUserPassword(int $userId, string $password): void
    {
        $this->updateUserCredentials($userId, $this->getPersonalProfile($userId)['email'] ?? '', $password);
    }

    public function saveOperatorProfile(int $userId, array $payload): array
    {
        $this->ensureOperatorMetadataSeeded();

        $now = time();

        DB::transaction(function () use ($userId, $payload, $now) {
            $existing = DB::table('operatordata')
                ->select(['id'])
                ->where('user_id', $userId)
                ->first();

            $operatorData = [
                'user_id' => $userId,
                'bio' => (string) ($payload['bio'] ?? ''),
                'experience_years' => (int) ($payload['experienceYears'] ?? 0),
                'dog_weight_limit' => (int) ($payload['dogWeightLimit'] ?? 0),
                'updated_at' => $now,
            ];

            if ($existing) {
                DB::table('operatordata')
                    ->where('user_id', $userId)
                    ->update($operatorData);
            } else {
                $operatorData['created_at'] = $now;
                DB::table('operatordata')->insert($operatorData);
            }

            DB::table('operatortitledata')->where('user_id', $userId)->delete();
            $titleIds = array_values(array_unique(array_map('intval', $payload['titleIds'] ?? [])));
            foreach ($titleIds as $titleId) {
                if ($titleId <= 0) {
                    continue;
                }

                DB::table('operatortitledata')->insert([
                    'user_id' => $userId,
                    'title_id' => $titleId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('dogbreeddata')->where('user_id', $userId)->delete();
            $breedIds = array_values(array_unique(array_map('intval', $payload['breedIds'] ?? [])));
            foreach ($breedIds as $breedId) {
                if ($breedId <= 0) {
                    continue;
                }

                DB::table('dogbreeddata')->insert([
                    'user_id' => $userId,
                    'breed_id' => $breedId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('pettypedata')->where('user_id', $userId)->delete();
            $petTypeIds = array_values(array_unique(array_map('intval', $payload['petTypeIds'] ?? [])));
            foreach ($petTypeIds as $petTypeId) {
                if ($petTypeId <= 0) {
                    continue;
                }

                DB::table('pettypedata')->insert([
                    'user_id' => $userId,
                    'pettype_id' => $petTypeId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('housefeaturedata')->where('user_id', $userId)->delete();
            $houseFeatureIds = array_values(array_unique(array_map('intval', $payload['houseFeatureIds'] ?? [])));
            foreach ($houseFeatureIds as $houseFeatureId) {
                if ($houseFeatureId <= 0) {
                    continue;
                }

                DB::table('housefeaturedata')->insert([
                    'user_id' => $userId,
                    'housefeature_id' => $houseFeatureId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('operatorservicedata')->where('user_id', $userId)->delete();
            DB::table('operatorservicefeaturedata')->where('user_id', $userId)->delete();
            $services = is_array($payload['services'] ?? null) ? $payload['services'] : [];
            foreach ($services as $service) {
                if (! is_array($service)) {
                    continue;
                }

                $serviceId = (int) ($service['serviceId'] ?? 0);
                if ($serviceId <= 0) {
                    continue;
                }

                DB::table('operatorservicedata')->insert([
                    'user_id' => $userId,
                    'service_id' => $serviceId,
                    'hour_price' => round((float) ($service['hourlyRate'] ?? 0), 2),
                    'is_exclusive' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $featureIds = array_values(array_unique(array_map('intval', $service['featureIds'] ?? [])));
                foreach ($featureIds as $featureId) {
                    if ($featureId <= 0) {
                        continue;
                    }

                    DB::table('operatorservicefeaturedata')->insert([
                        'user_id' => $userId,
                        'service_id' => $serviceId,
                        'feature_id' => $featureId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            DB::table('operatorgallery')->where('user_id', $userId)->delete();
            $galleryItems = $payload['gallery'] ?? [];
            foreach ($galleryItems as $index => $item) {
                $photo = trim((string) ($item['photo'] ?? ''));
                if ($photo === '') {
                    continue;
                }

                DB::table('operatorgallery')->insert([
                    'user_id' => $userId,
                    'photo' => $photo,
                    'caption' => (string) ($item['caption'] ?? ''),
                    'sortorder' => $index + 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        });

        return $this->getOperatorProfile($userId);
    }

    public function getCalendarMonthOverview(int $userId, int $year, int $month): array
    {
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate = date('Y-m-t', strtotime($startDate));

        $rows = DB::table('calendar_day as cd')
            ->leftJoin('calendar_day_slot as cds', 'cds.calendar_day_id', '=', 'cd.id')
            ->leftJoin('calendar_day_slot_service as cdss', 'cdss.slot_id', '=', 'cds.id')
            ->select([
                'cd.date',
                'cd.enabled',
                DB::raw('COUNT(DISTINCT cds.id) as slot_count'),
                DB::raw('COUNT(DISTINCT CASE WHEN cdss.enabled = 1 THEN CONCAT(cds.id, "-", cdss.service_id) END) as service_count'),
                DB::raw('(SELECT COALESCE(SUM(TIME_TO_SEC(TIMEDIFF(inner_slot.end_time, inner_slot.start_time)) / 60), 0) FROM calendar_day_slot inner_slot WHERE inner_slot.calendar_day_id = cd.id AND inner_slot.enabled = 1) as total_minutes'),
            ])
            ->where('cd.user_id', $userId)
            ->whereBetween('cd.date', [$startDate, $endDate])
            ->groupBy('cd.id', 'cd.date', 'cd.enabled')
            ->get();

        $mapped = [];
        foreach ($rows as $row) {
            $mapped[(string) $row->date] = [
                'date' => (string) $row->date,
                'enabled' => (bool) $row->enabled,
                'slotCount' => (int) $row->slot_count,
                'serviceCount' => (int) $row->service_count,
                'totalMinutes' => (int) $row->total_minutes,
            ];
        }

        $days = [];
        $totalDays = (int) date('t', strtotime($startDate));
        for ($day = 1; $day <= $totalDays; $day += 1) {
            $date = sprintf('%04d-%02d-%02d', $year, $month, $day);
            $days[] = $mapped[$date] ?? [
                'date' => $date,
                'enabled' => false,
                'slotCount' => 0,
                'serviceCount' => 0,
                'totalMinutes' => 0,
            ];
        }

        return [
            'year' => $year,
            'month' => $month,
            'days' => $days,
        ];
    }

    public function getCalendarDay(int $userId, string $date): array
    {
        $day = DB::table('calendar_day')
            ->select(['id', 'date', 'enabled'])
            ->where('user_id', $userId)
            ->where('date', $date)
            ->first();

        if (! $day) {
            return [
                'date' => $date,
                'enabled' => false,
                'slots' => [],
            ];
        }

        $slots = DB::table('calendar_day_slot')
            ->select(['id', 'start_time', 'end_time', 'enabled', 'sortorder'])
            ->where('calendar_day_id', (int) $day->id)
            ->orderBy('sortorder')
            ->orderBy('start_time')
            ->get()
            ->map(function ($slot) {
                $services = DB::table('calendar_day_slot_service')
                    ->select(['service_id', 'enabled', 'hour_price'])
                    ->where('slot_id', (int) $slot->id)
                    ->orderBy('service_id')
                    ->get()
                    ->map(fn ($service) => [
                        'serviceId' => (int) $service->service_id,
                        'enabled' => (bool) $service->enabled,
                        'hourlyRate' => round((float) $service->hour_price, 2),
                    ])
                    ->all();

                return [
                    'id' => (int) $slot->id,
                    'startTime' => (string) $slot->start_time,
                    'endTime' => (string) $slot->end_time,
                    'enabled' => (bool) $slot->enabled,
                    'services' => $services,
                ];
            })
            ->all();

        return [
            'date' => (string) $day->date,
            'enabled' => (bool) $day->enabled,
            'slots' => $slots,
        ];
    }

    public function saveCalendarDay(int $userId, array $payload): array
    {
        $date = (string) ($payload['date'] ?? '');
        $enabled = ! empty($payload['enabled']);
        $slots = is_array($payload['slots'] ?? null) ? $payload['slots'] : [];
        $now = time();

        DB::transaction(function () use ($userId, $date, $enabled, $slots, $now) {
            DB::table('calendar_day')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'date' => $date,
                ],
                [
                    'enabled' => $enabled ? 1 : 0,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );

            $dayId = (int) DB::table('calendar_day')
                ->where('user_id', $userId)
                ->where('date', $date)
                ->value('id');

            $slotIds = DB::table('calendar_day_slot')
                ->where('calendar_day_id', $dayId)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();

            if ($slotIds !== []) {
                DB::table('calendar_day_slot_service')->whereIn('slot_id', $slotIds)->delete();
            }
            DB::table('calendar_day_slot')->where('calendar_day_id', $dayId)->delete();

            foreach ($slots as $index => $slot) {
                if (! is_array($slot)) {
                    continue;
                }

                $slotId = (int) DB::table('calendar_day_slot')->insertGetId([
                    'calendar_day_id' => $dayId,
                    'start_time' => (string) ($slot['startTime'] ?? ''),
                    'end_time' => (string) ($slot['endTime'] ?? ''),
                    'enabled' => ! empty($slot['enabled']) ? 1 : 0,
                    'sortorder' => $index + 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $services = is_array($slot['services'] ?? null) ? $slot['services'] : [];
                foreach ($services as $service) {
                    if (! is_array($service)) {
                        continue;
                    }

                    $serviceId = (int) ($service['serviceId'] ?? 0);
                    if ($serviceId <= 0) {
                        continue;
                    }

                    DB::table('calendar_day_slot_service')->insert([
                        'slot_id' => $slotId,
                        'service_id' => $serviceId,
                        'enabled' => ! empty($service['enabled']) ? 1 : 0,
                        'hour_price' => round((float) ($service['hourlyRate'] ?? 0), 2),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        });

        return $this->getCalendarDay($userId, $date);
    }

    public function copyCalendarDay(int $userId, string $sourceDate, array $targetDates): array
    {
        $source = $this->getCalendarDay($userId, $sourceDate);
        $copied = 0;

        foreach ($targetDates as $targetDate) {
            $normalizedTarget = (string) $targetDate;
            if ($normalizedTarget === '' || $normalizedTarget === $sourceDate) {
                continue;
            }

            $this->saveCalendarDay($userId, [
                'date' => $normalizedTarget,
                'enabled' => $source['enabled'] ?? false,
                'slots' => $source['slots'] ?? [],
            ]);
            $copied += 1;
        }

        return [
            'sourceDate' => $sourceDate,
            'copiedCount' => $copied,
        ];
    }

    private function ensureLanguageSeeded(): void
    {
        if (DB::table('language')->count() > 0) {
            return;
        }

        $now = time();
        $languages = [
            ['id' => 1, 'name' => 'Italiano', 'sortorder' => 10],
            ['id' => 2, 'name' => 'English', 'sortorder' => 20],
            ['id' => 3, 'name' => 'Francais', 'sortorder' => 30],
            ['id' => 4, 'name' => 'Espanol', 'sortorder' => 40],
            ['id' => 5, 'name' => 'Deutsch', 'sortorder' => 50],
        ];

        foreach ($languages as $language) {
            DB::table('language')->updateOrInsert(
                ['id' => $language['id']],
                [
                    'name' => $language['name'],
                    'sortorder' => $language['sortorder'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }

    private function ensureOperatorMetadataSeeded(): void
    {
        $now = time();

        $titles = [
            ['id' => 1, 'name' => 'Addestratore', 'sortorder' => 10],
            ['id' => 2, 'name' => 'Educatore', 'sortorder' => 20],
            ['id' => 3, 'name' => 'Veterinario', 'sortorder' => 30],
            ['id' => 4, 'name' => 'Petsitter', 'sortorder' => 40],
            ['id' => 5, 'name' => 'Toelettatore', 'sortorder' => 50],
        ];

        foreach ($titles as $title) {
            DB::table('operatortitle')->updateOrInsert(
                ['id' => $title['id']],
                [
                    'name' => $title['name'],
                    'sortorder' => $title['sortorder'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        $breeds = [
            ['id' => 1, 'name' => 'Labrador Retriever', 'sortorder' => 10],
            ['id' => 2, 'name' => 'Golden Retriever', 'sortorder' => 20],
            ['id' => 3, 'name' => 'Pastore Tedesco', 'sortorder' => 30],
            ['id' => 4, 'name' => 'Bulldog Francese', 'sortorder' => 40],
            ['id' => 5, 'name' => 'Barboncino', 'sortorder' => 50],
            ['id' => 6, 'name' => 'Beagle', 'sortorder' => 60],
            ['id' => 7, 'name' => 'Carlino', 'sortorder' => 70],
            ['id' => 8, 'name' => 'Border Collie', 'sortorder' => 80],
            ['id' => 9, 'name' => 'Chihuahua', 'sortorder' => 90],
            ['id' => 10, 'name' => 'Jack Russell Terrier', 'sortorder' => 100],
            ['id' => 11, 'name' => 'Maltese', 'sortorder' => 110],
            ['id' => 12, 'name' => 'Rottweiler', 'sortorder' => 120],
            ['id' => 13, 'name' => 'Setter Inglese', 'sortorder' => 130],
            ['id' => 14, 'name' => 'Cocker Spaniel', 'sortorder' => 140],
            ['id' => 15, 'name' => 'Meticcio', 'sortorder' => 150],
        ];

        foreach ($breeds as $breed) {
            DB::table('dogbreed')->updateOrInsert(
                ['id' => $breed['id']],
                [
                    'name' => $breed['name'],
                    'sortorder' => $breed['sortorder'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        if (! DB::table('pettype')->exists()) {
            $petTypes = [
                ['id' => 1, 'name' => 'Docile', 'sortorder' => 10],
                ['id' => 2, 'name' => 'Aggressivo con persone', 'sortorder' => 20],
                ['id' => 3, 'name' => 'Aggressivo con pet', 'sortorder' => 30],
                ['id' => 4, 'name' => 'Ansioso', 'sortorder' => 40],
                ['id' => 5, 'name' => 'Iperattivo', 'sortorder' => 50],
                ['id' => 6, 'name' => 'Anziano', 'sortorder' => 60],
                ['id' => 7, 'name' => 'Cucciolo', 'sortorder' => 70],
                ['id' => 8, 'name' => 'Con esigenze speciali', 'sortorder' => 80],
            ];

            foreach ($petTypes as $petType) {
                DB::table('pettype')->updateOrInsert(
                    ['id' => $petType['id']],
                    [
                        'name' => $petType['name'],
                        'sortorder' => $petType['sortorder'],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]
                );
            }
        }

        if (! DB::table('housefeature')->exists()) {
            $houseFeatures = [
                ['id' => 1, 'name' => 'Giardino (recintato SI/NO)', 'sortorder' => 10],
                ['id' => 2, 'name' => 'Appartamento', 'sortorder' => 20],
                ['id' => 3, 'name' => 'Casa indipendente', 'sortorder' => 30],
                ['id' => 4, 'name' => 'Villa', 'sortorder' => 40],
                ['id' => 5, 'name' => 'Terrazzo (piccolo medio grande)', 'sortorder' => 50],
                ['id' => 6, 'name' => 'Confinamento (zona dedicata, cuccia interna/esterna, intera casa)', 'sortorder' => 60],
                ['id' => 7, 'name' => 'Presenza altri animali', 'sortorder' => 70],
                ['id' => 8, 'name' => 'Presenza ascensore', 'sortorder' => 80],
            ];

            foreach ($houseFeatures as $houseFeature) {
                DB::table('housefeature')->updateOrInsert(
                    ['id' => $houseFeature['id']],
                    [
                        'name' => $houseFeature['name'],
                        'sortorder' => $houseFeature['sortorder'],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]
                );
            }
        }
    }

    private function normalizePhotoUrl(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        if (str_starts_with($trimmed, 'http://') || str_starts_with($trimmed, 'https://') || str_starts_with($trimmed, '/')) {
            return $trimmed;
        }

        return '/storage/'.$trimmed;
    }
}
