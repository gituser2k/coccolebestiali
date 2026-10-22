<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;
use Throwable;

class DemoData
{
    private const DATA_TABLES = [
        'booking_action_token',
        'booking_review',
        'reputation_event',
        'booking_reschedule',
        'booking',
        'user_reputation',
        'booking_counter',
        'calendar_day_slot_service',
        'calendar_day_slot',
        'calendar_day',
        'ownerpetdocument',
        'ownerpetgallery',
        'ownerpetbreeddata',
        'ownerpettypedata',
        'ownerpet',
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
        'users',
        'messageback',
        'message',
        'error',
    ];

    public function clearAll(): array
    {
        $connection = DB::connection();
        $database = $connection->getDatabaseName();
        $tables = collect($connection->select(
            'SELECT TABLE_NAME AS table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ?',
            [$database, 'BASE TABLE']
        ))->pluck('table_name')->map(fn ($table) => (string) $table)->values();
        $autoIncrementTables = collect($connection->select(
            "SELECT TABLE_NAME AS table_name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND EXTRA LIKE '%auto_increment%'",
            [$database]
        ))->pluck('table_name')->map(fn ($table) => (string) $table)->unique()->values();

        $connection->statement('SET FOREIGN_KEY_CHECKS = 0');
        try {
            foreach ($tables as $table) {
                $connection->table($table)->delete();
            }
            foreach ($autoIncrementTables as $table) {
                $connection->statement(sprintf('ALTER TABLE `%s` AUTO_INCREMENT = 1', str_replace('`', '``', $table)));
            }
        } finally {
            $connection->statement('SET FOREIGN_KEY_CHECKS = 1');
        }

        return [
            'tablesCleared' => $tables->count(),
            'remainingRows' => $tables->sum(fn ($table) => $connection->table($table)->count()),
        ];
    }

    private function clear(): void
    {
        $connection = DB::connection();
        $connection->statement('SET FOREIGN_KEY_CHECKS = 0');

        try {
            $connection->transaction(function () use ($connection) {
                foreach (self::DATA_TABLES as $table) {
                    $connection->table($table)->delete();
                }
            });

            foreach (self::DATA_TABLES as $table) {
                $connection->statement(sprintf('ALTER TABLE `%s` AUTO_INCREMENT = 1', $table));
            }
        } finally {
            $connection->statement('SET FOREIGN_KEY_CHECKS = 1');
        }
    }

    public function seed(): array
    {
        $snapshotPath = base_path('migration/seed_demo_data.sql');
        if (! is_file($snapshotPath) || ! is_readable($snapshotPath)) {
            throw new RuntimeException('Snapshot dati demo non disponibile.');
        }

        $this->clear();
        $this->runSnapshot($snapshotPath);
        $this->restoreStorageSnapshot();

        $summary = $this->summary();
        if ($summary['petAssistants'] !== 40 || $summary['petOwners'] !== 1) {
            throw new RuntimeException('Il dataset demo importato non contiene i 41 account attesi.');
        }

        return $summary;
    }

    public function restoreSystemConfiguration(): array
    {
        $snapshotPath = base_path('migration/seed_system_configuration.sql');
        if (! is_file($snapshotPath) || ! is_readable($snapshotPath)) {
            throw new RuntimeException('Snapshot configurazione di sistema non disponibile.');
        }

        $this->runSnapshot($snapshotPath);

        return [
            'services' => DB::table('service')->count(),
            'features' => DB::table('servicefeature')->count(),
            'petTypes' => DB::table('pettype')->count(),
            'houseFeatures' => DB::table('housefeature')->count(),
            'policies' => DB::table('portal_policy')->count(),
        ];
    }

    private function runSnapshot(string $snapshotPath): void
    {
        $connection = DB::connection();
        $connection->statement('SET FOREIGN_KEY_CHECKS = 0');
        $connection->beginTransaction();

        try {
            foreach (file($snapshotPath, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
                $statement = trim($line);
                if ($statement === '' || str_starts_with($statement, '--')) {
                    continue;
                }
                if ($this->isTransactionControlStatement($statement)) {
                    continue;
                }

                $connection->unprepared($statement);
            }

            $connection->commit();
        } catch (Throwable $exception) {
            if ($connection->transactionLevel() > 0) {
                $connection->rollBack();
            }
            throw $exception;
        } finally {
            $connection->statement('SET FOREIGN_KEY_CHECKS = 1');
        }
    }

    private function restoreStorageSnapshot(): void
    {
        $snapshotRoot = base_path('migration/demo_storage');
        $manifestPath = $snapshotRoot.'/manifest.json';
        if (! is_file($manifestPath)) {
            throw new RuntimeException('Manifest dei file demo non disponibile.');
        }

        $manifest = json_decode((string) file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
        foreach (['public', 'private'] as $visibility) {
            $sourceRoot = $snapshotRoot.'/'.$visibility;
            $targetRoot = storage_path('app/'.$visibility);
            foreach (($manifest[$visibility] ?? []) as $relativePath) {
                $relativePath = ltrim(str_replace('\\', '/', (string) $relativePath), '/');
                if ($relativePath === '' || str_contains($relativePath, '..')) {
                    throw new RuntimeException('Percorso file demo non valido.');
                }

                $source = $sourceRoot.'/'.$relativePath;
                if (! is_file($source)) {
                    throw new RuntimeException('File demo mancante: '.$relativePath);
                }

                $target = $targetRoot.'/'.$relativePath;
                File::ensureDirectoryExists(dirname($target));
                File::copy($source, $target);
            }
        }
    }

    private function isTransactionControlStatement(string $statement): bool
    {
        $normalized = strtoupper(rtrim($statement, ';'));

        return $normalized === 'START TRANSACTION'
            || $normalized === 'COMMIT'
            || $normalized === 'SET NAMES UTF8MB4'
            || str_starts_with($normalized, 'SET @CB_PREVIOUS_FK_CHECKS')
            || str_starts_with($normalized, 'SET FOREIGN_KEY_CHECKS');
    }

    private function summary(): array
    {
        return [
            'users' => DB::table('users')->count(),
            'petOwners' => DB::table('users')->where('role', 'pet_owner')->count(),
            'petAssistants' => DB::table('users')->where('role', 'pet_assistant')->count(),
            'pets' => DB::table('ownerpet')->count(),
            'calendarDays' => DB::table('calendar_day')->count(),
        ];
    }
}
