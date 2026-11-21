<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;
use Throwable;

class DemoData
{
    private const HOLISTIC_SNAPSHOT = 'migration/seed_demo_holistic.sql';

    private const SYSTEM_TABLES = [
        'operatortitle',
        'petbreed',
        'pettype',
        'housefeature',
        'service',
        'servicefeature',
        'servicefeaturedata',
        'portal_policy',
        'policy_change_log',
    ];

    private const DATA_TABLES = [
        'booking_action_token',
        'booking_review',
        'reputation_event',
        'booking_reschedule',
        'booking_feature_preference',
        'booking',
        'booking_batch',
        'pet_assistant_favorite',
        'operator_public_profile',
        'profile_reputation',
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
        'assistant_profile',
        'owner_profile',
        'account_profile',
        'social_accounts',
        'user_capabilities',
        'users',
        'messageback',
        'message',
        'error',
    ];

    private const OPERATIONAL_STORAGE_DIRECTORIES = [
        'public' => ['profile-photos', 'operator-gallery', 'owner-pet-gallery'],
        'private' => ['owner-pet-documents'],
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

    private function clearOperationalData(): void
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
                if (! in_array($table, ['operator_public_profile', 'pet_assistant_favorite', 'user_capabilities', 'account_profile', 'owner_profile', 'assistant_profile', 'profile_reputation'], true)) {
                    $connection->statement(sprintf('ALTER TABLE `%s` AUTO_INCREMENT = 1', $table));
                }
            }
        } finally {
            $connection->statement('SET FOREIGN_KEY_CHECKS = 1');
        }
    }

    public function seed(): array
    {
        $snapshotPath = base_path('migration/seed_demo_data.sql');
        $holisticPath = base_path(self::HOLISTIC_SNAPSHOT);
        foreach ([$snapshotPath, $holisticPath] as $path) {
            if (! is_file($path) || ! is_readable($path)) {
                throw new RuntimeException('Snapshot dati demo non disponibile: '.basename($path));
            }
        }
        $storageManifest = $this->loadStorageManifest();

        $this->clearOperationalData();
        $this->runSnapshot($snapshotPath, $holisticPath);
        $this->clearOperationalStorage();
        $this->restoreStorageSnapshot($storageManifest);

        $summary = $this->summary();
        if ($summary['assistantProfiles'] !== 40 || $summary['accounts'] !== 41) {
            throw new RuntimeException('Il dataset demo importato non contiene i 41 account attesi.');
        }

        return $summary;
    }

    public function seedHolisticOperators(): void
    {
        $this->runSnapshot(base_path(self::HOLISTIC_SNAPSHOT));
    }

    public function restoreSystemConfiguration(): array
    {
        $snapshotPath = base_path('migration/seed_system_configuration.sql');
        if (! is_file($snapshotPath) || ! is_readable($snapshotPath)) {
            throw new RuntimeException('Snapshot configurazione di sistema non disponibile.');
        }

        $clearSummary = $this->clearAll();
        $this->runSnapshot($snapshotPath);

        return [
            'tablesCleared' => $clearSummary['tablesCleared'],
            'services' => DB::table('service')->count(),
            'features' => DB::table('servicefeature')->count(),
            'qualifications' => DB::table('operatortitle')->count(),
            'breeds' => DB::table('petbreed')->count(),
            'petTypes' => DB::table('pettype')->count(),
            'houseFeatures' => DB::table('housefeature')->count(),
            'policies' => DB::table('portal_policy')->count(),
            'systemRows' => $this->countRows(self::SYSTEM_TABLES),
            'operationalRows' => $this->countRows(self::DATA_TABLES),
        ];
    }

    private function clearOperationalStorage(): void
    {
        foreach (self::OPERATIONAL_STORAGE_DIRECTORIES as $visibility => $directories) {
            foreach ($directories as $directory) {
                $path = storage_path('app/'.$visibility.'/'.$directory);
                if (File::isDirectory($path) && ! File::deleteDirectory($path)) {
                    throw new RuntimeException('Pulizia storage operativo non riuscita: '.$directory);
                }
            }
        }
    }

    private function countRows(array $tables): int
    {
        return array_sum(array_map(
            static fn (string $table): int => DB::table($table)->count(),
            $tables,
        ));
    }

    private function runSnapshot(string ...$snapshotPaths): void
    {
        $connection = DB::connection();
        $connection->statement('SET FOREIGN_KEY_CHECKS = 0');
        $connection->beginTransaction();

        try {
            foreach ($snapshotPaths as $snapshotPath) {
                foreach ($this->snapshotStatements($snapshotPath) as $statement) {
                    if (! $this->isTransactionControlStatement($statement)) {
                        $connection->unprepared($statement);
                    }
                }
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

    private function snapshotStatements(string $snapshotPath): iterable
    {
        $lines = file($snapshotPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            throw new RuntimeException('Snapshot non leggibile: '.basename($snapshotPath));
        }

        $statement = '';
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '--')) {
                continue;
            }

            $statement .= $line."\n";
            if (str_ends_with($line, ';')) {
                $sql = rtrim($statement);
                yield $sql;
                $statement = '';
            }
        }

        if ($statement !== '') {
            throw new RuntimeException('Istruzione SQL incompleta: '.basename($snapshotPath));
        }
    }

    private function loadStorageManifest(): array
    {
        $snapshotRoot = base_path('migration/demo_storage');
        $manifestPath = $snapshotRoot.'/manifest.json';
        if (! is_file($manifestPath)) {
            throw new RuntimeException('Manifest dei file demo non disponibile.');
        }

        $manifest = json_decode((string) file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
        foreach (['public', 'private'] as $visibility) {
            $sourceRoot = $snapshotRoot.'/'.$visibility;
            foreach (($manifest[$visibility] ?? []) as $relativePath) {
                $relativePath = ltrim(str_replace('\\', '/', (string) $relativePath), '/');
                if ($relativePath === '' || str_contains($relativePath, '..')) {
                    throw new RuntimeException('Percorso file demo non valido.');
                }

                $source = $sourceRoot.'/'.$relativePath;
                if (! is_file($source)) {
                    throw new RuntimeException('File demo mancante: '.$relativePath);
                }
            }
        }

        return $manifest;
    }

    private function restoreStorageSnapshot(array $manifest): void
    {
        $snapshotRoot = base_path('migration/demo_storage');
        foreach (['public', 'private'] as $visibility) {
            $sourceRoot = $snapshotRoot.'/'.$visibility;
            $targetRoot = storage_path('app/'.$visibility);
            foreach (($manifest[$visibility] ?? []) as $relativePath) {
                $relativePath = ltrim(str_replace('\\', '/', (string) $relativePath), '/');
                $source = $sourceRoot.'/'.$relativePath;

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
            'accounts' => DB::table('users')->count(),
            'ownerProfiles' => DB::table('user_capabilities')->where('capability', UserCapability::OWNER)->where('status', UserCapability::STATUS_ACTIVE)->count(),
            'assistantProfiles' => DB::table('user_capabilities')->where('capability', UserCapability::ASSISTANT)->where('status', UserCapability::STATUS_ACTIVE)->count(),
            'pets' => DB::table('ownerpet')->count(),
            'calendarDays' => DB::table('calendar_day')->count(),
        ];
    }
}
