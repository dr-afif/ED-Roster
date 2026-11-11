import { useState } from 'react';
import { AlertCircle, AlertTriangle, Lock } from 'lucide-react';
import { Button, Modal } from '@/shared/ui';
import { usePublishRosterMutation } from '../data/rosterQueries';

type PublishModalProps = {
  isOpen: boolean;
  onClose: () => void;
  periodLabel: string;
  periodId: number;
  assignmentCount: number;
  issueCount: number;
  ruleVersion: number;
  onPublished?: () => void;
};

export function PublishModal({
  isOpen,
  onClose,
  periodLabel,
  periodId,
  assignmentCount,
  issueCount,
  ruleVersion,
  onPublished,
}: PublishModalProps) {
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const publishMutation = usePublishRosterMutation(periodId);

  const handlePublish = async () => {
    setErrorMessage(null);
    try {
      await publishMutation.mutateAsync({ notes: notes.trim() || undefined });
      onPublished?.();
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to publish roster. Please try again.',
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Publish ${periodLabel} Roster`}
      description="Freeze draft schedule into an official immutable publication."
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Warning Callout */}
        <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-xs text-text-primary">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div className="space-y-1">
            <p className="font-semibold text-warning">Atomic Publication Invariant</p>
            <p className="text-text-secondary leading-relaxed">
              Once published, all draft cells will be frozen into an immutable baseline (Original
              Planned). Further changes cannot be made directly on the grid and must be recorded as
              audited operational amendments with mandatory reasons.
            </p>
          </div>
        </div>

        {/* Schedule Summary Stats */}
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border-default bg-surface-primary p-3 text-center">
          <div>
            <div className="text-xs text-text-muted">Assigned Shifts</div>
            <div className="text-lg font-bold text-text-primary">{assignmentCount}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Active Rules</div>
            <div className="text-lg font-bold text-brand-primary">v{ruleVersion}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Compliance Issues</div>
            <div
              className={`text-lg font-bold ${issueCount > 0 ? 'text-warning' : 'text-success'}`}
            >
              {issueCount}
            </div>
          </div>
        </div>

        {assignmentCount === 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Cannot publish an empty roster. Please assign shifts first.</span>
          </div>
        )}

        {/* Optional Notes */}
        <div>
          <label htmlFor="pub-notes" className="block text-xs font-medium text-text-secondary mb-1">
            Publication Notes (Optional)
          </label>
          <textarea
            id="pub-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Official publication approved by Clinical Director..."
            className="w-full rounded-xl border border-border-default bg-surface-solid px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
          />
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button variant="secondary" onClick={onClose} disabled={publishMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handlePublish}
            disabled={assignmentCount === 0 || publishMutation.isPending}
            className="gap-2"
          >
            {publishMutation.isPending ? (
              'Publishing...'
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Publish & Freeze Roster
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
