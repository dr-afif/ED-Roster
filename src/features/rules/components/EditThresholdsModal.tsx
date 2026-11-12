import { useEffect, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, Users, X } from 'lucide-react';
import type { StaffingThresholdRow } from '@/features/rosters/data/rosterQueries';
import { useUpdateStaffingThresholdsMutation } from '@/features/rosters/data/rosterQueries';

export interface EditThresholdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ruleVersionId: number;
  thresholds: StaffingThresholdRow[];
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

interface EditableThreshold {
  id?: number;
  day_type: 'weekday' | 'weekend' | 'holiday';
  shift_bucket: 'am' | 'pm' | 'night';
  min_staff: number;
  target_staff: number;
}

const DEFAULT_BUCKETS: {
  day_type: 'weekday' | 'weekend' | 'holiday';
  shift_bucket: 'am' | 'pm' | 'night';
  label: string;
}[] = [
  { day_type: 'weekday', shift_bucket: 'am', label: 'Weekday Morning (AM)' },
  { day_type: 'weekday', shift_bucket: 'pm', label: 'Weekday Evening (PM)' },
  { day_type: 'weekday', shift_bucket: 'night', label: 'Weekday Night (ON/ND)' },
  { day_type: 'weekend', shift_bucket: 'am', label: 'Weekend Morning (AM)' },
  { day_type: 'weekend', shift_bucket: 'pm', label: 'Weekend Evening (PM)' },
  { day_type: 'weekend', shift_bucket: 'night', label: 'Weekend Night (ON/ND)' },
  { day_type: 'holiday', shift_bucket: 'am', label: 'Holiday Morning (AM)' },
  { day_type: 'holiday', shift_bucket: 'pm', label: 'Holiday Evening (PM)' },
  { day_type: 'holiday', shift_bucket: 'night', label: 'Holiday Night (ON/ND)' },
];

function buildInitialItems(thresholds: StaffingThresholdRow[]): EditableThreshold[] {
  return DEFAULT_BUCKETS.map((def) => {
    const found = thresholds.find(
      (t) => t.day_type === def.day_type && t.shift_bucket === def.shift_bucket,
    );
    return {
      id: found?.id,
      day_type: def.day_type,
      shift_bucket: def.shift_bucket,
      min_staff: found?.min_staff ?? 4,
      target_staff: found?.target_staff ?? 6,
    };
  });
}

interface ThresholdsFormInnerProps {
  onClose: () => void;
  ruleVersionId: number;
  thresholds: StaffingThresholdRow[];
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

function ThresholdsFormInner({
  onClose,
  ruleVersionId,
  thresholds,
  effectiveFrom,
  effectiveTo,
}: ThresholdsFormInnerProps) {
  const [items, setItems] = useState<EditableThreshold[]>(() => buildInitialItems(thresholds));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateMutation = useUpdateStaffingThresholdsMutation(ruleVersionId);

  const handleMinChange = (index: number, val: number) => {
    setItems((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const next = [...prev];
      next[index] = { ...current, min_staff: Math.max(0, val) };
      return next;
    });
  };

  const handleTargetChange = (index: number, val: number) => {
    setItems((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const next = [...prev];
      next[index] = { ...current, target_staff: Math.max(0, val) };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      await updateMutation.mutateAsync(items);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update staffing thresholds.');
    }
  };

  const dayTypeGroups = ['weekday', 'weekend', 'holiday'] as const;

  return (
    <div
      className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border-subtle pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-primary" />
            <h2 id="thresholds-modal-title" className="text-base font-bold text-text-primary">
              Edit Staffing Minimums &amp; Targets
            </h2>
          </div>
          <p className="text-xs text-text-secondary">
            Set required minimum doctor presence per shift bucket to ensure patient safety and zone coverage.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={updateMutation.isPending}
          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Active Scope Pill */}
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-secondary/40 px-3.5 py-2 text-xs text-text-secondary border border-border-subtle">
        <Calendar className="h-4 w-4 text-brand-primary" />
        <span>
          Active Duration:{' '}
          <strong className="text-text-primary font-mono">
            {effectiveFrom ?? '2026-01-01'}
          </strong>{' '}
          to{' '}
          <strong className="text-text-primary font-mono">
            {effectiveTo ?? 'Ongoing / Current'}
          </strong>
        </span>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        {dayTypeGroups.map((dayType) => {
          const groupIndices = items
            .map((item, idx) => (item.day_type === dayType ? idx : -1))
            .filter((idx) => idx !== -1);

          const title =
            dayType === 'weekday'
              ? 'Weekday Staffing (Monday – Friday)'
              : dayType === 'weekend'
                ? 'Weekend Staffing (Saturday – Sunday)'
                : 'Public Holiday Staffing (Gazetted & Ad-hoc)';

          return (
            <div
              key={dayType}
              className="rounded-xl border border-border-subtle bg-surface-secondary/30 p-4 space-y-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                {title}
              </h3>

              <div className="grid gap-3 sm:grid-cols-3">
                {groupIndices.map((idx) => {
                  const item = items[idx];
                  if (!item) return null;
                  const bucketLabel =
                    item.shift_bucket === 'am'
                      ? 'Morning (AM)'
                      : item.shift_bucket === 'pm'
                        ? 'Evening (PM)'
                        : 'Night Duty';

                  return (
                    <div
                      key={item.shift_bucket}
                      className="rounded-xl border border-border-default bg-surface-primary p-3 space-y-2"
                    >
                      <div className="font-semibold text-xs text-text-primary">
                        {bucketLabel}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-text-muted uppercase">
                            Min Staff
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={item.min_staff}
                            onChange={(e) => handleMinChange(idx, Number(e.target.value))}
                            className="h-8 w-full rounded-lg border border-border-default bg-surface-secondary/50 px-2 text-xs font-bold text-center text-text-primary focus:border-brand-primary focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-text-muted uppercase">
                            Target
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={25}
                            value={item.target_staff}
                            onChange={(e) => handleTargetChange(idx, Number(e.target.value))}
                            className="h-8 w-full rounded-lg border border-border-default bg-surface-secondary/50 px-2 text-xs text-center text-text-secondary focus:border-brand-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            disabled={updateMutation.isPending}
            className="rounded-xl border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-xs font-semibold text-text-inverse hover:bg-brand-primary-hover shadow-xs transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Save Staffing Minimums</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export function EditThresholdsModal({
  isOpen,
  onClose,
  ruleVersionId,
  thresholds,
  effectiveFrom,
  effectiveTo,
}: EditThresholdsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="thresholds-modal-title"
      onClick={onClose}
    >
      <ThresholdsFormInner
        key={ruleVersionId}
        onClose={onClose}
        ruleVersionId={ruleVersionId}
        thresholds={thresholds}
        effectiveFrom={effectiveFrom}
        effectiveTo={effectiveTo}
      />
    </div>
  );
}
