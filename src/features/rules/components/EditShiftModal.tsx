import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, ShieldCheck, X } from 'lucide-react';
import type { ShiftDefinitionRow, ShiftSemanticRow } from '@/features/rosters/data/rosterQueries';
import {
  useCreateShiftDefinitionMutation,
  useUpdateShiftDefinitionMutation,
} from '@/features/rosters/data/rosterQueries';
import { SHIFT_COLOR_OPTIONS } from '../domain/shiftThemes';

export interface EditShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftDef?: ShiftDefinitionRow | null;
  semantics?: ShiftSemanticRow | null;
}

interface ShiftFormInnerProps {
  onClose: () => void;
  shiftDef?: ShiftDefinitionRow | null;
  semantics?: ShiftSemanticRow | null;
}

function calculateShiftDuration(start: string, end: string): number {
  if (!start || !end) return 0;
  const startParts = start.split(':');
  const endParts = end.split(':');
  if (startParts.length < 2 || endParts.length < 2) return 0;
  const sh = Number(startParts[0]);
  const sm = Number(startParts[1]);
  const eh = Number(endParts[0]);
  const em = Number(endParts[1]);
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return 0;
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) {
    endMin += 24 * 60; // Crosses midnight (e.g. 23:00 to 08:00)
  }
  const diff = (endMin - startMin) / 60;
  return Math.round(diff * 100) / 100;
}

function ShiftFormInner({ onClose, shiftDef, semantics }: ShiftFormInnerProps) {
  const isCreateMode = !shiftDef;

  const [code, setCode] = useState(shiftDef?.code ?? '');
  const [label, setLabel] = useState(shiftDef?.label ?? '');
  const [shortLabel, setShortLabel] = useState(shiftDef?.short_label ?? '');
  const [colorToken, setColorToken] = useState<string>(shiftDef?.color_token ?? 'am');
  const [sortOrder, setSortOrder] = useState<number>(shiftDef?.sort_order ?? 100);
  const [isActive, setIsActive] = useState<boolean>(shiftDef?.is_active ?? true);

  // Timings & Working Hours
  const initialStart = shiftDef?.start_time ? shiftDef.start_time.slice(0, 5) : '';
  const initialEnd = shiftDef?.end_time ? shiftDef.end_time.slice(0, 5) : '';
  const [startTime, setStartTime] = useState<string>(initialStart);
  const [endTime, setEndTime] = useState<string>(initialEnd);
  const [durationHours, setDurationHours] = useState<number>(
    shiftDef?.duration_hours ? Number(shiftDef.duration_hours) : calculateShiftDuration(initialStart, initialEnd),
  );

  const [semanticClass, setSemanticClass] = useState<
    'worked' | 'transparent' | 'reset' | 'unknown'
  >((semantics?.semantic_class as 'worked' | 'transparent' | 'reset' | 'unknown') ?? 'worked');
  const [providesCoverage, setProvidesCoverage] = useState<boolean>(
    semantics?.provides_coverage ?? true,
  );
  const [nightPolicyBQualifying, setNightPolicyBQualifying] = useState<boolean>(
    semantics?.night_policy_b_qualifying ?? false,
  );
  const [displacesOffEarnsGoff, setDisplacesOffEarnsGoff] = useState<boolean>(
    semantics?.displaces_off_earns_goff ?? false,
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateMutation = useUpdateShiftDefinitionMutation();
  const createMutation = useCreateShiftDefinitionMutation();

  const isSubmitting = updateMutation.isPending || createMutation.isPending;

  // Auto-recalculate duration when start or end time changes
  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    if (newStart && endTime) {
      setDurationHours(calculateShiftDuration(newStart, endTime));
    }
  };

  const handleEndTimeChange = (newEnd: string) => {
    setEndTime(newEnd);
    if (startTime && newEnd) {
      setDurationHours(calculateShiftDuration(startTime, newEnd));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedCode = code.trim().toUpperCase();
    const trimmedLabel = label.trim();
    const trimmedShortLabel = (shortLabel.trim() || trimmedCode).toUpperCase();

    if (!trimmedCode) {
      setErrorMessage('Please enter a shift code.');
      return;
    }

    if (!/^[A-Z0-9_-]{1,10}$/.test(trimmedCode)) {
      setErrorMessage('Shift code must be 1 to 10 alphanumeric characters (e.g., AM, PM, ON1).');
      return;
    }

    if (trimmedLabel.length < 3) {
      setErrorMessage('Shift description and timing must be at least 3 characters.');
      return;
    }

    const formattedStartTime = startTime ? `${startTime}:00` : null;
    const formattedEndTime = endTime ? `${endTime}:00` : null;
    const computedDuration = formattedStartTime && formattedEndTime ? durationHours : 0;

    try {
      if (isCreateMode) {
        await createMutation.mutateAsync({
          code: trimmedCode,
          label: trimmedLabel,
          shortLabel: trimmedShortLabel,
          colorToken,
          sortOrder,
          isActive,
          startTime: formattedStartTime,
          endTime: formattedEndTime,
          durationHours: computedDuration,
          semanticClass,
          providesCoverage,
          nightPolicyBQualifying,
          displacesOffEarnsGoff,
        });
      } else {
        await updateMutation.mutateAsync({
          code: trimmedCode,
          label: trimmedLabel,
          shortLabel: trimmedShortLabel,
          colorToken,
          sortOrder,
          isActive,
          startTime: formattedStartTime,
          endTime: formattedEndTime,
          durationHours: computedDuration,
          semanticClass,
          providesCoverage,
          nightPolicyBQualifying,
          displacesOffEarnsGoff,
        });
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save shift definition.';
      setErrorMessage(msg);
    }
  };

  const selectedColorOption =
    SHIFT_COLOR_OPTIONS.find((c) => c.value === colorToken) ?? SHIFT_COLOR_OPTIONS[0];

  return (
    <div
      className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border-subtle pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-brand-primary" />
            <h2 id="shift-modal-title" className="text-base font-bold text-text-primary">
              {isCreateMode ? 'Create New Shift & Timings' : `Edit Shift: ${code}`}
            </h2>
          </div>
          <p className="text-xs text-text-secondary">
            Configure working hours window, display label, badge theme, and deterministic rules semantics.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        {/* SECTION 1: IDENTITY & BADGE */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
            1. Shift Identity &amp; Badge
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="shift-code-input" className="text-xs font-semibold text-text-primary">
                Shift Code <span className="text-rose-500">*</span>
              </label>
              {isCreateMode ? (
                <input
                  id="shift-code-input"
                  type="text"
                  required
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AM2, CLINIC"
                  className="h-9 w-full rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-xs font-mono font-bold uppercase text-text-primary focus:border-brand-primary focus:outline-none"
                />
              ) : (
                <div className="flex h-9 items-center rounded-xl border border-border-default bg-surface-secondary/70 px-3 text-xs font-mono font-bold text-text-primary">
                  {code}
                </div>
              )}
              <p className="text-[11px] text-text-muted">
                {isCreateMode
                  ? 'Canonical unique identifier (e.g. AM, PM, ON).'
                  : 'Immutable unique identifier used in historical audit logs.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="shift-short-label" className="text-xs font-semibold text-text-primary">
                Grid Short Label <span className="text-rose-500">*</span>
              </label>
              <input
                id="shift-short-label"
                type="text"
                required
                maxLength={6}
                value={shortLabel}
                onChange={(e) => setShortLabel(e.target.value)}
                placeholder="e.g. AM"
                className="h-9 w-full rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-xs font-semibold text-text-primary focus:border-brand-primary focus:outline-none"
              />
              <p className="text-[11px] text-text-muted">
                Abbreviation displayed inside compact calendar cells.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="shift-label-input" className="text-xs font-semibold text-text-primary">
              Shift Timing Window &amp; Full Description <span className="text-rose-500">*</span>
            </label>
            <input
              id="shift-label-input"
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Morning Shift (08:00 - 16:00)"
              className="h-9 w-full rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
            />
            <p className="text-[11px] text-text-muted">
              Displayed in shift pickers, amendment requests, and PDF exports.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="shift-color-token" className="text-xs font-semibold text-text-primary">
                Color Badge Theme
              </label>
              <select
                id="shift-color-token"
                value={colorToken}
                onChange={(e) => setColorToken(e.target.value)}
                className="h-9 w-full rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
              >
                {SHIFT_COLOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-text-primary">Cell Preview</span>
              <div className="flex h-9 items-center gap-3 rounded-xl border border-border-subtle bg-surface-secondary/40 px-3">
                <div
                  className={`flex h-6 min-w-8 items-center justify-center rounded px-2 text-xs font-bold border ${selectedColorOption.preview}`}
                >
                  {shortLabel || code || 'AM'}
                </div>
                <span className="text-[11px] text-text-muted truncate">
                  {label || 'Sample Shift Label'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: OPERATIONAL HOURS & TIMINGS */}
        <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-secondary/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
              <Clock className="h-4 w-4 text-brand-primary" />
              2. Working Hours &amp; Duty Timings
            </div>
            {durationHours > 0 && (
              <span className="rounded-md bg-brand-primary/10 px-2 py-0.5 text-xs font-bold text-brand-primary font-mono">
                {durationHours} Hours Duration
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="shift-start-time" className="text-xs font-semibold text-text-primary">
                Start Time
              </label>
              <input
                id="shift-start-time"
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="h-9 w-full rounded-xl border border-border-default bg-surface-primary px-3 text-xs font-mono text-text-primary focus:border-brand-primary focus:outline-none"
              />
              <p className="text-[10px] text-text-muted">e.g. 08:00 (Leave empty for full-day rest/leave)</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="shift-end-time" className="text-xs font-semibold text-text-primary">
                End Time
              </label>
              <input
                id="shift-end-time"
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="h-9 w-full rounded-xl border border-border-default bg-surface-primary px-3 text-xs font-mono text-text-primary focus:border-brand-primary focus:outline-none"
              />
              <p className="text-[10px] text-text-muted">e.g. 16:00 (or 08:00 next day for night duty)</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="shift-duration" className="text-xs font-semibold text-text-primary">
                Total Duty Hours
              </label>
              <input
                id="shift-duration"
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="h-9 w-full rounded-xl border border-border-default bg-surface-primary px-3 text-xs font-mono font-bold text-text-primary focus:border-brand-primary focus:outline-none"
              />
              <p className="text-[10px] text-text-muted">Auto-computed duration</p>
            </div>
          </div>
        </div>

        {/* SECTION 3: ROSTER RULES & SEMANTICS */}
        <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-secondary/30 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
            <ShieldCheck className="h-4 w-4 text-brand-primary" />
            3. Roster Rules &amp; Policy Semantics
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="shift-semantic-class"
              className="text-xs font-semibold text-text-primary"
            >
              Consecutive Work Classification
            </label>
            <select
              id="shift-semantic-class"
              value={semanticClass}
              onChange={(e) =>
                setSemanticClass(e.target.value as 'worked' | 'transparent' | 'reset' | 'unknown')
              }
              className="h-9 w-full rounded-xl border border-border-default bg-surface-primary px-3 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
            >
              <option value="worked">
                Worked Duty (Counts toward consecutive worked days limit)
              </option>
              <option value="transparent">
                Transparent Bridge (Non-worked rest buffer e.g. Post-Night PN)
              </option>
              <option value="reset">Rest / Leave Reset (Full rest e.g. OFF, GOFF, AL, MC)</option>
            </select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 pt-1 text-xs">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={providesCoverage}
                onChange={(e) => setProvidesCoverage(e.target.checked)}
                className="mt-0.5 rounded border-border-default text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-text-primary">
                Provides ED Coverage (Counts toward minimum doctor quotas)
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={nightPolicyBQualifying}
                onChange={(e) => setNightPolicyBQualifying(e.target.checked)}
                className="mt-0.5 rounded border-border-default text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-text-primary">
                Qualifies as Night Duty (Enforces Policy-B rest &amp; bundle rules)
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer sm:col-span-2">
              <input
                type="checkbox"
                checked={displacesOffEarnsGoff}
                onChange={(e) => setDisplacesOffEarnsGoff(e.target.checked)}
                className="mt-0.5 rounded border-border-default text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-text-primary">
                Displaces Scheduled OFF (Automatically accrues replacement Ganti OFF)
              </span>
            </label>
          </div>
        </div>

        {/* SECTION 4: SORT ORDER & VISIBILITY */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="shift-sort-order" className="text-xs font-semibold text-text-primary">
              Display Sort Order
            </label>
            <input
              id="shift-sort-order"
              type="number"
              min={1}
              max={999}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="h-9 w-full rounded-xl border border-border-default bg-surface-secondary/50 px-3 text-xs font-mono text-text-primary focus:border-brand-primary focus:outline-none"
            />
            <p className="text-[11px] text-text-muted">
              Controls display sequence in drop-down menus (10, 20, 30...).
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-text-primary">Availability Status</span>
            <label className="flex h-9 items-center gap-2 rounded-xl border border-border-subtle bg-surface-secondary/40 px-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-border-default text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-xs font-medium text-text-primary">
                {isActive ? 'Active in Roster Picker' : 'Inactive (Archived)'}
              </span>
            </label>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-xs font-semibold text-text-inverse hover:bg-brand-primary-hover shadow-xs transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>{isCreateMode ? 'Create Shift Definition' : 'Save Changes'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export function EditShiftModal({ isOpen, onClose, shiftDef, semantics }: EditShiftModalProps) {
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
      aria-labelledby="shift-modal-title"
      onClick={onClose}
    >
      <ShiftFormInner
        key={shiftDef ? shiftDef.code : 'new'}
        onClose={onClose}
        shiftDef={shiftDef}
        semantics={semantics}
      />
    </div>
  );
}
