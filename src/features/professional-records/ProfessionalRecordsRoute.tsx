import { ModulePlaceholderPanel } from '@/shared/ui';

export function ProfessionalRecordsRoute() {
  return (
    <ModulePlaceholderPanel
      eyebrow="Credentials & Training"
      title="Professional Records"
      description="Track courses, annual practicing certificates, verification status, and renewal dates."
      modulePath="src/features/professional-records"
      targetWave="Wave C"
      rlsContract="Staff read their own professional_records rows; owner manages all staff records and verification transitions."
      plannedCapabilities={[
        'Courses and Annual Practicing Certificate (APC) timelines with text + icon expiry badges.',
        'Owner verification workflow for newly submitted or renewed credentials.',
        'Authorized links to corresponding Google Drive certificate files by stable file ID.',
      ]}
    />
  );
}
