import { useState } from 'react';
import { AlertCircle, Award, Lock, Unlock } from 'lucide-react';
import { Button, Modal } from '@/shared/ui';
import { useCloseRosterMutation, useReopenRosterMutation } from '../data/rosterQueries';
import type { GoffDisplacementCandidate } from '../domain/goff';
import type { StaffRosterIdentity } from '../domain/types';

type CloseReconcileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  periodId: number;
  periodLabel: string;
  isClosed: boolean;
  plannedCount: number;
  amendmentCount: number;
  accruedGoffCandidates: GoffDisplacementCandidate[];
  staffList: StaffRosterIdentity[];
  onSuccess?: () => void;
};

export function CloseReconcileModal({
  isOpen,
  onClose,
  periodId,
  periodLabel,
  isClosed,
  plannedCount,
  amendmentCount,
  accruedGoffCandidates,
  staffList,
  onSuccess,
}: CloseReconcileModalProps) {
  const [notesOrReason, setNotesOrReason] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  const closeMutation = useCloseRosterMutation(periodId);
  const reopenMutation = useReopenRosterMutation(periodId);

  const isPending = closeMutation.isPending || reopenMutation.isPending;

  const staffMap = new Map<number, StaffRosterIdentity>();
  for (const s of staffList) {
    staffMap.set(s.id, s);
  }

  const handleAction = async () => {
    setActionError(null);
    try {
      if (isClosed) {
        // Reopening requires mandatory reason
        if (notesOrReason.trim().length < 3) {
          setActionError('A mandatory operational reason is required to reopen a closed roster.');
          return;
        }
        await reopenMutation.mutateAsync({ reason: notesOrReason.trim() });
      } else {
        // Closing accepts optional notes
        await closeMutation.mutateAsync({ notes: notesOrReason.trim() || undefined });
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Operation failed. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isClosed ? `Reopen ${periodLabel} Roster` : `Finalize & Close ${periodLabel} Roster`}
      description={
        isClosed
          ? 'Re-enable operational amendments with full audit accountability.'
          : 'Reconcile compensatory rest and seal this monthly operational cycle.'
      }
      maxWidth="md"
    >
      <div className="space-y-4">
        {isClosed ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-text-primary leading-relaxed">
              <strong>Administrative Reopen:</strong> Reopening a closed roster enables further
              operational amendments. Every reopen action is strictly recorded in the immutable
              audit events log.
            </div>

            <div>
              <label
                htmlFor="reopen-reason"
                className="block text-xs font-medium text-text-secondary mb-1"
              >
                Mandatory Operational Reason <span className="text-danger">*</span>
              </label>
              <textarea
                id="reopen-reason"
                value={notesOrReason}
                onChange={(e) => setNotesOrReason(e.target.value)}
                rows={3}
                placeholder="e.g. Retroactive clinical attendance reconciliation required by Department Head..."
                className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Reconciliation Statistics */}
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border-default bg-surface-primary p-3 text-center">
              <div>
                <div className="text-xs text-text-muted">Total Planned Shifts</div>
                <div className="text-lg font-bold text-text-primary">{plannedCount}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Amendments Logged</div>
                <div className="text-lg font-bold text-brand-primary">{amendmentCount}</div>
              </div>
            </div>

            {/* Compensatory Rest (GOFF) Reconciliation Callout */}
            {accruedGoffCandidates.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-brand-primary/30 bg-brand-primary/10 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-brand-primary">
                  <Award className="h-4 w-4" />
                  <span>
                    Compensatory Rest Accruals ({accruedGoffCandidates.length}{' '}
                    {accruedGoffCandidates.length === 1 ? 'doctor' : 'doctors'})
                  </span>
                </div>
                <p className="text-text-secondary">
                  The following off-duty doctors provided emergency clinical coverage and qualify
                  for +1 GOFF compensatory rest:
                </p>
                <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-border-subtle">
                  {accruedGoffCandidates.map((c, idx) => {
                    const staff = staffMap.get(c.staffId);
                    return (
                      <div key={idx} className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-text-primary">
                          {staff?.rosterName ?? `Staff #${c.staffId}`} ({c.dutyDate})
                        </span>
                        <span className="font-mono text-brand-primary font-bold">+1 GOFF</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border-default bg-surface-primary p-3 text-xs text-text-muted">
                No off-displacement compensatory rest accruals detected for this cycle.
              </div>
            )}

            <div>
              <label
                htmlFor="close-notes"
                className="block text-xs font-medium text-text-secondary mb-1"
              >
                Final Closing Notes (Optional)
              </label>
              <textarea
                id="close-notes"
                value={notesOrReason}
                onChange={(e) => setNotesOrReason(e.target.value)}
                rows={2}
                placeholder="e.g. Month-end attendance reconciled and approved..."
                className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>
        )}

        {actionError && (
          <div className="flex items-center gap-2 rounded-xl bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={isClosed ? 'primary' : 'secondary'}
            onClick={handleAction}
            disabled={isPending || (isClosed && notesOrReason.trim().length < 3)}
            className="gap-2"
          >
            {isPending ? (
              'Processing...'
            ) : isClosed ? (
              <>
                <Unlock className="h-4 w-4" />
                Confirm Reopen
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Finalize & Close
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
