<?php

use Illuminate\Support\Facades\DB;

/**
 * Popola disponibilita realistiche e riproducibili per i Pet Assistant indicati.
 *
 * @return array{days:int, enabledDays:int, slots:int, slotServices:int}
 */
function cbSeedPetAssistantCalendars(array $userIds, DateTimeImmutable $startDate, DateTimeImmutable $endDate): array
{
    $normalizedUserIds = array_values(array_unique(array_filter(array_map('intval', $userIds), fn (int $id) => $id > 0)));
    if ($normalizedUserIds === [] || $endDate < $startDate) {
        return ['days' => 0, 'enabledDays' => 0, 'slots' => 0, 'slotServices' => 0];
    }

    $operatorServices = DB::table('operatorservicedata')
        ->whereIn('user_id', $normalizedUserIds)
        ->orderBy('service_id')
        ->get(['user_id', 'service_id', 'hour_price'])
        ->groupBy('user_id')
        ->map(fn ($rows) => $rows->map(fn ($row) => [
            'serviceId' => (int) $row->service_id,
            'hourPrice' => round((float) $row->hour_price, 2),
        ])->values()->all())
        ->all();

    $stats = ['days' => 0, 'enabledDays' => 0, 'slots' => 0, 'slotServices' => 0];
    $seed = abs(crc32($startDate->format('Y-m-d').'|'.$endDate->format('Y-m-d').'|coccolebestiali'));
    mt_srand($seed);

    DB::transaction(function () use ($normalizedUserIds, $operatorServices, $startDate, $endDate, &$stats) {
        $dayIds = DB::table('calendar_day')->whereIn('user_id', $normalizedUserIds)->pluck('id')->all();
        if ($dayIds !== []) {
            $slotIds = DB::table('calendar_day_slot')->whereIn('calendar_day_id', $dayIds)->pluck('id')->all();
            if ($slotIds !== []) {
                DB::table('calendar_day_slot_service')->whereIn('slot_id', $slotIds)->delete();
            }
            DB::table('calendar_day_slot')->whereIn('calendar_day_id', $dayIds)->delete();
            DB::table('calendar_day')->whereIn('id', $dayIds)->delete();
        }

        $now = time();
        $startBuckets = [
            [480, 495, 510, 525, 540, 555, 570, 585, 600],
            [840, 855, 870, 885, 900, 915, 930, 945, 960],
            [1170, 1185, 1200, 1215, 1230],
        ];
        $durationBuckets = [
            [60, 90, 120, 150, 180],
            [60, 90, 120, 150, 180],
            [60, 90, 120],
        ];

        foreach ($normalizedUserIds as $userId) {
            $services = $operatorServices[$userId] ?? [];
            if ($services === []) {
                continue;
            }

            for ($date = $startDate; $date <= $endDate; $date = $date->modify('+1 day')) {
                $isWeekend = in_array((int) $date->format('N'), [6, 7], true);
                $availabilityChance = $isWeekend ? 58 : 74;
                if (mt_rand(1, 100) > $availabilityChance) {
                    continue;
                }

                $enabled = mt_rand(1, 100) <= 88;
                $dayId = (int) DB::table('calendar_day')->insertGetId([
                    'user_id' => $userId,
                    'date' => $date->format('Y-m-d'),
                    'enabled' => $enabled ? 1 : 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $stats['days'] += 1;
                $stats['enabledDays'] += $enabled ? 1 : 0;

                $slotCount = mt_rand(1, 100) <= 68 ? 2 : 1;
                if (mt_rand(1, 100) <= 14) {
                    $slotCount = 3;
                }
                $bucketIndexes = $slotCount === 1 ? [mt_rand(0, 2)] : range(0, $slotCount - 1);

                foreach ($bucketIndexes as $sortIndex => $bucketIndex) {
                    $startOptions = $startBuckets[$bucketIndex];
                    $durationOptions = $durationBuckets[$bucketIndex];
                    $startMinutes = $startOptions[array_rand($startOptions)];
                    $duration = $durationOptions[array_rand($durationOptions)];
                    $endMinutes = min(23 * 60 + 45, $startMinutes + $duration);

                    $formatTime = static fn (int $minutes): string => sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
                    $slotId = (int) DB::table('calendar_day_slot')->insertGetId([
                        'calendar_day_id' => $dayId,
                        'start_time' => $formatTime($startMinutes),
                        'end_time' => $formatTime($endMinutes),
                        'enabled' => 1,
                        'sortorder' => $sortIndex + 1,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $stats['slots'] += 1;

                    $slotServices = $services;
                    shuffle($slotServices);
                    $serviceCount = mt_rand(1, min(3, count($slotServices)));
                    foreach (array_slice($slotServices, 0, $serviceCount) as $service) {
                        DB::table('calendar_day_slot_service')->insert([
                            'slot_id' => $slotId,
                            'service_id' => $service['serviceId'],
                            'enabled' => 1,
                            'hour_price' => $service['hourPrice'],
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                        $stats['slotServices'] += 1;
                    }
                }
            }
        }
    });

    return $stats;
}
