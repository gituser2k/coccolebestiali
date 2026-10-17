<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$outputPath = __DIR__.'/seed_current_profiles.sql';
$pdo = DB::connection()->getPdo();

function cbSqlIdentifier(string $value): string
{
    return '`'.str_replace('`', '``', $value).'`';
}

function cbSqlValue(mixed $value, PDO $pdo): string
{
    if ($value === null) {
        return 'NULL';
    }

    if (is_bool($value)) {
        return $value ? '1' : '0';
    }

    if (is_int($value) || is_float($value)) {
        return (string) $value;
    }

    $quoted = $pdo->quote((string) $value);

    return $quoted === false ? "''" : $quoted;
}

function cbSqlInsert(string $table, array $values, PDO $pdo, array $rawColumns = []): string
{
    $columns = array_map(cbSqlIdentifier(...), array_keys($values));
    $serializedValues = [];

    foreach ($values as $column => $value) {
        $serializedValues[] = in_array($column, $rawColumns, true)
            ? (string) $value
            : cbSqlValue($value, $pdo);
    }

    return sprintf(
        'INSERT INTO %s (%s) VALUES (%s);',
        cbSqlIdentifier($table),
        implode(', ', $columns),
        implode(', ', $serializedValues)
    );
}

function cbRowWithout(object $row, array $excludedColumns): array
{
    $values = (array) $row;
    foreach ($excludedColumns as $column) {
        unset($values[$column]);
    }

    return $values;
}

$users = DB::table('users')
    ->where(function ($query) {
        $query
            ->where('email', 'frabe75@gmail.com')
            ->orWhere(function ($assistantQuery) {
                $assistantQuery
                    ->where('role', 'pet_assistant')
                    ->whereRaw("email REGEXP '^utente([1-9]|[1-3][0-9]|40)@email\\.it$'");
            });
    })
    ->orderByRaw("CASE WHEN email = 'frabe75@gmail.com' THEN 0 ELSE 1 END")
    ->orderBy('id')
    ->get();

$owner = $users->firstWhere('email', 'frabe75@gmail.com');
$assistants = $users->filter(fn ($user) => (string) $user->role === 'pet_assistant');

if (! $owner || $assistants->count() !== 40 || $users->count() !== 41) {
    fwrite(STDERR, sprintf(
        "Dataset incompleto: owner=%s, pet assistant=%d, utenti totali=%d.\n",
        $owner ? 'presente' : 'assente',
        $assistants->count(),
        $users->count()
    ));
    exit(1);
}

$emails = $users->pluck('email')->map(fn ($email) => (string) $email)->all();
$emailList = implode(', ', array_map(fn ($email) => cbSqlValue($email, $pdo), $emails));
$generatedAt = new DateTimeImmutable('now', new DateTimeZone('Europe/Rome'));
$lines = [
    '-- Coccole Bestiali - snapshot profili di sviluppo',
    '-- Generato il '.$generatedAt->format('Y-m-d H:i:s').' Europe/Rome.',
    '-- Prerequisito: eseguire prima migration/migration.txt sul database di destinazione.',
    '-- Lo script sostituisce esclusivamente frabe75@gmail.com e i 40 account utenteN@email.it.',
    '-- I percorsi storage sono inclusi nel database, ma i file fisici devono essere copiati separatamente.',
    '',
    'SET NAMES utf8mb4;',
    'START TRANSACTION;',
    'SET @cb_previous_fk_checks = @@FOREIGN_KEY_CHECKS;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
    'DROP TEMPORARY TABLE IF EXISTS `cb_seed_existing_users`;',
    'CREATE TEMPORARY TABLE `cb_seed_existing_users` (`id` int unsigned NOT NULL PRIMARY KEY);',
    'INSERT INTO `cb_seed_existing_users` (`id`) SELECT `id` FROM `users` WHERE `email` IN ('.$emailList.');',
    '',
    '-- Rimozione idempotente del precedente snapshot.',
    'DELETE slot_service FROM `calendar_day_slot_service` AS slot_service INNER JOIN `calendar_day_slot` AS slot ON slot.id = slot_service.slot_id INNER JOIN `calendar_day` AS day_row ON day_row.id = slot.calendar_day_id INNER JOIN `cb_seed_existing_users` AS seed_user ON seed_user.id = day_row.user_id;',
    'DELETE slot FROM `calendar_day_slot` AS slot INNER JOIN `calendar_day` AS day_row ON day_row.id = slot.calendar_day_id INNER JOIN `cb_seed_existing_users` AS seed_user ON seed_user.id = day_row.user_id;',
    'DELETE day_row FROM `calendar_day` AS day_row INNER JOIN `cb_seed_existing_users` AS seed_user ON seed_user.id = day_row.user_id;',
    'DELETE pet_document FROM `ownerpetdocument` AS pet_document INNER JOIN `ownerpet` AS pet ON pet.id = pet_document.pet_id INNER JOIN `cb_seed_existing_users` AS seed_user ON seed_user.id = pet.user_id;',
    'DELETE pet_gallery FROM `ownerpetgallery` AS pet_gallery INNER JOIN `ownerpet` AS pet ON pet.id = pet_gallery.pet_id INNER JOIN `cb_seed_existing_users` AS seed_user ON seed_user.id = pet.user_id;',
    'DELETE pet_breed FROM `ownerpetbreeddata` AS pet_breed INNER JOIN `ownerpet` AS pet ON pet.id = pet_breed.pet_id INNER JOIN `cb_seed_existing_users` AS seed_user ON seed_user.id = pet.user_id;',
    'DELETE pet_type FROM `ownerpettypedata` AS pet_type INNER JOIN `ownerpet` AS pet ON pet.id = pet_type.pet_id INNER JOIN `cb_seed_existing_users` AS seed_user ON seed_user.id = pet.user_id;',
    'DELETE pet FROM `ownerpet` AS pet INNER JOIN `cb_seed_existing_users` AS seed_user ON seed_user.id = pet.user_id;',
];

$directUserTables = [
    'operatorservicefeaturedata',
    'operatorservicedata',
    'operatorgallery',
    'housefeaturedata',
    'pettypedata',
    'petbreeddata',
    'operatortitledata',
    'operatorassociatedata',
    'operatordata',
    'personaldata',
    'social_accounts',
];

foreach ($directUserTables as $table) {
    $lines[] = sprintf(
        'DELETE target FROM %s AS target INNER JOIN `cb_seed_existing_users` AS seed_user ON seed_user.id = target.user_id;',
        cbSqlIdentifier($table)
    );
}

$lines[] = 'DELETE target FROM `users` AS target INNER JOIN `cb_seed_existing_users` AS seed_user ON seed_user.id = target.id;';
$lines[] = 'DROP TEMPORARY TABLE `cb_seed_existing_users`;';
$lines[] = '';

$storagePaths = [];

foreach ($users as $user) {
    $sourceUserId = (int) $user->id;
    $userVariable = '@cb_user_'.$sourceUserId;
    $userValues = cbRowWithout($user, ['id']);

    $lines[] = '-- Account '.$userValues['email'];
    $lines[] = cbSqlInsert('users', $userValues, $pdo);
    $lines[] = 'SET '.$userVariable.' = LAST_INSERT_ID();';

    foreach ($directUserTables as $table) {
        $rows = DB::table($table)->where('user_id', $sourceUserId)->orderBy('id')->get();
        foreach ($rows as $row) {
            $values = cbRowWithout($row, ['id', 'user_id']);
            $values = ['user_id' => $userVariable, ...$values];
            $lines[] = cbSqlInsert($table, $values, $pdo, ['user_id']);

            if ($table === 'personaldata' && trim((string) ($row->photo ?? '')) !== '') {
                $storagePaths[(string) $row->photo] = true;
            }
            if ($table === 'operatorgallery' && trim((string) ($row->photo ?? '')) !== '') {
                $storagePaths[(string) $row->photo] = true;
            }
        }
    }

    $pets = DB::table('ownerpet')->where('user_id', $sourceUserId)->orderBy('sortorder')->orderBy('id')->get();
    foreach ($pets as $pet) {
        $sourcePetId = (int) $pet->id;
        $petVariable = '@cb_pet_'.$sourcePetId;
        $petValues = cbRowWithout($pet, ['id', 'user_id']);
        $petValues = ['user_id' => $userVariable, ...$petValues];
        $lines[] = cbSqlInsert('ownerpet', $petValues, $pdo, ['user_id']);
        $lines[] = 'SET '.$petVariable.' = LAST_INSERT_ID();';

        foreach (['ownerpetbreeddata', 'ownerpettypedata', 'ownerpetgallery', 'ownerpetdocument'] as $table) {
            $rows = DB::table($table)->where('pet_id', $sourcePetId)->orderBy('id')->get();
            foreach ($rows as $row) {
                $values = cbRowWithout($row, ['id', 'pet_id']);
                $values = ['pet_id' => $petVariable, ...$values];
                $lines[] = cbSqlInsert($table, $values, $pdo, ['pet_id']);

                if ($table === 'ownerpetgallery' && trim((string) ($row->photo ?? '')) !== '') {
                    $storagePaths[(string) $row->photo] = true;
                }
                if ($table === 'ownerpetdocument' && trim((string) ($row->file_path ?? '')) !== '') {
                    $storagePaths[(string) $row->file_path] = true;
                }
            }
        }
    }

    $calendarDays = DB::table('calendar_day')->where('user_id', $sourceUserId)->orderBy('date')->orderBy('id')->get();
    foreach ($calendarDays as $day) {
        $sourceDayId = (int) $day->id;
        $dayVariable = '@cb_day_'.$sourceDayId;
        $dayValues = cbRowWithout($day, ['id', 'user_id']);
        $dayValues = ['user_id' => $userVariable, ...$dayValues];
        $lines[] = cbSqlInsert('calendar_day', $dayValues, $pdo, ['user_id']);
        $lines[] = 'SET '.$dayVariable.' = LAST_INSERT_ID();';

        $slots = DB::table('calendar_day_slot')->where('calendar_day_id', $sourceDayId)->orderBy('sortorder')->orderBy('id')->get();
        foreach ($slots as $slot) {
            $sourceSlotId = (int) $slot->id;
            $slotVariable = '@cb_slot_'.$sourceSlotId;
            $slotValues = cbRowWithout($slot, ['id', 'calendar_day_id']);
            $slotValues = ['calendar_day_id' => $dayVariable, ...$slotValues];
            $lines[] = cbSqlInsert('calendar_day_slot', $slotValues, $pdo, ['calendar_day_id']);
            $lines[] = 'SET '.$slotVariable.' = LAST_INSERT_ID();';

            $slotServices = DB::table('calendar_day_slot_service')->where('slot_id', $sourceSlotId)->orderBy('id')->get();
            foreach ($slotServices as $slotService) {
                $serviceValues = cbRowWithout($slotService, ['id', 'slot_id']);
                $serviceValues = ['slot_id' => $slotVariable, ...$serviceValues];
                $lines[] = cbSqlInsert('calendar_day_slot_service', $serviceValues, $pdo, ['slot_id']);
            }
        }
    }

    $lines[] = '';
}

$lines[] = 'SET FOREIGN_KEY_CHECKS = @cb_previous_fk_checks;';
$lines[] = 'COMMIT;';
$lines[] = '';
$lines[] = '-- File storage referenziati da copiare separatamente:';
foreach (array_keys($storagePaths) as $path) {
    $lines[] = '-- '.$path;
}
$lines[] = '';

file_put_contents($outputPath, implode("\n", $lines));

fwrite(STDOUT, sprintf(
    "Snapshot creato: %s (%d utenti, %d riferimenti storage).\n",
    $outputPath,
    $users->count(),
    count($storagePaths)
));
