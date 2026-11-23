import { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import type { ShiftDefinitionRow, ShiftSemanticRow } from '@/features/rosters/data/rosterQueries';
import {
  useCreateShiftDefinitionMutation,
  useUpdateShiftDefinitionMutation,
} from '@/features/rosters/data/rosterQueries';
import { Modal, useToast } from '@/shared/ui';
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
    endMin += 24 * 60;
  }
  const diff = (endMin - startMin) / 60;
  return Math.round(diff * 100) / 100;
}

function ShiftFormBody({ onClose, shiftDef, semantics }: ShiftFormInnerProps) {
  const showToast = useToast();
  const isCreateMode = !shiftDef;

  const [code, setCode] = useState(shiftDef?.code ?? '');
  const [label, setLabel] = useState(shiftDef?.label ?? '');
  const [shortLabel, setShortLabel] = useState(shiftDef?.short_label ?? '');
  const [colorToken, setColorToken] = useState<string>(shiftDef?.color_token ?? 'am');
  const [sortOrder, setSortOrder] = useState<number>(shiftDef?.sort_order ?? 100);
  const [isActive, setIsActive] = useState<boolean>(shiftDef?.is_active ?? true);

  const initialStart = shiftDef?.start_time ? shiftDef.start_time.slice(0, 5) : '';
  const initialEnd = shiftDef?.end_time ? shiftDef.end_time.slice(0, 5) : '';
  const [startTime, setStartTime] = useState<string>(initialStart);
  const [endTime, setEndTime] = useState<string>(initialEnd);
  const [durationHours, setDurationHours] = useState<number>(
    shiftDef?.duration_hours
      ? Number(shiftDef.duration_hours)
      : calculateShiftDuration(initialStart, initialEnd),
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
        showToast(`Created shift ${trimmedCode} ✓`);
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
        showToast(`Updated shift ${trimmedCode} ✓`);
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
    <form id="edit-shift-form" onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* SECTION 1: IDENTITY & BADGE */}
      <div className="space-y-3">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
          1. Shift Identity &amp; Badge
        </h3>

        <div className="grid gap-3 grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="shift-code-input" className="text-xs font-extrabold text-[#18181B]">
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
                className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 text-xs font-mono font-bold uppercase text-[#18181B] focus:border-[#0F766E] focus:outline-none"
              />
            ) : (
              <div className="flex h-9 items-center rounded-xl border border-[#EFECE6] bg-[#FAF8F5] px-3 text-xs font-mono font-extrabold text-[#18181B]">
                {code}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="shift-short-label" className="text-xs font-extrabold text-[#18181B]">
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
              className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 text-xs font-bold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="shift-label-input" className="text-xs font-extrabold text-[#18181B]">
            Shift Timing Window &amp; Full Description <span className="text-rose-500">*</span>
          </label>
          <input
            id="shift-label-input"
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Morning Shift (08:00 - 16:00)"
            className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 text-xs font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
          />
        </div>

        <div className="grid gap-3 grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="shift-color-token" className="text-xs font-extrabold text-[#18181B]">
              Color Badge Theme
            </label>
            <select
              id="shift-color-token"
              value={colorToken}
              onChange={(e) => setColorToken(e.target.value)}
              className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-2.5 text-xs font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            >
              {SHIFT_COLOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-extrabold text-[#18181B]">Cell Preview</span>
            <div className="flex h-9 items-center gap-2 rounded-xl border border-[#EFECE6] bg-[#FAF8F5] px-2.5">
              <div
                className={`flex h-6 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-extrabold border ${selectedColorOption.preview}`}
              >
                {shortLabel || code || 'AM'}
              </div>
              <span className="text-[11px] font-medium text-[#78716C] truncate">
                {label || 'Sample Label'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: OPERATIONAL HOURS & TIMINGS */}
      <div className="space-y-3 rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#18181B]">
            <Clock className="h-4 w-4 text-[#0F766E]" />
            <span>2. Working Hours &amp; Duty Timings</span>
          </div>
          {durationHours > 0 && (
            <span className="rounded-full bg-[#F0FDFA] border border-[#99F6E4] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#0F766E] font-mono">
              {durationHours}h
            </span>
          )}
        </div>

        <div className="grid gap-3 grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="shift-start-time" className="text-[11px] font-extrabold text-[#57534E]">
              Start Time
            </label>
            <input
              id="shift-start-time"
              type="time"
              value={startTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-white px-2 text-xs font-mono text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="shift-end-time" className="text-[11px] font-extrabold text-[#57534E]">
              End Time
            </label>
            <input
              id="shift-end-time"
              type="time"
              value={endTime}
              onChange={(e) => handleEndTimeChange(e.target.value)}
              className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-white px-2 text-xs font-mono text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="shift-duration" className="text-[11px] font-extrabold text-[#57534E]">
              Hours
            </label>
            <input
              id="shift-duration"
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-white px-2 text-xs font-mono font-extrabold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: ROSTER RULES & SEMANTICS */}
      <div className="space-y-3 rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-3.5">
        <div className="flex items-center gap-2 text-xs font-extrabold text-[#18181B]">
          <ShieldCheck className="h-4 w-4 text-[#0F766E]" />
          <span>3. Roster Rules &amp; Policy Semantics</span>
        </div>

        <div className="space-y-1">
          <label htmlFor="shift-semantic-class" className="text-xs font-extrabold text-[#18181B]">
            Consecutive Work Classification
          </label>
          <select
            id="shift-semantic-class"
            value={semanticClass}
            onChange={(e) =>
              setSemanticClass(e.target.value as 'worked' | 'transparent' | 'reset' | 'unknown')
            }
            className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-white px-3 text-xs font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
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

        <div className="space-y-2 pt-1 text-xs font-semibold text-[#18181B]">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={providesCoverage}
              onChange={(e) => setProvidesCoverage(e.target.checked)}
              className="mt-0.5 accent-[#0F766E]"
            />
            <span>Provides ED Coverage (Counts toward minimum doctor quotas)</span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={nightPolicyBQualifying}
              onChange={(e) => setNightPolicyBQualifying(e.target.checked)}
              className="mt-0.5 accent-[#0F766E]"
            />
            <span>Qualifies as Night Duty (Enforces Policy-B rest &amp; bundle rules)</span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={displacesOffEarnsGoff}
              onChange={(e) => setDisplacesOffEarnsGoff(e.target.checked)}
              className="mt-0.5 accent-[#0F766E]"
            />
            <span>Displaces Scheduled OFF (Automatically accrues replacement Ganti OFF)</span>
          </label>
        </div>
      </div>

      {/* SECTION 4: SORT ORDER & VISIBILITY */}
      <div className="grid gap-3 grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="shift-sort-order" className="text-xs font-extrabold text-[#18181B]">
            Display Sort Order
          </label>
          <input
            id="shift-sort-order"
            type="number"
            min={1}
            max={999}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="h-9 w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 text-xs font-mono text-[#18181B] focus:border-[#0F766E] focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-extrabold text-[#18181B]">Availability Status</span>
          <label className="flex h-9 items-center gap-2 rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-[#0F766E]"
            />
            <span className="text-xs font-bold text-[#18181B]">
              {isActive ? 'Active in Picker' : 'Archived'}
            </span>
          </label>
        </div>
      </div>

      {/* Hidden submit hookup helper; sticky footer button uses form="edit-shift-form" */}
      <input type="hidden" value={String(isSubmitting)} />
    </form>
  );
}

export function EditShiftModal({ isOpen, onClose, shiftDef, semantics }: EditShiftModalProps) {
  const isCreateMode = !shiftDef;
  const updateMutation = useUpdateShiftDefinitionMutation();
  const createMutation = useCreateShiftDefinitionMutation();
  const isSubmitting = updateMutation.isPending || createMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreateMode ? 'Create New Shift & Timings' : `Edit Shift: ${shiftDef.code}`}
      description="Configure working hours window, display label, badge theme, and deterministic rules semantics."
      presentation="drawer"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-extrabold text-[#57534E] hover:bg-[#FAF8F5] transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-shift-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-5 py-2 text-xs font-extrabold text-white hover:bg-[#115E59] shadow-xs transition disabled:opacity-50 cursor-pointer"
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
      }
    >
      <ShiftFormBody
        key={shiftDef ? shiftDef.code : 'new'}
        onClose={onClose}
        shiftDef={shiftDef}
        semantics={semantics}
      />
    </Modal>
  );
}
