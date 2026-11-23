import { useState } from 'react';
import { getShiftToneClasses, Modal, stripShiftModifiers } from '@/shared/ui';
import type { ShiftDefinitionRow } from '../data/rosterQueries';
import type { StaffRosterIdentity } from '../domain/types';

interface ShiftPickerModalProps {
  staff: StaffRosterIdentity;
  date: string;
  currentCode?: string;
  initialNote?: string;
  shiftDefinitions: readonly ShiftDefinitionRow[];
  isOpen: boolean;
  onClose: () => void;
  onSelectShift: (code: string, note?: string) => void;
  onClearShift: () => void;
}

const WORKING_SHIFTS = new Set(['AM', 'PM', 'ON1', 'ON2', 'PN', 'MEDSB']);

export function ShiftPickerModal({
  staff,
  date,
  currentCode,
  initialNote = '',
  shiftDefinitions,
  isOpen,
  onClose,
  onSelectShift,
  onClearShift,
}: ShiftPickerModalProps) {
  const initialParsed = stripShiftModifiers(currentCode);
  const propKey = `${isOpen}:${staff.id}:${date}:${currentCode ?? ''}:${initialNote}`;
  const [prevPropKey, setPrevPropKey] = useState(propKey);
  const [pickedCode, setPickedCode] = useState(initialParsed.cleanShift);
  const [isStandby, setIsStandby] = useState(initialParsed.isStandby);
  const [isExtended, setIsExtended] = useState(initialParsed.isExtended);
  const [adminNote, setAdminNote] = useState(initialNote);

  if (prevPropKey !== propKey) {
    setPrevPropKey(propKey);
    if (isOpen) {
      setPickedCode(initialParsed.cleanShift);
      setIsStandby(initialParsed.isStandby);
      setIsExtended(initialParsed.isExtended);
      setAdminNote(initialNote);
    }
  }

  const isWorking = WORKING_SHIFTS.has(pickedCode);
  const standbyDisabled = !pickedCode || isWorking;
  const extendedDisabled = !isWorking;

  const handleSave = () => {
    if (!pickedCode) return;
    let finalCode = pickedCode;
    if (isStandby && !standbyDisabled) finalCode = `${finalCode} (S)`;
    if (isExtended && !extendedDisabled) finalCode = `${finalCode} (X)`;
    onSelectShift(finalCode, adminNote.trim() || undefined);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Shift"
      description={`${staff.rosterName} (${staff.staffCode}) · ${date}`}
      maxWidth="sm"
      presentation="drawer"
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onClearShift();
              onClose();
            }}
            className="rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-extrabold text-[#B91C1C] hover:bg-rose-100 transition cursor-pointer"
          >
            Clear Shift
          </button>
          <button
            type="button"
            disabled={!pickedCode}
            onClick={handleSave}
            className="flex-1 rounded-[14px] bg-[linear-gradient(135deg,#14867D,#0F766E)] px-4 py-2.5 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(15,118,110,0.28)] hover:opacity-95 disabled:opacity-45 cursor-pointer"
          >
            Save Shift
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Canonical Prototype Shift Tile Grid */}
        <div className="grid grid-cols-3 gap-2">
          {shiftDefinitions.map((s) => {
            const codeUpper = s.code.toUpperCase();
            const isSelected = pickedCode === codeUpper;
            const showSubLabel = s.short_label && s.short_label.trim().toUpperCase() !== codeUpper;

            return (
              <button
                key={s.code}
                type="button"
                onClick={() => {
                  setPickedCode(codeUpper);
                  const nextWorking = WORKING_SHIFTS.has(codeUpper);
                  if (nextWorking) setIsStandby(false);
                  else setIsExtended(false);
                }}
                className={`flex min-h-[52px] flex-col items-center justify-center rounded-[16px] px-2 py-2.5 text-center transition-all cursor-pointer active:scale-[0.97] ${getShiftToneClasses(
                  s.code,
                )} ${
                  isSelected
                    ? 'ring-2 ring-[#18181B] ring-offset-2 font-extrabold'
                    : 'font-extrabold'
                }`}
              >
                <span className="text-[13px] font-extrabold leading-tight">{s.code}</span>
                {showSubLabel ? (
                  <span className="mt-0.5 max-w-[82px] truncate text-[9.5px] font-bold opacity-80">
                    {s.short_label}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Standby (S) & Extended (X) Modifiers */}
        <div className="rounded-[16px] border border-[#E7E5E4] bg-[#FAF8F5] p-3 space-y-2">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#78716C]">
            Shift Modifiers
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label
              className={`flex items-center gap-2 rounded-xl border border-[#E7E5E4] bg-white px-2.5 py-2 text-xs font-bold ${
                standbyDisabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={isStandby && !standbyDisabled}
                disabled={standbyDisabled}
                onChange={(e) => setIsStandby(e.target.checked)}
                className="h-4 w-4 accent-[#D97706]"
              />
              <span className="text-[#854D0E]">Standby (S)</span>
            </label>

            <label
              className={`flex items-center gap-2 rounded-xl border border-[#E7E5E4] bg-white px-2.5 py-2 text-xs font-bold ${
                extendedDisabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={isExtended && !extendedDisabled}
                disabled={extendedDisabled}
                onChange={(e) => setIsExtended(e.target.checked)}
                className="h-4 w-4 accent-[#0F766E]"
              />
              <span className="text-[#0F766E]">Extended (EX)</span>
            </label>
          </div>
        </div>

        {/* Admin Note Input */}
        <div>
          <label
            htmlFor="shift-picker-admin-note"
            className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#78716C]"
          >
            Admin Note / Comment
          </label>
          <input
            id="shift-picker-admin-note"
            type="text"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Optional roster note for this cell..."
            className="w-full rounded-[14px] border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-2.5 text-xs font-semibold text-[#18181B] placeholder:text-[#A8A29E] focus:border-[#0F766E] focus:bg-white focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  );
}
