import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  XCircle,
} from 'lucide-react';
import { useAuth, OwnerUxBoundary } from '@/platform/auth';
import { Button, Modal, PageHeader, StatusBadge, SurfaceCard } from '@/shared/ui';
import { FormField } from '@/shared/forms';
import {
  useRequestTypesQuery,
  useMyRequestsQuery,
  useCreateRequestMutation,
  useWithdrawRequestMutation,
  useAllRequestsAdminQuery,
  useDecideRequestMutation,
  type StaffRequestRecord,
} from './useRequests';

function calculateDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diffTime = e.getTime() - s.getTime();
  if (diffTime < 0) return 0;
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Self-Service Requests Route (`/requests`)
 */
export function StaffRequestsRoute() {
  const { user } = useAuth();
  void user;
  const { data: requestTypes = [], isLoading: isLoadingTypes } = useRequestTypesQuery();
  const { data: requests = [], isLoading: isLoadingRequests, error } = useMyRequestsQuery();
  const createMutation = useCreateRequestMutation();
  const withdrawMutation = useWithdrawRequestMutation();

  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Request Form State
  const [selectedTypeId, setSelectedTypeId] = useState<number>(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reasonCategory, setReasonCategory] = useState('personal');
  const [notes, setNotes] = useState('');
  const [requestedShift, setRequestedShift] = useState('');

  const selectedType = requestTypes.find((t) => t.id === selectedTypeId) ?? requestTypes[0];
  const requestedDays = calculateDays(startDate, endDate);

  function handleOpenSubmit() {
    setFormError(null);
    if (requestTypes.length > 0 && requestTypes[0]) {
      setSelectedTypeId(requestTypes[0].id);
    }
    setStartDate('2027-01-08');
    setEndDate('2027-01-10');
    setReasonCategory('personal');
    setNotes('');
    setRequestedShift('');
    setIsSubmitOpen(true);
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!selectedType) {
      setFormError('Please select a valid request type.');
      return;
    }
    if (!startDate || !endDate) {
      setFormError('Start date and end date are required.');
      return;
    }
    if (startDate > endDate) {
      setFormError('End date cannot be earlier than start date.');
      return;
    }
    if (requestedDays > selectedType.max_days_per_request) {
      setFormError(
        `This request exceeds the maximum allowed duration of ${selectedType.max_days_per_request} days for ${selectedType.label}.`,
      );
      return;
    }

    try {
      await createMutation.mutateAsync({
        request_type_id: selectedType.id,
        start_date: startDate,
        end_date: endDate,
        reason_category: reasonCategory,
        notes: notes.trim() || undefined,
        requested_shift_code: requestedShift.trim() || undefined,
        period_start_date: '2027-01-01',
      });
      setIsSubmitOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit request.');
    }
  }

  async function handleWithdraw(id: number) {
    if (!window.confirm('Are you sure you want to withdraw this request?')) {
      return;
    }
    try {
      await withdrawMutation.mutateAsync(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to withdraw request.');
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'submitted').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Self-Service Requests"
        title="Roster & Leave Requests"
        description="Submit leave and shift preferences for upcoming periods, and track administrative review status."
        actions={<StatusBadge label="January 2027 Active" tone="teal" />}
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SurfaceCard className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-secondary">Pending Approval</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{pendingCount}</p>
          </div>
          <div className="rounded-xl bg-warning-soft p-3 text-warning">
            <Clock className="h-6 w-6" aria-hidden="true" />
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-secondary">Approved Requests</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{approvedCount}</p>
          </div>
          <div className="rounded-xl bg-success-soft p-3 text-success">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-secondary">Rejected / Withdrawn</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">
              {rejectedCount + requests.filter((r) => r.status === 'withdrawn').length}
            </p>
          </div>
          <div className="rounded-xl bg-surface-muted p-3 text-text-secondary">
            <XCircle className="h-6 w-6" aria-hidden="true" />
          </div>
        </SurfaceCard>
      </div>

      {/* Action Toolbar */}
      <SurfaceCard className="p-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">My Submitted Requests</h2>
          <p className="text-xs text-text-secondary">Target Period: January 2027 Cycle</p>
        </div>
        <Button variant="primary" onClick={handleOpenSubmit} disabled={isLoadingTypes}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Submit Request</span>
        </Button>
      </SurfaceCard>

      {/* Requests History Table */}
      <SurfaceCard className="overflow-hidden">
        {isLoadingRequests ? (
          <div className="p-12 text-center text-sm text-text-secondary">
            Loading your roster requests...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-danger" role="alert">
            Failed to load requests: {error.message}
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="mx-auto h-8 w-8 text-text-secondary" />
            <p className="text-sm font-medium text-text-primary">No requests submitted yet</p>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Submit planned leave, continuous medical education (CME) days, or shift preferences
              for January 2027.
            </p>
            <div className="pt-2">
              <Button variant="primary" onClick={handleOpenSubmit}>
                Submit First Request
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-subtle bg-surface-muted/60 text-xs font-semibold text-text-secondary uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Dates & Duration
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Reason Category
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Notes / Justification
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Submitted At
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {requests.map((req) => {
                  const days = calculateDays(req.start_date, req.end_date);
                  const isPending = req.status === 'submitted' || req.status === 'draft';

                  return (
                    <tr key={req.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary">
                        <span className="font-semibold">{req.request_type.label}</span>
                        {req.requested_shift_code && (
                          <span className="ml-2 font-mono text-xs rounded bg-surface-muted px-1.5 py-0.5">
                            {req.requested_shift_code}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-mono text-text-primary">
                          {req.start_date}{' '}
                          {req.start_date !== req.end_date ? `to ${req.end_date}` : ''}
                        </div>
                        <span className="text-text-secondary">
                          {days} {days === 1 ? 'day' : 'days'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-text-secondary">
                        {req.reason_category}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate text-text-secondary">
                        {req.notes || <span className="italic text-slate-400">None provided</span>}
                        {req.decision_reason && (
                          <div className="mt-1 font-semibold text-text-primary">
                            Decision note: {req.decision_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {new Date(req.submitted_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={req.status.toUpperCase()}
                          tone={
                            req.status === 'approved'
                              ? 'success'
                              : req.status === 'rejected'
                                ? 'danger'
                                : req.status === 'submitted'
                                  ? 'warning'
                                  : 'neutral'
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleWithdraw(req.id)}
                            disabled={withdrawMutation.isPending}
                            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary focus-visible:outline-brand-primary"
                          >
                            <Undo2 className="mr-1 h-3.5 w-3.5" />
                            Withdraw
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {/* New Request Modal */}
      <Modal
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        title="Submit Roster Request"
        description="Select the request category, target dates, and non-clinical operational justification."
        maxWidth="md"
      >
        <form onSubmit={handleSubmitRequest} className="space-y-4">
          {formError && (
            <div
              className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
              role="alert"
            >
              {formError}
            </div>
          )}

          <FormField id="req-type" label="Request Category" required>
            <select
              id="req-type"
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(Number(e.target.value))}
              className="w-full rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
            >
              {requestTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} (Max: {t.max_days_per_request} days, Min Lead: {t.min_lead_days}d)
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="req-start" label="Start Date" required>
              <input
                id="req-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
              />
            </FormField>

            <FormField id="req-end" label="End Date" required>
              <input
                id="req-end"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
              />
            </FormField>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-muted p-3 text-xs text-text-secondary">
            <span>
              Duration:{' '}
              <strong className="text-text-primary font-mono">{requestedDays} days</strong>
            </span>
            {selectedType && (
              <span>
                Policy Maximum:{' '}
                <strong className="text-text-primary font-mono">
                  {selectedType.max_days_per_request} days
                </strong>
              </span>
            )}
          </div>

          <FormField id="req-reason-cat" label="Reason Category" required>
            <select
              id="req-reason-cat"
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
            >
              <option value="personal">Personal / Family</option>
              <option value="academic">Academic / Exam / CME Course</option>
              <option value="operational">Operational Exchange</option>
              <option value="medical">Medical / Compassionate</option>
              <option value="other">Other</option>
            </select>
          </FormField>

          <FormField
            id="req-notes"
            label="Operational Notes"
            hint="Strictly omit medical diagnoses or confidential clinical details per project security rules."
          >
            <textarea
              id="req-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Attending Emergency Ultrasound workshop in Kuala Lumpur."
              className="w-full rounded-xl border border-border-subtle bg-surface-solid p-3 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <Button variant="secondary" onClick={() => setIsSubmitOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/**
 * Owner Requests Review Route (`/admin/requests`)
 */
export function AdminRequestsRoute() {
  const { data: allRequests = [], isLoading, error } = useAllRequestsAdminQuery();
  const decideMutation = useDecideRequestMutation();

  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected'>(
    'all',
  );
  const [selectedRequest, setSelectedRequest] = useState<StaffRequestRecord | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredRequests = allRequests.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const pendingCount = allRequests.filter((r) => r.status === 'submitted').length;
  const approvedCount = allRequests.filter((r) => r.status === 'approved').length;
  const rejectedCount = allRequests.filter((r) => r.status === 'rejected').length;

  function handleOpenReview(req: StaffRequestRecord) {
    setSelectedRequest(req);
    setDecisionReason('');
    setActionError(null);
  }

  async function handleExecuteDecision(decision: 'approved' | 'rejected') {
    if (!selectedRequest) return;
    setActionError(null);

    if (decision === 'rejected' && !decisionReason.trim()) {
      setActionError('Please provide an operational reason when rejecting a request.');
      return;
    }

    try {
      await decideMutation.mutateAsync({
        request_id: selectedRequest.id,
        decision,
        reason: decisionReason.trim() || undefined,
      });
      setSelectedRequest(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to record decision.');
    }
  }

  return (
    <OwnerUxBoundary areaName="Requests Administration">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Owner Administration"
          title="Staff Request Review & Decisions"
          description="Review submitted roster requests, evaluate department coverage, and record audited decisions with automatic leave linkage."
          actions={<StatusBadge label="Audit Triggers Active" tone="teal" />}
        />

        {/* Metrics Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SurfaceCard className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Pending Decision</p>
              <p className="mt-1 text-2xl font-bold text-warning">{pendingCount}</p>
            </div>
            <div className="rounded-xl bg-warning-soft p-3 text-warning">
              <Clock className="h-6 w-6" aria-hidden="true" />
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Approved</p>
              <p className="mt-1 text-2xl font-bold text-success">{approvedCount}</p>
            </div>
            <div className="rounded-xl bg-success-soft p-3 text-success">
              <ThumbsUp className="h-6 w-6" aria-hidden="true" />
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Rejected</p>
              <p className="mt-1 text-2xl font-bold text-danger">{rejectedCount}</p>
            </div>
            <div className="rounded-xl bg-danger-soft p-3 text-danger">
              <ThumbsDown className="h-6 w-6" aria-hidden="true" />
            </div>
          </SurfaceCard>
        </div>

        {/* Filter Bar */}
        <SurfaceCard className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-text-secondary" />
            <span className="text-xs font-medium text-text-secondary">Filter Status:</span>
            <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface-muted p-1 text-xs">
              {(['all', 'submitted', 'approved', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-surface-solid text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {s === 'submitted' ? 'Pending' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-text-secondary">
            Showing {filteredRequests.length} requests
          </span>
        </SurfaceCard>

        {/* Requests Table */}
        <SurfaceCard className="overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-text-secondary">
              Loading staff requests...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-danger" role="alert">
              Failed to load requests: {error.message}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-sm text-text-secondary">
              No staff requests found for current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-subtle bg-surface-muted/60 text-xs font-semibold text-text-secondary uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Staff Member
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Requested Dates
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Reason Category
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Staff Notes
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredRequests.map((req) => {
                    const days = calculateDays(req.start_date, req.end_date);
                    const isPending = req.status === 'submitted';

                    return (
                      <tr key={req.id} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-text-primary">
                            {req.staff?.roster_name ?? `Staff #${req.staff_id}`}
                          </div>
                          <div className="text-xs text-text-secondary font-mono">
                            {req.staff?.staff_code} · {req.staff?.staff_group}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {req.request_type.label}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-mono text-text-primary">
                            {req.start_date}{' '}
                            {req.start_date !== req.end_date ? `to ${req.end_date}` : ''}
                          </div>
                          <span className="text-text-secondary">
                            {days} {days === 1 ? 'day' : 'days'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs capitalize text-text-secondary">
                          {req.reason_category}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-xs truncate text-text-secondary">
                          {req.notes || <span className="italic text-slate-400">None</span>}
                          {req.decision_reason && (
                            <div className="mt-1 font-semibold text-text-primary">
                              Decision: {req.decision_reason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            label={req.status.toUpperCase()}
                            tone={
                              req.status === 'approved'
                                ? 'success'
                                : req.status === 'rejected'
                                  ? 'danger'
                                  : req.status === 'submitted'
                                    ? 'warning'
                                    : 'neutral'
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isPending ? (
                            <Button
                              variant="primary"
                              onClick={() => handleOpenReview(req)}
                              className="min-h-9 px-3 py-1 text-xs"
                            >
                              Review & Decide
                            </Button>
                          ) : (
                            <span className="text-xs text-text-secondary italic">Decided</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>

        {/* Decision Modal */}
        <Modal
          isOpen={selectedRequest !== null}
          onClose={() => setSelectedRequest(null)}
          title="Review Staff Request"
          description={`Submit administrative decision for ${selectedRequest?.staff?.roster_name} (${selectedRequest?.staff?.staff_code}).`}
          maxWidth="md"
        >
          {selectedRequest && (
            <div className="space-y-4">
              {actionError && (
                <div
                  className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
                  role="alert"
                >
                  {actionError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-muted p-4 text-xs">
                <div>
                  <span className="text-text-secondary">Staff Member:</span>
                  <p className="font-semibold text-text-primary mt-0.5">
                    {selectedRequest.staff?.roster_name} ({selectedRequest.staff?.display_name})
                  </p>
                </div>
                <div>
                  <span className="text-text-secondary">Category:</span>
                  <p className="font-semibold text-text-primary mt-0.5">
                    {selectedRequest.request_type.label}
                  </p>
                </div>
                <div>
                  <span className="text-text-secondary">Target Dates:</span>
                  <p className="font-mono font-medium text-text-primary mt-0.5">
                    {selectedRequest.start_date} to {selectedRequest.end_date} (
                    {calculateDays(selectedRequest.start_date, selectedRequest.end_date)} days)
                  </p>
                </div>
                <div>
                  <span className="text-text-secondary">Reason Category:</span>
                  <p className="capitalize font-medium text-text-primary mt-0.5">
                    {selectedRequest.reason_category}
                  </p>
                </div>
              </div>

              {selectedRequest.notes && (
                <div className="rounded-xl border border-border-subtle p-3 text-xs">
                  <span className="font-medium text-text-secondary">Staff Notes:</span>
                  <p className="mt-1 text-text-primary">{selectedRequest.notes}</p>
                </div>
              )}

              <FormField
                id="decision-reason"
                label="Operational Decision Note"
                hint="Required for rejections. When approved, leave records are automatically created for leave categories."
              >
                <textarea
                  id="decision-reason"
                  rows={3}
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="e.g. Approved within quota. Coverage confirmed by MO roster pool."
                  className="w-full rounded-xl border border-border-subtle bg-surface-solid p-3 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
                />
              </FormField>

              <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                <Button variant="secondary" onClick={() => setSelectedRequest(null)}>
                  Cancel
                </Button>

                <div className="flex items-center gap-3">
                  <Button
                    variant="danger"
                    onClick={() => handleExecuteDecision('rejected')}
                    disabled={decideMutation.isPending}
                  >
                    <ThumbsDown className="mr-1.5 h-4 w-4" />
                    Reject Request
                  </Button>

                  <Button
                    variant="primary"
                    onClick={() => handleExecuteDecision('approved')}
                    disabled={decideMutation.isPending}
                  >
                    <ThumbsUp className="mr-1.5 h-4 w-4" />
                    Approve Request
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </OwnerUxBoundary>
  );
}
