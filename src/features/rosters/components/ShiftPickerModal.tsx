import { X } from 'lucide-react';
import type { ShiftDefinitionRow } from '../data/rosterQueries';
import type { StaffRosterIdentity } from '../domain/types';

interface ShiftPickerModalProps {
  staff: StaffRosterIdentity;
  date: string;
  currentCode?: string;
  shiftDefinitions: readonly ShiftDefinitionRow[];
  isOpen: boolean;
  onClose: () => void;
  onSelectShift: (code: string) => void;
  onClearShift: () => void;
}

export function ShiftPickerModal({
  staff,
  date,
  currentCode,
  shiftDefinitions,
  isOpen,
  onClose,
  onSelectShift,
  onClearShift,
}: ShiftPickerModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-border-default bg-surface-primary p-5 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div>
            <h2 id="shift-picker-title" className="text-base font-semibold text-text-primary">
              Assign Shift
            </h2>
            <p className="text-xs text-text-secondary">
              {staff.rosterName} ({staff.staffCode}) · {date}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-surface-secondary hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Shift selector pills */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {shiftDefinitions.map((s) => {
            const isSelected = currentCode?.toUpperCase() === s.code.toUpperCase();
            return (
              <button
                key={s.code}
                type="button"
                onClick={() => {
                  onSelectShift(s.code);
                  onClose();
                }}
                className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all ${
                  isSelected
                    ? 'bg-brand-primary text-text-inverse font-bold ring-2 ring-brand-primary ring-offset-2'
                    : 'border border-border-default bg-surface-secondary/50 hover:bg-surface-secondary text-text-primary'
                }`}
              >
                <span className="text-sm font-semibold">{s.code}</span>
                <span className="text-[10px] text-text-muted line-clamp-1">{s.short_label}</span>
              </button>
            );
          })}
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-3">
          <button
            type="button"
            onClick={() => {
              onClearShift();
              onClose();
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
          >
            Clear Shift (Unassigned)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-default px-4 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
