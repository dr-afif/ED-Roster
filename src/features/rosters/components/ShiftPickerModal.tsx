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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs transition-opacity"
    >
      <div className="w-full max-w-md rounded-t-[28px] sm:rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 pb-8 sm:pb-6">
        {/* Mobile sheet drag handle */}
        <div className="mx-auto -mt-1 h-1 w-10 rounded-full bg-stone-300 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 id="shift-picker-title" className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Assign Shift
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {staff.rosterName} ({staff.staffCode}) · {date}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Shift selector pills */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {shiftDefinitions.map((s) => {
            const isSelected = currentCode?.toUpperCase() === s.code.toUpperCase();
            const showSubLabel =
              s.short_label &&
              s.short_label.trim().toUpperCase() !== s.code.trim().toUpperCase();

            // Distinctive clinical badge color accents
            let badgeBg = 'bg-slate-50 border-slate-200 text-slate-800 hover:border-teal-400 hover:bg-teal-50/50';
            let codeColor = 'text-slate-900 dark:text-slate-100';

            const upper = s.code.toUpperCase();
            if (upper.includes('AM')) {
              badgeBg = 'bg-amber-50/70 border-amber-200/80 text-amber-950 hover:border-amber-400 hover:bg-amber-100/60 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-200';
              codeColor = 'text-amber-800 dark:text-amber-300';
            } else if (upper.includes('PM')) {
              badgeBg = 'bg-sky-50/70 border-sky-200/80 text-sky-950 hover:border-sky-400 hover:bg-sky-100/60 dark:bg-sky-950/30 dark:border-sky-800/60 dark:text-sky-200';
              codeColor = 'text-sky-800 dark:text-sky-300';
            } else if (upper.includes('ND') || upper.includes('NIGHT')) {
              badgeBg = 'bg-indigo-50/70 border-indigo-200/80 text-indigo-950 hover:border-indigo-400 hover:bg-indigo-100/60 dark:bg-indigo-950/30 dark:border-indigo-800/60 dark:text-indigo-200';
              codeColor = 'text-indigo-800 dark:text-indigo-300';
            } else if (upper.includes('OFF') || upper.includes('GOFF')) {
              badgeBg = 'bg-slate-100 border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-200';
              codeColor = 'text-slate-700 dark:text-slate-300';
            } else if (upper.includes('AL') || upper.includes('EL') || upper.includes('HKA') || upper.includes('GHKA')) {
              badgeBg = 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950 hover:border-emerald-400 hover:bg-emerald-100/60 dark:bg-emerald-950/30 dark:border-emerald-800/60 dark:text-emerald-200';
              codeColor = 'text-emerald-800 dark:text-emerald-300';
            } else if (upper.includes('ON')) {
              badgeBg = 'bg-purple-50/70 border-purple-200/80 text-purple-950 hover:border-purple-400 hover:bg-purple-100/60 dark:bg-purple-950/30 dark:border-purple-800/60 dark:text-purple-200';
              codeColor = 'text-purple-800 dark:text-purple-300';
            }

            return (
              <button
                key={s.code}
                type="button"
                onClick={() => {
                  onSelectShift(s.code);
                  onClose();
                }}
                className={`flex flex-col items-center justify-center rounded-xl p-2.5 min-h-[52px] text-center transition-all duration-150 cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-[0.98] ${
                  isSelected
                    ? 'bg-teal-700 text-white font-bold ring-2 ring-teal-600 ring-offset-2 shadow-md dark:bg-teal-600'
                    : `border ${badgeBg}`
                }`}
              >
                <span className={`text-sm font-bold tracking-tight ${isSelected ? 'text-white' : codeColor}`}>
                  {s.code}
                </span>
                {showSubLabel && (
                  <span className={`text-[10px] font-medium leading-tight truncate max-w-[80px] mt-0.5 ${isSelected ? 'text-teal-100' : 'text-slate-500 dark:text-slate-400'}`}>
                    {s.short_label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => {
              onClearShift();
              onClose();
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:text-rose-400 transition-colors cursor-pointer"
          >
            Clear Shift (Unassigned)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
