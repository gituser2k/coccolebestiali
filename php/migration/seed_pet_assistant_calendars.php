<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if (! in_array('--force', $argv, true)) {
    fwrite(STDERR, "Operazione distruttiva per i calendari di test. Riesegui con --force.\n");
    exit(1);
}

require_once __DIR__.'/pet_assistant_calendar_seed.php';

$userIds = DB::table('users')
    ->join('user_capabilities', 'user_capabilities.user_id', '=', 'users.id')
    ->where('user_capabilities.capability', 'assistant')
    ->where('user_capabilities.status', 'active')
    ->orderBy('users.id')
    ->pluck('users.id')
    ->map(fn ($id) => (int) $id)
    ->all();

if (count($userIds) !== 40) {
    fwrite(STDERR, 'Attesi 40 Pet Assistant di test, trovati '.count($userIds).".\n");
    exit(1);
}

$timezone = new DateTimeZone('Europe/Rome');
$startDate = new DateTimeImmutable('today', $timezone);
$endDate = new DateTimeImmutable(CB_DEMO_CALENDAR_END_DATE, $timezone);
if ($startDate > $endDate) {
    fwrite(STDERR, "La data finale del dataset demo è precedente alla data corrente.\n");
    exit(1);
}
$stats = cbSeedPetAssistantCalendars($userIds, $startDate, $endDate);

fwrite(STDOUT, sprintf(
    "Calendari popolati dal %s al %s: %d giornate (%d attive), %d fasce, %d associazioni servizio.\n",
    $startDate->format('d/m/Y'),
    $endDate->format('d/m/Y'),
    $stats['days'],
    $stats['enabledDays'],
    $stats['slots'],
    $stats['slotServices']
));
