<?php

namespace Tests\Feature;

use App\Models\DemoData;
use ReflectionClass;
use Tests\TestCase;

class DemoDataMaintenanceTest extends TestCase
{
    public function test_system_and_operational_tables_partition_the_final_schema(): void
    {
        $schemaTables = $this->schemaTables();
        $systemTables = $this->constant('SYSTEM_TABLES');
        $operationalTables = $this->constant('DATA_TABLES');

        $this->assertSame([], array_values(array_intersect($systemTables, $operationalTables)));
        $this->assertSame($schemaTables, $this->sorted([...$systemTables, ...$operationalTables]));
        $this->assertCount(46, $schemaTables);
        $this->assertCount(9, $systemTables);
        $this->assertCount(37, $operationalTables);
    }

    public function test_system_snapshot_touches_every_system_table_and_no_operational_table(): void
    {
        $sql = (string) file_get_contents(base_path('migration/seed_system_configuration.sql'));
        $affectedTables = $this->statementTables($sql, 'DELETE FROM|INSERT INTO');

        $this->assertSame($this->sorted($this->constant('SYSTEM_TABLES')), $affectedTables);
        $this->assertSame([], array_values(array_intersect(
            $affectedTables,
            $this->constant('DATA_TABLES'),
        )));
    }

    public function test_demo_snapshot_clears_every_operational_table_and_preserves_system_tables(): void
    {
        $sql = (string) file_get_contents(base_path('migration/seed_demo_data.sql'));
        $deletedTables = $this->statementTables($sql, 'DELETE FROM');

        $this->assertSame($this->sorted($this->constant('DATA_TABLES')), $deletedTables);
        $this->assertSame([], array_values(array_intersect(
            $deletedTables,
            $this->constant('SYSTEM_TABLES'),
        )));
    }

    public function test_demo_storage_manifest_is_covered_by_operational_cleanup(): void
    {
        $manifest = json_decode(
            (string) file_get_contents(base_path('migration/demo_storage/manifest.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
        $directories = $this->constant('OPERATIONAL_STORAGE_DIRECTORIES');

        foreach (['public', 'private'] as $visibility) {
            foreach ($manifest[$visibility] ?? [] as $relativePath) {
                $covered = array_filter(
                    $directories[$visibility] ?? [],
                    static fn (string $directory): bool => str_starts_with((string) $relativePath, $directory.'/'),
                );
                $this->assertNotEmpty($covered, $visibility.':'.$relativePath);
            }
        }
    }

    private function schemaTables(): array
    {
        $schema = (string) file_get_contents(base_path('migration/migration.txt'));
        preg_match_all('/CREATE TABLE IF NOT EXISTS `([^`]+)`/', $schema, $matches);

        return $this->sorted($matches[1] ?? []);
    }

    private function statementTables(string $sql, string $verbs): array
    {
        preg_match_all('/(?:'.$verbs.') `([^`]+)`/i', $sql, $matches);

        return $this->sorted(array_values(array_unique($matches[1] ?? [])));
    }

    private function constant(string $name): array
    {
        return (new ReflectionClass(DemoData::class))->getReflectionConstant($name)->getValue();
    }

    private function sorted(array $values): array
    {
        sort($values);

        return array_values($values);
    }
}
