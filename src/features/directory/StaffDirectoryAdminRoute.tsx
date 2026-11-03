import { OwnerUxBoundary } from '@/platform/auth';
import { ModulePlaceholderPanel } from '@/shared/ui';

export function StaffDirectoryAdminRoute() {
  return (
    <OwnerUxBoundary areaName="Staff & Allowlist">
      <ModulePlaceholderPanel
        eyebrow="Owner Administration"
        title="Staff Directory & Approved Emails"
        description="Manage staff operational identities, employment status, and the Google OAuth email allowlist."
        modulePath="src/features/directory"
        targetWave="Wave B"
        rlsContract="Owner manages allowed_users, staff_directory, and staff_profiles; staff are inactivated rather than hard-deleted so historical foreign keys remain intact."
        plannedCapabilities={[
          'Approved Google email allowlist invitation, activation, suspension, and revocation.',
          'Stable staff_code and integer foreign-key identities (never joining by mutable display names).',
          'Historical identity preservation for read-only migrated periods.',
        ]}
      />
    </OwnerUxBoundary>
  );
}
