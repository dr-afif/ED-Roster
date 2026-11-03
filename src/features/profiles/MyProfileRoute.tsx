import { ModulePlaceholderPanel } from '@/shared/ui';

export function MyProfileRoute() {
  return (
    <ModulePlaceholderPanel
      eyebrow="Staff Identity"
      title="My Profile"
      description="View operational directory identity and maintain permitted personal contact fields."
      modulePath="src/features/profiles"
      targetWave="Wave C"
      rlsContract="Operational staff_directory fields are separated from private staff_profiles rows so row-level security protects personal contact details."
      plannedCapabilities={[
        'Automatic Google identity binding via allowed_users without manual name selection.',
        'Self-service editing restricted to owner-approved profile fields.',
        'Verification status indicators for credentials requiring administrator review.',
      ]}
    />
  );
}
