import { OwnerUxBoundary } from '@/platform/auth';
import { ModulePlaceholderPanel } from '@/shared/ui';

export function StaffRequestsRoute() {
  return (
    <ModulePlaceholderPanel
      eyebrow="Self-Service Requests"
      title="Roster Requests"
      description="Submit, review, and withdraw personal roster requests within configured quota and lead-time rules."
      modulePath="src/features/requests"
      targetWave="Wave C"
      rlsContract="Active staff can create, read, and update permitted states on their own roster_requests rows; status transitions append to request_status_events."
      plannedCapabilities={[
        'Typed request submission form validated with React Hook Form and Zod on blur/submit.',
        'Quota, weekend, and lead-time feedback derived from active rule versions.',
        'Append-only request_status_events timeline without medical diagnosis fields.',
      ]}
    />
  );
}

export function AdminRequestsRoute() {
  return (
    <OwnerUxBoundary areaName="Requests Administration">
      <ModulePlaceholderPanel
        eyebrow="Owner Administration"
        title="Manage Staff Requests"
        description="Review submitted shift and leave requests, record structured decisions, and link operational absences."
        modulePath="src/features/requests"
        targetWave="Wave C"
        rlsContract="Owner role verified against allowed_users manages all roster_requests and leave_records with audited status events."
        plannedCapabilities={[
          'Period and status filtering across submitted staff requests.',
          'Audited approve/reject transitions with structured operational reasons.',
          'Administrative leave record linkage without clinical diagnosis storage.',
        ]}
      />
    </OwnerUxBoundary>
  );
}
