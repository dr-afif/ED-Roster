import { ModulePlaceholderPanel } from '@/shared/ui';

export function UpdatesRoute() {
  return (
    <ModulePlaceholderPanel
      eyebrow="Department Notices"
      title="Operational Updates"
      description="Published roster notices, policy effective-date announcements, and cutover communications."
      modulePath="src/features/updates"
      targetWave="Wave C"
      rlsContract="Approved active staff read shared operational notices; only the owner publishes or updates department announcements."
      plannedCapabilities={[
        'Chronological publication and roster amendment summaries visible to approved staff.',
        'Effective-dated rule change notices linked to active rule versions.',
        'Clear read-only cutover banners during the January 2027 transition window.',
      ]}
    />
  );
}
