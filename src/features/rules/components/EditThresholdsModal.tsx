import { useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2 } from 'lucide-react';
import type { StaffingThresholdRow } from '@/features/rosters/data/rosterQueries';
import { useUpdateStaffingThresholdsMutation } from '@/features/rosters/data/rosterQueries';
import { Modal, useAppUiState, useToast } from '@/shared/ui';

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

function ThresholdsFormBody({
  onClose,
  ruleVersionId,
  thresholds,
  effectiveFrom,
  effectiveTo,
}: Omit<EditThresholdsModalProps, 'isOpen'>) {
  const showToast = useToast();
  const { setTallyThresholds } = useAppUiState();
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
      const weekdayAm = items.find((i) => i.day_type === 'weekday' && i.shift_bucket === 'am');
      const weekdayPm = items.find((i) => i.day_type === 'weekday' && i.shift_bucket === 'pm');
      const weekdayNight = items.find(
        (i) => i.day_type === 'weekday' && i.shift_bucket === 'night',
      );
      setTallyThresholds((prev) => ({
        ...prev,
        amMin: weekdayAm?.min_staff ?? prev.amMin,
        pmMin: weekdayPm?.min_staff ?? prev.pmMin,
        nightMin: weekdayNight?.min_staff ?? prev.nightMin,
        nightMax: weekdayNight?.target_staff ?? prev.nightMax,
      }));
      showToast('Staffing minimums updated ✓');
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update staffing thresholds.');
    }
  };

  const dayTypeGroups = ['weekday', 'weekend', 'holiday'] as const;

  return (
    <form id="edit-thresholds-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl bg-[#FAF8F5] px-3.5 py-2 text-xs text-[#57534E] border border-[#EFECE6]">
        <Calendar className="h-4 w-4 text-[#0F766E] shrink-0" />
        <span>
          Active Duration:{' '}
          <strong className="text-[#18181B] font-mono">{effectiveFrom ?? '2026-01-01'}</strong> to{' '}
          <strong className="text-[#18181B] font-mono">{effectiveTo ?? 'Ongoing / Current'}</strong>
        </span>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {dayTypeGroups.map((dayType) => {
        const groupIndices = items
          .map((item, idx) => (item.day_type === dayType ? idx : -1))
          .filter((idx) => idx !== -1);

        const title =
          dayType === 'weekday'
            ? 'Weekday Staffing (Mon – Fri)'
            : dayType === 'weekend'
              ? 'Weekend Staffing (Sat – Sun)'
              : 'Public Holiday Staffing';

        return (
          <div
            key={dayType}
            className="rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-3.5 space-y-2.5"
          >
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#18181B]">
              {title}
            </h3>

            <div className="grid gap-2.5 sm:grid-cols-3">
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
                    className="rounded-xl border border-[#E7E5E4] bg-white p-2.5 space-y-2"
                  >
                    <div className="font-extrabold text-xs text-[#18181B]">{bucketLabel}</div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#78716C] uppercase">
                          Min
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={item.min_staff}
                          onChange={(e) => handleMinChange(idx, Number(e.target.value))}
                          className="h-8 w-full rounded-lg border border-[#E7E5E4] bg-[#FAF8F5] px-2 text-xs font-extrabold text-center text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#78716C] uppercase">
                          Target
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={25}
                          value={item.target_staff}
                          onChange={(e) => handleTargetChange(idx, Number(e.target.value))}
                          className="h-8 w-full rounded-lg border border-[#E7E5E4] bg-[#FAF8F5] px-2 text-xs font-bold text-center text-[#57534E] focus:border-[#0F766E] focus:outline-none"
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
    </form>
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
  const updateMutation = useUpdateStaffingThresholdsMutation(ruleVersionId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Staffing Minimums & Targets"
      description="Set required minimum doctor presence per shift bucket to ensure patient safety and zone coverage."
      presentation="drawer"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={updateMutation.isPending}
            className="rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-extrabold text-[#57534E] hover:bg-[#FAF8F5] transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-thresholds-form"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-5 py-2 text-xs font-extrabold text-white hover:bg-[#115E59] shadow-xs transition disabled:opacity-50 cursor-pointer"
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
      }
    >
      <ThresholdsFormBody
        key={ruleVersionId}
        onClose={onClose}
        ruleVersionId={ruleVersionId}
        thresholds={thresholds}
        effectiveFrom={effectiveFrom}
        effectiveTo={effectiveTo}
      />
    </Modal>
  );
}
