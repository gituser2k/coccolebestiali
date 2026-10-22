<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$pdo = DB::connection()->getPdo();
$generatedAt = new DateTimeImmutable('now', new DateTimeZone('Europe/Rome'));

$systemTables = [
    'operatortitle',
    'petbreed',
    'pettype',
    'housefeature',
    'servicefeature',
    'service',
    'servicefeaturedata',
    'portal_policy',
    'policy_change_log',
];

$demoTables = [
    'users',
    'social_accounts',
    'personaldata',
    'operatordata',
    'operatorassociatedata',
    'operatortitledata',
    'petbreeddata',
    'pettypedata',
    'housefeaturedata',
    'operatorgallery',
    'ownerpet',
    'ownerpetbreeddata',
    'ownerpettypedata',
    'ownerpetgallery',
    'ownerpetdocument',
    'operatorservicedata',
    'operatorservicefeaturedata',
    'calendar_day',
    'calendar_day_slot',
    'calendar_day_slot_service',
    'user_reputation',
    'booking_counter',
    'booking',
    'booking_reschedule',
    'booking_review',
    'reputation_event',
    'booking_action_token',
    'message',
    'messageback',
    'error',
];

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

function cbSqlInsert(string $table, object $row, PDO $pdo): string
{
    $values = (array) $row;

    return sprintf(
        'INSERT INTO %s (%s) VALUES (%s);',
        cbSqlIdentifier($table),
        implode(', ', array_map(cbSqlIdentifier(...), array_keys($values))),
        implode(', ', array_map(fn ($value) => cbSqlValue($value, $pdo), array_values($values)))
    );
}

function cbExportSnapshot(string $path, string $title, array $tables, PDO $pdo, DateTimeImmutable $generatedAt): void
{
    $lines = [
        '-- Coccole Bestiali - '.$title,
        '-- Generato il '.$generatedAt->format('Y-m-d H:i:s').' Europe/Rome.',
        '-- Prerequisito: eseguire prima migration/migration.txt.',
        '',
        'SET NAMES utf8mb4;',
        'START TRANSACTION;',
        'SET @cb_previous_fk_checks = @@FOREIGN_KEY_CHECKS;',
        'SET FOREIGN_KEY_CHECKS = 0;',
        '',
    ];

    foreach (array_reverse($tables) as $table) {
        $lines[] = 'DELETE FROM '.cbSqlIdentifier($table).';';
    }
    $lines[] = '';

    foreach ($tables as $table) {
        $query = DB::table($table);
        $columns = Schema::getColumnListing($table);
        if (in_array('id', $columns, true)) {
            $query->orderBy('id');
        } elseif ($columns !== []) {
            $query->orderBy($columns[0]);
        }

        $rows = $query->get();
        $lines[] = '-- '.$table.': '.$rows->count().' record';
        foreach ($rows as $row) {
            $lines[] = cbSqlInsert($table, $row, $pdo);
        }
        $lines[] = '';
    }

    $lines[] = 'SET FOREIGN_KEY_CHECKS = @cb_previous_fk_checks;';
    $lines[] = 'COMMIT;';
    $lines[] = '';
    file_put_contents($path, implode("\n", $lines));
}

function cbResetDirectory(string $path): void
{
    if (is_dir($path)) {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $item) {
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        rmdir($path);
    }
    mkdir($path, 0775, true);
}

function cbCopyStorageFile(string $relativePath, string $sourceRoot, string $targetRoot): bool
{
    $relativePath = ltrim(str_replace('\\', '/', trim($relativePath)), '/');
    if ($relativePath === '' || str_contains($relativePath, '..') || preg_match('#^https?://#i', $relativePath)) {
        return false;
    }

    $source = $sourceRoot.'/'.$relativePath;
    if (! is_file($source)) {
        return false;
    }

    $target = $targetRoot.'/'.$relativePath;
    if (! is_dir(dirname($target))) {
        mkdir(dirname($target), 0775, true);
    }

    return copy($source, $target);
}

$ownerCount = DB::table('users')->where('role', 'pet_owner')->count();
$assistantCount = DB::table('users')->where('role', 'pet_assistant')->count();
if ($ownerCount !== 1 || $assistantCount !== 40 || DB::table('users')->count() !== 41) {
    fwrite(STDERR, "Dataset demo non valido: sono richiesti 1 Pet Owner e 40 Pet Assistant.\n");
    exit(1);
}

cbExportSnapshot(__DIR__.'/seed_system_configuration.sql', 'snapshot sistema e configurazione', $systemTables, $pdo, $generatedAt);
cbExportSnapshot(__DIR__.'/seed_demo_data.sql', 'snapshot dati demo', $demoTables, $pdo, $generatedAt);

$snapshotStorage = __DIR__.'/demo_storage';
cbResetDirectory($snapshotStorage);
mkdir($snapshotStorage.'/public', 0775, true);
mkdir($snapshotStorage.'/private', 0775, true);

$publicPaths = [];
$privatePaths = [];
foreach (DB::table('users')->pluck('avatar') as $path) {
    $publicPaths[(string) $path] = true;
}
foreach (DB::table('personaldata')->pluck('photo') as $path) {
    $publicPaths[(string) $path] = true;
}
foreach (DB::table('operatorgallery')->pluck('photo') as $path) {
    $publicPaths[(string) $path] = true;
}
foreach (DB::table('ownerpetgallery')->pluck('photo') as $path) {
    $publicPaths[(string) $path] = true;
}
foreach (DB::table('ownerpetdocument')->pluck('file_path') as $path) {
    $privatePaths[(string) $path] = true;
}

$copiedPublic = [];
$copiedPrivate = [];
foreach (array_keys($publicPaths) as $path) {
    if (cbCopyStorageFile($path, storage_path('app/public'), $snapshotStorage.'/public')) {
        $copiedPublic[] = $path;
    }
}
foreach (array_keys($privatePaths) as $path) {
    if (cbCopyStorageFile($path, storage_path('app/private'), $snapshotStorage.'/private')) {
        $copiedPrivate[] = $path;
    }
}

sort($copiedPublic);
sort($copiedPrivate);
file_put_contents($snapshotStorage.'/manifest.json', json_encode([
    'generatedAt' => $generatedAt->format(DateTimeInterface::ATOM),
    'public' => $copiedPublic,
    'private' => $copiedPrivate,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");

fwrite(STDOUT, sprintf(
    "Snapshot creati: sistema=%d tabelle, demo=%d tabelle, utenti=%d, file=%d.\n",
    count($systemTables),
    count($demoTables),
    $ownerCount + $assistantCount,
    count($copiedPublic) + count($copiedPrivate)
));
