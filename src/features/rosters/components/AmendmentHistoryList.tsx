import { useState } from 'react';
import { AlertCircle, ArrowRight, Clock, History, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button, Modal, StatusBadge, SurfaceCard } from '@/shared/ui';
import { useReverseAmendmentMutation } from '../data/rosterQueries';
import { formatAmendmentCategoryLabel } from '../domain/amendments';
import type { AmendmentEvent, StaffRosterIdentity } from '../domain/types';

type AmendmentHistoryListProps = {
  periodId: number;
  isOwner: boolean;
  staffList: StaffRosterIdentity[];
  events: AmendmentEvent[];
  isLoading?: boolean;
};

export function AmendmentHistoryList({
  periodId,
  isOwner,
  staffList,
  events,
  isLoading,
}: AmendmentHistoryListProps) {
  const [reversingEvent, setReversingEvent] = useState<AmendmentEvent | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [reversalError, setReversalError] = useState<string | null>(null);

  const reverseMutation = useReverseAmendmentMutation(periodId);

  const staffMap = new Map<number, StaffRosterIdentity>();
  for (const s of staffList) {
    staffMap.set(s.id, s);
  }

  const handleConfirmReversal = async () => {
    if (!reversingEvent) return;
    setReversalError(null);

    try {
      await reverseMutation.mutateAsync({
        eventId: reversingEvent.id,
        reason: reversalReason.trim(),
      });
      setReversingEvent(null);
      setReversalReason('');
    } catch (err) {
      setReversalError(
        err instanceof Error ? err.message : 'Failed to reverse amendment. Please try again.',
      );
    }
  };

  if (isLoading) {
    return (
      <SurfaceCard variant="solid" className="p-8 text-center text-sm text-text-muted">
        Loading amendment history...
      </SurfaceCard>
    );
  }

  if (events.length === 0) {
    return (
      <SurfaceCard variant="solid" className="p-8 text-center space-y-2">
        <ShieldCheck className="mx-auto h-8 w-8 text-success" />
        <h3 className="text-sm font-semibold text-text-primary">Clean Operational Baseline</h3>
        <p className="text-xs text-text-secondary max-w-md mx-auto">
          No operational amendments have been submitted for this period. The live operational
          schedule matches the original planned publication 100%.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-brand-primary" />
          <h2 className="text-sm font-semibold text-text-primary">
            Audit Trail ({events.length} {events.length === 1 ? 'event' : 'events'})
          </h2>
        </div>
        <span className="text-xs text-text-muted font-mono">Append-only audit ledger</span>
      </div>

      <div className="space-y-3">
        {events
          .slice()
          .reverse()
          .map((event) => {
            const isReversed = event.status === 'reversed';
            const isReversalEvent = event.category === 'reversal';

            return (
              <SurfaceCard
                key={event.id}
                variant="solid"
                className={`p-4 transition-all ${
                  isReversed
                    ? 'border-border-subtle bg-surface-muted/40 opacity-75'
                    : isReversalEvent
                      ? 'border-warning/30 bg-warning/5'
                      : 'border-border-default'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-2.5 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-text-primary">
                      Event #{event.id}
                    </span>
                    <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                      {formatAmendmentCategoryLabel(event.category)}
                    </span>
                    <StatusBadge
                      label={isReversed ? 'REVERSED' : 'ACTIVE'}
                      tone={isReversed ? 'neutral' : 'success'}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{new Date(event.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs">
                    <span className="font-medium text-text-secondary">Reason: </span>
                    <span className="text-text-primary">{event.reason}</span>
                  </div>

                  {isReversed && (
                    <div className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
                      <strong>Reversed by Event #{event.reversedByEventId}:</strong>{' '}
                      {event.reversalReason || 'No reason provided'}
                    </div>
                  )}

                  {/* Lines Table */}
                  <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-primary">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-solid border-b border-border-default text-text-muted">
                        <tr>
                          <th className="py-1.5 px-3 font-medium">Doctor</th>
                          <th className="py-1.5 px-3 font-medium">Duty Date</th>
                          <th className="py-1.5 px-3 font-medium">Action</th>
                          <th className="py-1.5 px-3 font-medium">Shift Change</th>
                          <th className="py-1.5 px-3 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {event.lines.map((line, idx) => {
                          const staff = staffMap.get(line.staffId);
                          return (
                            <tr key={idx} className="hover:bg-surface-solid/50">
                              <td className="py-1.5 px-3 font-medium text-text-primary">
                                {staff
                                  ? `${staff.rosterName} (${staff.staffCode})`
                                  : `Staff #${line.staffId}`}
                              </td>
                              <td className="py-1.5 px-3 font-mono text-text-secondary">
                                {line.dutyDate}
                              </td>
                              <td className="py-1.5 px-3">
                                <span className="inline-block uppercase tracking-wider text-[10px] font-semibold text-text-muted">
                                  {line.lineAction}
                                </span>
                              </td>
                              <td className="py-1.5 px-3">
                                <div className="inline-flex items-center gap-1.5 font-mono font-medium">
                                  <span className="rounded bg-surface-muted px-1.5 py-0.5 text-text-muted">
                                    {line.fromShiftCode}
                                  </span>
                                  <ArrowRight className="h-3 w-3 text-text-muted" />
                                  <span className="rounded bg-brand-primary/10 px-1.5 py-0.5 text-brand-primary font-bold">
                                    {line.toShiftCode}
                                  </span>
                                </div>
                              </td>
                              <td className="py-1.5 px-3 text-text-muted italic">
                                {line.notes || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Reversal Action for Owner */}
                  {isOwner && !isReversed && !isReversalEvent && (
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setReversingEvent(event)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-danger hover:underline hover:text-danger/90"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reverse this amendment
                      </button>
                    </div>
                  )}
                </div>
              </SurfaceCard>
            );
          })}
      </div>

      {/* Reversal Confirmation Modal */}
      {reversingEvent && (
        <Modal
          isOpen={Boolean(reversingEvent)}
          onClose={() => setReversingEvent(null)}
          title={`Reverse Amendment #${reversingEvent.id}`}
          description="Create append-only compensating lines to revert this schedule adjustment."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-text-primary">
              Reversing will create a new compensating event that restores affected doctor shifts to
              their previous status. The original event will be marked as reversed for audit
              integrity.
            </div>

            <div>
              <label
                htmlFor="reversal-reason"
                className="block text-xs font-medium text-text-secondary mb-1"
              >
                Mandatory Reversal Reason <span className="text-danger">*</span>
              </label>
              <textarea
                id="reversal-reason"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                rows={3}
                placeholder="e.g. Doctor cleared to return to duty; coverage no longer required..."
                className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
              />
            </div>

            {reversalError && (
              <div className="flex items-center gap-2 rounded-xl bg-danger/10 p-3 text-xs text-danger">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{reversalError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button
                variant="secondary"
                onClick={() => setReversingEvent(null)}
                disabled={reverseMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmReversal}
                disabled={reverseMutation.isPending || reversalReason.trim().length < 3}
                className="gap-2"
              >
                {reverseMutation.isPending ? 'Reversing...' : 'Confirm Reversal'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
