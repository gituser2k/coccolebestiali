<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if (! in_array('--force', $argv, true)) {
    fwrite(STDERR, "Operazione distruttiva. Riesegui con --force.\n");
    exit(1);
}

$storagePaths = [];
foreach (['personaldata' => 'photo', 'operatorgallery' => 'photo', 'ownerpetgallery' => 'photo'] as $table => $column) {
    if (! Schema::hasTable($table)) {
        continue;
    }

    foreach (DB::table($table)->where($column, '<>', '')->pluck($column) as $path) {
        $normalizedPath = trim((string) $path);
        if ($normalizedPath !== '' && ! str_starts_with($normalizedPath, 'http://') && ! str_starts_with($normalizedPath, 'https://')) {
            $storagePaths[$normalizedPath] = true;
        }
    }
}

$privateStoragePaths = [];
if (Schema::hasTable('ownerpetdocument')) {
    foreach (DB::table('ownerpetdocument')->where('file_path', '<>', '')->pluck('file_path') as $path) {
        $normalizedPath = trim((string) $path);
        if ($normalizedPath !== '') {
            $privateStoragePaths[$normalizedPath] = true;
        }
    }
}

$addresses = [
    'Via Appia Nuova', 'Via Tuscolana', 'Via Nomentana', 'Via Cassia', 'Via Aurelia',
    'Via Ostiense', 'Via Prenestina', 'Via Tiburtina', 'Viale Marconi', 'Via Cristoforo Colombo',
    'Via Trionfale', 'Via Salaria', 'Via Laurentina', 'Viale Libia', 'Via Gregorio VII',
    'Via di Acilia', 'Via Casilina', 'Via Boccea', 'Viale Europa', 'Via del Pigneto',
];
$petSizes = ['small', 'medium', 'large', 'max'];
$radiusOptions = [3, 5, 8, 10, 15, 20];
$titleIds = DB::table('operatortitle')->orderBy('id')->pluck('id')->map(fn ($id) => (int) $id)->all();
$breedIds = DB::table('petbreed')->where('name', '<>', 'Qualsiasi')->orderBy('id')->pluck('id')->map(fn ($id) => (int) $id)->all();
$anyBreedId = (int) (DB::table('petbreed')->where('name', 'Qualsiasi')->value('id') ?? 0);
$petTypeIds = DB::table('pettype')->where('name', '<>', 'Qualsiasi')->orderBy('id')->pluck('id')->map(fn ($id) => (int) $id)->all();
$anyPetTypeId = (int) (DB::table('pettype')->where('name', 'Qualsiasi')->value('id') ?? 0);
$houseFeatureIds = DB::table('housefeature')->orderBy('id')->pluck('id')->map(fn ($id) => (int) $id)->all();
$serviceIds = DB::table('service')->orderBy('id')->pluck('id')->map(fn ($id) => (int) $id)->all();
$serviceFeatureMap = DB::table('servicefeaturedata')
    ->orderBy('feature_id')
    ->get(['service_id', 'feature_id'])
    ->groupBy('service_id')
    ->map(fn ($rows) => $rows->pluck('feature_id')->map(fn ($id) => (int) $id)->values()->all())
    ->all();

if ($titleIds === [] || $breedIds === [] || $petTypeIds === [] || $houseFeatureIds === [] || $serviceIds === []) {
    fwrite(STDERR, "Cataloghi CRM incompleti. Esegui prima migration/migration.txt.\n");
    exit(1);
}

$tablesToReset = [
    'calendar_day_slot_service', 'calendar_day_slot', 'calendar_day',
    'ownerpetdocument', 'ownerpetgallery', 'ownerpetbreeddata', 'ownerpettypedata', 'ownerpet',
    'operatorservicefeaturedata', 'operatorservicedata', 'operatorgallery',
    'housefeaturedata', 'pettypedata', 'petbreeddata', 'operatortitledata',
    'operatorassociatedata', 'operatordata', 'personaldata', 'social_accounts', 'users',
];

DB::transaction(function () use (
    $tablesToReset,
    $addresses,
    $petSizes,
    $radiusOptions,
    $titleIds,
    $breedIds,
    $anyBreedId,
    $petTypeIds,
    $anyPetTypeId,
    $houseFeatureIds,
    $serviceIds,
    $serviceFeatureMap
) {
    foreach ($tablesToReset as $table) {
        if (Schema::hasTable($table)) {
            DB::table($table)->delete();
        }
    }

    $now = time();
    for ($number = 1; $number <= 40; $number += 1) {
        $alias = 'utente'.$number;
        $isAssociation = $number % 8 === 0;
        $angle = (($number - 1) / 40) * 2 * M_PI;
        $ring = 0.025 + (($number % 5) * 0.009);
        $latitude = 41.9028 + (sin($angle) * $ring);
        $longitude = 12.4964 + (cos($angle) * $ring * 1.35);

        $userId = (int) DB::table('users')->insertGetId([
            'role' => 'pet_assistant',
            'name' => $alias,
            'email' => $alias.'@email.it',
            'email_verified' => 1,
            'password_hash' => Hash::make('pass'.$number),
            'password_reset_required' => 0,
            'avatar' => '',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('personaldata')->insert([
            'user_id' => $userId,
            'name' => 'Pet Assistant '.$number,
            'photo' => '',
            'age' => 22 + ($number % 39),
            'city' => 'Roma',
            'phone' => sprintf('06%08d', 70000000 + $number),
            'address' => $addresses[($number - 1) % count($addresses)],
            'addressnumber' => (string) (5 + (($number * 7) % 180)),
            'location_lat' => round($latitude, 7),
            'location_lng' => round($longitude, 7),
            'service_radius_km' => $radiusOptions[($number - 1) % count($radiusOptions)],
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('operatordata')->insert([
            'user_id' => $userId,
            'operator_type' => $isAssociation ? 'association' : 'person',
            'fiscal_code' => $isAssociation ? '' : sprintf('CBTUSR%010d', $number),
            'business_name' => $isAssociation ? 'Associazione Coccole Roma '.$number : '',
            'vat_number' => $isAssociation ? sprintf('099%08d', $number) : '',
            'bio' => 'Pet Assistant a Roma con esperienza nella cura quotidiana, nel benessere e nella gestione personalizzata degli animali.',
            'experience_years' => 1 + (($number * 3) % 20),
            'pet_size' => $petSizes[($number - 1) % count($petSizes)],
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $selectedTitles = [$titleIds[($number - 1) % count($titleIds)]];
        if ($number % 3 === 0) {
            $selectedTitles[] = $titleIds[$number % count($titleIds)];
        }
        foreach (array_unique($selectedTitles) as $titleId) {
            DB::table('operatortitledata')->insert([
                'user_id' => $userId,
                'title_id' => $titleId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $selectedBreeds = $number % 10 === 0 && $anyBreedId > 0
            ? [$anyBreedId]
            : [
                $breedIds[($number - 1) % count($breedIds)],
                $breedIds[($number + 4) % count($breedIds)],
            ];
        foreach (array_unique($selectedBreeds) as $breedId) {
            DB::table('petbreeddata')->insert([
                'user_id' => $userId,
                'petbreed_id' => $breedId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $selectedTypes = $number % 9 === 0 && $anyPetTypeId > 0
            ? [$anyPetTypeId]
            : [
                $petTypeIds[($number - 1) % count($petTypeIds)],
                $petTypeIds[($number + 2) % count($petTypeIds)],
            ];
        foreach (array_unique($selectedTypes) as $petTypeId) {
            DB::table('pettypedata')->insert([
                'user_id' => $userId,
                'pettype_id' => $petTypeId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $houseCount = 2 + ($number % 3);
        for ($offset = 0; $offset < $houseCount; $offset += 1) {
            $houseFeatureId = $houseFeatureIds[($number + $offset * 2) % count($houseFeatureIds)];
            DB::table('housefeaturedata')->updateOrInsert(
                ['user_id' => $userId, 'housefeature_id' => $houseFeatureId],
                ['created_at' => $now, 'updated_at' => $now]
            );
        }

        $serviceCount = 2 + ($number % min(4, count($serviceIds)));
        for ($offset = 0; $offset < $serviceCount; $offset += 1) {
            $serviceId = $serviceIds[($number + $offset) % count($serviceIds)];
            DB::table('operatorservicedata')->updateOrInsert(
                ['user_id' => $userId, 'service_id' => $serviceId],
                [
                    'hour_price' => round(10 + (($number * 1.35 + $serviceId * 2.25) % 22), 2),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );

            $availableFeatureIds = $serviceFeatureMap[$serviceId] ?? [];
            $selectedFeatureIds = array_values(array_filter(
                $availableFeatureIds,
                fn (int $featureId) => ($featureId + $number + $serviceId) % 3 !== 0
            ));
            if ($selectedFeatureIds === [] && $availableFeatureIds !== []) {
                $selectedFeatureIds[] = $availableFeatureIds[0];
            }
            foreach ($selectedFeatureIds as $featureId) {
                DB::table('operatorservicefeaturedata')->insert([
                    'user_id' => $userId,
                    'service_id' => $serviceId,
                    'feature_id' => $featureId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }
});

require_once __DIR__.'/pet_assistant_calendar_seed.php';
$calendarTimezone = new DateTimeZone('Europe/Rome');
$calendarStartDate = new DateTimeImmutable('today', $calendarTimezone);
$calendarEndDate = $calendarStartDate->modify('+1 month');
$seededUserIds = DB::table('users')
    ->where('role', 'pet_assistant')
    ->where('email', 'like', 'utente%@email.it')
    ->orderBy('id')
    ->pluck('id')
    ->map(fn ($id) => (int) $id)
    ->all();
$calendarStats = cbSeedPetAssistantCalendars($seededUserIds, $calendarStartDate, $calendarEndDate);

foreach (array_keys($storagePaths) as $path) {
    Storage::disk('public')->delete($path);
}

foreach (array_keys($privateStoragePaths) as $path) {
    Storage::disk('local')->delete($path);
}

foreach ($tablesToReset as $table) {
    if (Schema::hasTable($table)) {
        DB::statement('ALTER TABLE `'.$table.'` AUTO_INCREMENT = 1');
    }
}

fwrite(STDOUT, "Creati 40 Pet Assistant.\n");
fwrite(STDOUT, "Email: utente1@email.it ... utente40@email.it\n");
fwrite(STDOUT, "Password: pass1 ... pass40\n");
fwrite(STDOUT, sprintf(
    "Calendari: %s - %s, %d giornate (%d attive), %d fasce.\n",
    $calendarStartDate->format('d/m/Y'),
    $calendarEndDate->format('d/m/Y'),
    $calendarStats['days'],
    $calendarStats['enabledDays'],
    $calendarStats['slots']
));
