import { ModulePlaceholderPanel } from '@/shared/ui';

export function DocumentsCatalogRoute() {
  return (
    <ModulePlaceholderPanel
      eyebrow="Controlled Document Navigator"
      title="Documents Catalog"
      description="Search Supabase document metadata and navigate to authorized Google Drive files."
      modulePath="src/features/documents"
      targetWave="Wave C"
      rlsContract="Supabase document_records enforces visibility (owner, self_and_owner, all_staff); Drive bytes are stored in a controlled Google Drive hierarchy via Edge Functions."
      plannedCapabilities={[
        'Fast metadata filtering by category, year, expiry/issue date, and status without crawling Drive.',
        'Stable drive_file_id resolution resilient to human folder renames.',
        'Immutable archived roster PDF catalog entries with SHA-256 verification metadata.',
      ]}
    />
  );
}
