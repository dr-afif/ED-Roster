import { OwnerUxBoundary } from '@/platform/auth';
import { ModulePlaceholderPanel } from '@/shared/ui';

export function MigrationAdminRoute() {
  return (
    <OwnerUxBoundary areaName="Sheets Migration & Reconciliation">
      <ModulePlaceholderPanel
        eyebrow="Owner Administration"
        title="Legacy Sheets Import & Reconciliation"
        description="Review read-only Google Sheets import batches, staff identity mappings, and row/checksum reconciliation reports."
        modulePath="src/features/migration"
        targetWave="Wave B"
        rlsContract="legacy schema tables (import_batches, raw_rows, id_map, reconciliation_results) are unexposed to normal clients and surfaced only to the owner via controlled APIs."
        plannedCapabilities={[
          'Read-only import batch manifest and SHA-256 verification summary (ADR-002).',
          'Ambiguous staff identity collision review before canonical transform.',
          'Period/person/date/shift checksum reconciliation and exception disposition log.',
        ]}
      />
    </OwnerUxBoundary>
  );
}
