import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { EpAssignmentRow } from '../data/rosterQueries';
import type { Assignment, PublicHolidayEntry, StaffRosterIdentity } from '../domain/types';

export type EpSlotType = 'EP_OFFICE_HOUR' | 'EP_ONCALL' | 'EP_PASSIVE';

interface RosterCalendarViewProps {
  periodDates: readonly string[];
  staffList: readonly StaffRosterIdentity[];
  assignments: readonly Assignment[];
  epAssignments: readonly EpAssignmentRow[];
  holidays: readonly PublicHolidayEntry[];
  isEditable: boolean;
  periodLabel?: string;
  isPublished?: boolean;
  currentUserName?: string;
  currentUserId?: number | null;
  onOpenPdfExport?: () => void;
  onUpdateEpAssignment?: (dutyDate: string, slotType: EpSlotType, names: string) => void;
  onBatchUpdateEpAssignments?: (
    payloads: Array<{
      dutyDate: string;
      slotType: EpSlotType;
      physicianNames: string;
    }>,
  ) => void;
}

const CLEAR_STAMP = '__CLEAR__';

function normalizeShortName(raw?: string): string {
  return (raw || '').replace(/^Dr\.?\s+/i, '').trim();
}

export function parseEpNamesList(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]+/)
    .map((n) => n.trim())
    .filter(Boolean);
}

export function computeAutoPassiveEps(
  allEps: readonly string[],
  amRaw?: string | null,
  oncallRaw?: string | null,
): string[] {
  const excluded = new Set(
    [...parseEpNamesList(amRaw), ...parseEpNamesList(oncallRaw)].map((n) =>
      normalizeShortName(n).toLowerCase(),
    ),
  );
  return allEps.filter((ep) => !excluded.has(normalizeShortName(ep).toLowerCase()));
}

function toggleEpNameInList(currentRaw: string, targetName: string): string {
  const currentList = parseEpNamesList(currentRaw);
  const targetNorm = normalizeShortName(targetName).toLowerCase();
  const exists = currentList.some((n) => normalizeShortName(n).toLowerCase() === targetNorm);
  const nextList = exists
    ? currentList.filter((n) => normalizeShortName(n).toLowerCase() !== targetNorm)
    : [...currentList, targetName];
  return nextList.join(', ');
}

export function RosterCalendarView({
  periodDates,
  staffList,
  assignments,
  epAssignments,
  holidays,
  isEditable,
  periodLabel = 'January 2027',
  isPublished = false,
  currentUserName,
  currentUserId,
  onOpenPdfExport,
  onUpdateEpAssignment,
  onBatchUpdateEpAssignments,
}: RosterCalendarViewProps) {
  const [isEpEditMode, setIsEpEditMode] = useState(false);
  const [activeEpStamp, setActiveEpStamp] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{
    dutyDate: string;
    slotType: EpSlotType;
  } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const editingCellRef = useRef<HTMLTableCellElement | null>(null);

  useEffect(() => {
    if (!editingCell) return;

    const handleOutsidePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (editingCellRef.current && target && !editingCellRef.current.contains(target)) {
        onUpdateEpAssignment?.(editingCell.dutyDate, editingCell.slotType, editingValue);
        setEditingCell(null);
      }
    };

    document.addEventListener('mousedown', handleOutsidePointerDown);
    document.addEventListener('touchstart', handleOutsidePointerDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointerDown);
      document.removeEventListener('touchstart', handleOutsidePointerDown);
    };
  }, [editingCell, editingValue, onUpdateEpAssignment]);

  const staffMap = useMemo(() => {
    const map = new Map<number, StaffRosterIdentity>();
    for (const s of staffList) {
      map.set(s.id, s);
    }
    return map;
  }, [staffList]);

  const emergencyPhysicians = useMemo(() => {
    const eps = staffList.filter(
      (s) =>
        /^EP-/i.test(s.staffCode) ||
        s.staffGroup?.toLowerCase().includes('physician') ||
        s.staffGroup?.toLowerCase().includes('specialist') ||
        (s as unknown as { staff_group?: string }).staff_group?.toLowerCase().includes('physician'),
    );
    if (eps.length > 0) {
      return eps.map((s) => s.rosterName || s.displayName);
    }
    const namesSet = new Set<string>();
    for (const ep of epAssignments) {
      for (const n of ep.physician_names.split(/[,\n]+/)) {
        const trimmed = n.trim();
        if (trimmed) namesSet.add(trimmed);
      }
    }
    if (namesSet.size > 0) {
      return Array.from(namesSet);
    }
    return ['Dr. Razak', 'Dr. Hanim', 'Dr. Kumar'];
  }, [staffList, epAssignments]);

  const epMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ep of epAssignments) {
      map.set(`${ep.duty_date}:${ep.slot_type}`, ep.physician_names);
    }
    return map;
  }, [epAssignments]);

  const calendarDailyMap = useMemo(() => {
    const map = new Map<
      string,
      {
        am: Array<{ id: number; name: string; code: string }>;
        pm: Array<{ id: number; name: string; code: string }>;
        night: Array<{ id: number; name: string; code: string }>;
      }
    >();

    for (const date of periodDates) {
      map.set(date, { am: [], pm: [], night: [] });
    }

    for (const a of assignments) {
      const dayData = map.get(a.dutyDate);
      if (!dayData) continue;
      const staff = staffMap.get(a.staffId);
      const name = staff ? staff.rosterName || staff.displayName : `Dr ${a.staffId}`;
      const code = staff ? staff.staffCode : '';

      const shift = (a.shiftCode || '')
        .toUpperCase()
        .replace(/\(S\)|-S|\(X\)|-X/g, '')
        .trim();
      if (shift === 'AM') {
        dayData.am.push({ id: a.staffId, name, code });
      } else if (shift === 'PM') {
        dayData.pm.push({ id: a.staffId, name, code });
      } else if (
        shift === 'ND' ||
        shift === 'NIGHT' ||
        shift === 'ON' ||
        shift === 'ON1' ||
        shift === 'ON2' ||
        shift === 'PN'
      ) {
        dayData.night.push({ id: a.staffId, name, code });
      }
    }

    return map;
  }, [periodDates, assignments, staffMap]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const myShortName = normalizeShortName(currentUserName).toLowerCase();

  const getEffectiveCellValue = (dutyDate: string, slotType: EpSlotType): string => {
    if (slotType === 'EP_PASSIVE') {
      if (epMap.has(`${dutyDate}:EP_PASSIVE`)) {
        return epMap.get(`${dutyDate}:EP_PASSIVE`) ?? '';
      }
      const am = epMap.get(`${dutyDate}:EP_OFFICE_HOUR`) ?? '';
      const oncall = epMap.get(`${dutyDate}:EP_ONCALL`) ?? '';
      return computeAutoPassiveEps(emergencyPhysicians, am, oncall).join(', ');
    }
    return epMap.get(`${dutyDate}:${slotType}`) ?? '';
  };

  const handleCellClick = (dutyDate: string, slotType: EpSlotType) => {
    if (!isEditable || !isEpEditMode) return;

    if (activeEpStamp === CLEAR_STAMP) {
      onUpdateEpAssignment?.(dutyDate, slotType, '');
      return;
    }

    const current = getEffectiveCellValue(dutyDate, slotType);
    if (activeEpStamp) {
      const next = toggleEpNameInList(current, activeEpStamp);
      onUpdateEpAssignment?.(dutyDate, slotType, next);
      return;
    }

    setEditingCell({ dutyDate, slotType });
    setEditingValue(current);
  };

  const handleRemoveEpFromCell = (dutyDate: string, slotType: EpSlotType, nameToRemove: string) => {
    if (!isEditable || !isEpEditMode) return;
    const current = getEffectiveCellValue(dutyDate, slotType);
    const targetNorm = normalizeShortName(nameToRemove).toLowerCase();
    const next = parseEpNamesList(current)
      .filter((n) => normalizeShortName(n).toLowerCase() !== targetNorm)
      .join(', ');
    onUpdateEpAssignment?.(dutyDate, slotType, next);
  };

  const handleSaveInlineEdit = () => {
    if (!editingCell) return;
    onUpdateEpAssignment?.(editingCell.dutyDate, editingCell.slotType, editingValue);
    setEditingCell(null);
  };

  const handleBatchFill = (target: 'weekdays' | 'weekends', slotType: EpSlotType) => {
    if (!activeEpStamp || activeEpStamp === CLEAR_STAMP || !onBatchUpdateEpAssignments) return;
    const payloads: Array<{
      dutyDate: string;
      slotType: EpSlotType;
      physicianNames: string;
    }> = [];

    for (const date of periodDates) {
      const d = new Date(`${date}T00:00:00Z`);
      const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
      if (target === 'weekdays' && !isWeekend) {
        payloads.push({ dutyDate: date, slotType, physicianNames: activeEpStamp });
      } else if (target === 'weekends' && isWeekend) {
        payloads.push({ dutyDate: date, slotType, physicianNames: activeEpStamp });
      }
    }

    onBatchUpdateEpAssignments(payloads);
  };

  const shortMonthHeader = useMemo(() => {
    const first = periodDates[0];
    if (!first) return 'JAN';
    const d = new Date(`${first}T00:00:00Z`);
    return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  }, [periodDates]);

  const renderMoList = (docs: Array<{ id: number; name: string; code: string }>) => {
    if (docs.length === 0) {
      return <span className="text-[#D6D3D1]">—</span>;
    }
    return (
      <div className="flex flex-col items-center gap-[2px]">
        {docs.map((doc) => {
          const short = normalizeShortName(doc.name) || doc.name;
          const isMe =
            (currentUserId != null && doc.id === currentUserId) ||
            Boolean(myShortName && short.toLowerCase() === myShortName);
          return (
            <span
              key={doc.id}
              title={`${doc.name} (${doc.code})`}
              className={`inline-block uppercase leading-[1.35] ${
                isMe
                  ? 'rounded-[6px] border border-[#99F6E4] bg-[#CCFBF1] px-1.5 font-extrabold text-[#0F766E]'
                  : 'font-semibold text-[#18181B]'
              }`}
            >
              {short}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Centered Owner Action Pills */}
      {isEditable ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onOpenPdfExport ? (
            <button
              type="button"
              onClick={onOpenPdfExport}
              className="rounded-full border border-[#E7E5E4] bg-white px-3.5 py-1.5 text-[11.5px] font-bold text-[#57534E] hover:border-stone-400 hover:text-[#18181B] transition cursor-pointer"
            >
              📄 Export PDF
            </button>
          ) : null}

          <button
            type="button"
            data-testid="toggle-edit-ep-mode"
            onClick={() => {
              setIsEpEditMode((prev) => !prev);
              if (isEpEditMode) {
                setEditingCell(null);
                setActiveEpStamp(null);
              }
            }}
            className={`rounded-full border px-3.5 py-1.5 text-[11.5px] font-extrabold transition cursor-pointer ${
              isEpEditMode
                ? 'border-[#0F766E] bg-[#0F766E] text-white'
                : 'border-[#E7E5E4] bg-white text-[#57534E] hover:border-stone-400 hover:text-[#18181B]'
            }`}
          >
            {isEpEditMode ? '🎨 Done EP' : '🎨 Edit EP'}
          </button>
        </div>
      ) : null}

      {/* EP 1-Click Painter Toolbar */}
      {isEditable && isEpEditMode ? (
        <div className="mx-auto max-w-[760px] lg:max-w-[1290px] rounded-[16px] border border-[#99F6E4] bg-[#F0FDFA] p-3 lg:p-4 shadow-2xs">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] lg:text-[13px] font-extrabold text-[#0F766E]">
              EP 1-Click Painter
              {activeEpStamp
                ? ` · Active: ${activeEpStamp === CLEAR_STAMP ? 'Eraser' : activeEpStamp}`
                : ' · Pick stamp or tap EP cell'}
            </span>
            {activeEpStamp ? (
              <button
                type="button"
                onClick={() => setActiveEpStamp(null)}
                className="rounded-full border border-[#99F6E4] bg-white px-2.5 lg:px-3 py-0.5 lg:py-1 text-[10px] lg:text-xs font-bold text-[#0F766E] cursor-pointer hover:bg-teal-50"
              >
                Esc
              </button>
            ) : null}
          </div>

          <div className="no-scrollbar flex flex-nowrap items-center gap-1.5 lg:gap-2 overflow-x-auto pb-1">
            {emergencyPhysicians.map((name) => {
              const isSelected = activeEpStamp === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setActiveEpStamp(isSelected ? null : name)}
                  className={`shrink-0 rounded-full border px-3 lg:px-4 py-1 lg:py-1.5 text-[10.5px] lg:text-xs font-bold transition cursor-pointer ${
                    isSelected
                      ? 'border-[#0F766E] bg-[#0F766E] text-white'
                      : 'border-[#E7E5E4] bg-white text-[#18181B] hover:border-[#0F766E]'
                  }`}
                >
                  {name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setActiveEpStamp(activeEpStamp === CLEAR_STAMP ? null : CLEAR_STAMP)}
              className={`shrink-0 rounded-full border px-3 lg:px-4 py-1 lg:py-1.5 text-[10.5px] lg:text-xs font-bold transition cursor-pointer ${
                activeEpStamp === CLEAR_STAMP
                  ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                  : 'border-[#FECACA] bg-white text-[#B91C1C] hover:bg-rose-50'
              }`}
            >
              🧹 Clear
            </button>
          </div>

          {activeEpStamp && activeEpStamp !== CLEAR_STAMP ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleBatchFill('weekdays', 'EP_OFFICE_HOUR')}
                className="flex-1 rounded-full border border-[#99F6E4] bg-white px-3 lg:px-4 py-1.5 lg:py-2 text-[10.5px] lg:text-xs font-bold text-[#0F766E] hover:bg-teal-50 cursor-pointer"
              >
                ⚡ Fill Weekdays (OH)
              </button>
              <button
                type="button"
                onClick={() => handleBatchFill('weekends', 'EP_ONCALL')}
                className="flex-1 rounded-full border border-[#99F6E4] bg-white px-3 lg:px-4 py-1.5 lg:py-2 text-[10.5px] lg:text-xs font-bold text-[#0F766E] hover:bg-teal-50 cursor-pointer"
              >
                ⚡ Fill Weekends (OC)
              </button>
              <button
                type="button"
                onClick={() => handleBatchFill('weekdays', 'EP_PASSIVE')}
                className="flex-1 rounded-full border border-[#99F6E4] bg-white px-3 lg:px-4 py-1.5 lg:py-2 text-[10.5px] lg:text-xs font-bold text-[#0F766E] hover:bg-teal-50 cursor-pointer"
              >
                ⚡ Fill Weekdays (OH 8–5)
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Unified App-Themed Printable Monthly Duty Roster Sheet (Mobile + Desktop) */}
      <div className="mx-auto max-w-[760px] lg:max-w-[1290px] rounded-[20px] sm:rounded-[22px] border border-[#EFECE6] bg-white p-2.5 sm:p-5 lg:p-7 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
        {/* Printable Masthead */}
        <div className="mb-3 flex items-center justify-between gap-2.5 border-b border-[#EFECE6] pb-3 lg:pb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 lg:h-10 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#0F766E] to-[#E06D53]" />
            <div className="min-w-0">
              <div className="truncate text-[8.5px] sm:text-[10px] lg:text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#0F766E]">
                HSAAS · Emergency &amp; Trauma Department
              </div>
              <div className="truncate text-[13px] sm:text-[15.5px] lg:text-[20px] font-extrabold text-[#18181B]">
                {periodLabel} Duty Roster
              </div>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] lg:text-xs font-extrabold ${
              isPublished ? 'tone-leave' : 'tone-am'
            }`}
          >
            {isPublished ? '✓ Published' : 'Draft'}
          </span>
        </div>

        {/* Whole-Month Printable Timetable */}
        <div className="overflow-hidden rounded-[14px] border border-[#E7E5E4]">
          <table className="w-full table-fixed border-collapse text-center text-[8px] sm:text-[10.5px] lg:text-[13px]">
            <thead>
              <tr className="bg-[#18181B] text-[#FAF8F5] select-none">
                <th
                  rowSpan={2}
                  className="w-[38px] sm:w-[58px] lg:w-[88px] border-b border-r border-white/12 py-1.5 lg:py-2.5 px-1 lg:px-2 font-extrabold tracking-[0.04em]"
                >
                  DATE
                </th>
                <th
                  rowSpan={2}
                  className="w-[30px] sm:w-[44px] lg:w-[68px] border-b border-r border-white/12 py-1.5 lg:py-2.5 px-1 lg:px-2 font-extrabold tracking-[0.04em]"
                >
                  DAY
                </th>
                <th
                  colSpan={3}
                  className="border-b border-r border-white/12 py-1.5 lg:py-2.5 px-1 lg:px-2 font-extrabold tracking-[0.05em]"
                >
                  MEDICAL OFFICER
                </th>
                <th
                  colSpan={3}
                  className="border-b border-white/12 bg-[#0F766E] py-1.5 lg:py-2.5 px-1 lg:px-2 font-extrabold tracking-[0.05em]"
                >
                  EMERGENCY PHYSICIAN
                </th>
              </tr>
              <tr className="bg-[#27272A] text-[#E7E5E4] text-[7px] sm:text-[9.5px] lg:text-[11.5px] select-none">
                <th className="border-r border-white/10 py-1 lg:py-2 px-0.5 lg:px-2 font-bold">
                  AM
                </th>
                <th className="border-r border-white/10 py-1 lg:py-2 px-0.5 lg:px-2 font-bold">
                  PM
                </th>
                <th className="border-r border-white/12 py-1 lg:py-2 px-0.5 lg:px-2 font-bold">
                  NIGHT
                </th>
                <th className="border-r border-white/12 bg-[#115E59] py-1 lg:py-2 px-0.5 lg:px-2 font-bold">
                  <div>AM</div>
                  <div className="text-[6.5px] sm:text-[7.5px] lg:text-[9.5px] font-semibold opacity-80">
                    8AM–4PM
                  </div>
                </th>
                <th className="border-r border-white/12 bg-[#115E59] py-1 lg:py-2 px-0.5 lg:px-2 font-bold">
                  <div>ONCALL</div>
                  <div className="text-[6.5px] sm:text-[7.5px] lg:text-[9.5px] font-semibold opacity-80">
                    4PM–8AM
                  </div>
                </th>
                <th className="bg-[#115E59] py-1 lg:py-2 px-0.5 lg:px-2 font-bold">
                  <div>OFFICE HOUR</div>
                  <div className="text-[6.5px] sm:text-[7.5px] lg:text-[9.5px] font-semibold opacity-80">
                    8AM–5PM
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {periodDates.map((dateStr) => {
                const dayNum = parseInt(dateStr.slice(8, 10), 10);
                const d = new Date(`${dateStr}T00:00:00Z`);
                const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getUTCDay()];
                const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                const isToday = dateStr === todayStr;
                const holiday = holidays.find((h) => h.date === dateStr);
                const dayData = calendarDailyMap.get(dateStr) ?? { am: [], pm: [], night: [] };

                const epOfficeHour = epMap.get(`${dateStr}:EP_OFFICE_HOUR`) ?? '';
                const epOnCall = epMap.get(`${dateStr}:EP_ONCALL`) ?? '';
                const epPassive = getEffectiveCellValue(dateStr, 'EP_PASSIVE');

                const rowBg = isToday
                  ? 'bg-[#F0FDFA]'
                  : holiday
                    ? 'bg-[#FFFBEB]'
                    : isWeekend
                      ? 'bg-[#F7F4EE]'
                      : 'bg-white';

                return (
                  <tr key={dateStr} className={`${rowBg} border-t border-[#EFECE6]`}>
                    {/* DATE */}
                    <td
                      className={`border-r border-[#EFECE6] py-1.5 px-0.5 sm:px-1 align-middle font-extrabold text-[#18181B] ${
                        isToday ? 'border-l-[3px] border-l-[#0F766E]' : ''
                      }`}
                    >
                      <div className="leading-tight">
                        {String(dayNum).padStart(2, '0')} {shortMonthHeader}
                      </div>
                      {isToday ? (
                        <div className="mt-0.5 text-[6.5px] sm:text-[7px] font-extrabold tracking-[0.04em] text-[#0F766E]">
                          TODAY
                        </div>
                      ) : null}
                      {holiday ? (
                        <div
                          title={holiday.name}
                          className="mt-0.5 inline-block max-w-full truncate rounded-[4px] bg-[#FEF3C7] px-1 py-0.5 text-[6.5px] sm:text-[7.5px] font-extrabold text-[#B45309]"
                        >
                          {holiday.name}
                        </div>
                      ) : null}
                    </td>

                    {/* DAY */}
                    <td
                      className={`border-r border-[#EFECE6] py-1.5 px-0.5 sm:px-1 align-middle font-extrabold ${
                        holiday ? 'text-[#B45309]' : isWeekend ? 'text-[#C2410C]' : 'text-[#78716C]'
                      }`}
                    >
                      {dayName}
                    </td>

                    {/* MO AM */}
                    <td className="border-r border-[#EFECE6] py-1.5 px-0.5 sm:px-1 align-middle">
                      {renderMoList(dayData.am)}
                    </td>

                    {/* MO PM */}
                    <td className="border-r border-[#EFECE6] py-1.5 px-0.5 sm:px-1 align-middle">
                      {renderMoList(dayData.pm)}
                    </td>

                    {/* MO NIGHT */}
                    <td className="border-r border-[#E7E5E4] py-1.5 px-0.5 sm:px-1 align-middle">
                      {renderMoList(dayData.night)}
                    </td>

                    {/* EP AM (Office Hour) */}
                    <td
                      ref={
                        editingCell?.dutyDate === dateStr &&
                        editingCell?.slotType === 'EP_OFFICE_HOUR'
                          ? editingCellRef
                          : undefined
                      }
                      onClick={() => handleCellClick(dateStr, 'EP_OFFICE_HOUR')}
                      title={
                        isEditable && isEpEditMode
                          ? 'Tap to add/remove EP Office Hour (AM)'
                          : undefined
                      }
                      className={`border-r border-[#EFECE6] py-1.5 px-0.5 sm:px-1 align-middle font-bold uppercase text-[#0F766E] ${
                        isEditable && isEpEditMode
                          ? 'cursor-pointer border border-dashed border-[#0F766E] bg-[#F0FDFA]'
                          : 'bg-[#0F766E]/[0.025]'
                      }`}
                    >
                      {editingCell?.dutyDate === dateStr &&
                      editingCell?.slotType === 'EP_OFFICE_HOUR' ? (
                        <div className="space-y-1 text-left" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-1">
                            {emergencyPhysicians.map((epName) => {
                              const active = parseEpNamesList(editingValue).some(
                                (n) =>
                                  normalizeShortName(n).toLowerCase() ===
                                  normalizeShortName(epName).toLowerCase(),
                              );
                              return (
                                <button
                                  key={epName}
                                  type="button"
                                  onClick={() =>
                                    setEditingValue((prev) => toggleEpNameInList(prev, epName))
                                  }
                                  className={`rounded-full border px-1.5 lg:px-2.5 py-0.5 lg:py-1 text-[8px] lg:text-[10.5px] font-extrabold cursor-pointer ${
                                    active
                                      ? 'border-[#0F766E] bg-[#0F766E] text-white'
                                      : 'border-[#E7E5E4] bg-white text-[#57534E]'
                                  }`}
                                >
                                  {active ? `✓ ${epName}` : epName}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-0.5">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveInlineEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              autoFocus
                              placeholder="Dr. ..."
                              className="h-6 lg:h-8 w-full min-w-0 rounded border border-[#0F766E] bg-white px-1 lg:px-2 text-[9px] lg:text-xs font-bold text-[#0F766E]"
                            />
                            <button
                              type="button"
                              onClick={handleSaveInlineEdit}
                              aria-label="Save EP Office Hour"
                              className="shrink-0 rounded bg-[#0F766E] p-1 text-white cursor-pointer"
                            >
                              <Check className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ) : parseEpNamesList(epOfficeHour).length > 0 ? (
                        <div className="flex flex-col items-center gap-[2px]">
                          {parseEpNamesList(epOfficeHour).map((epName) => (
                            <span
                              key={epName}
                              className="inline-flex items-center gap-0.5 break-words leading-[1.25]"
                            >
                              <span>{epName}</span>
                              {isEditable && isEpEditMode ? (
                                <button
                                  type="button"
                                  aria-label={`Remove ${epName}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveEpFromCell(dateStr, 'EP_OFFICE_HOUR', epName);
                                  }}
                                  className="ml-0.5 rounded-full bg-[#0F766E]/15 px-1 lg:px-1.5 text-[8px] lg:text-[10.5px] font-black text-[#0F766E] hover:bg-rose-100 hover:text-rose-700 cursor-pointer"
                                >
                                  ×
                                </button>
                              ) : null}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#D6D3D1] font-normal">
                          {isEditable && isEpEditMode ? '+ OH' : '—'}
                        </span>
                      )}
                    </td>

                    {/* EP ONCALL */}
                    <td
                      ref={
                        editingCell?.dutyDate === dateStr && editingCell?.slotType === 'EP_ONCALL'
                          ? editingCellRef
                          : undefined
                      }
                      onClick={() => handleCellClick(dateStr, 'EP_ONCALL')}
                      title={
                        isEditable && isEpEditMode ? 'Tap to add/remove EP On Call' : undefined
                      }
                      className={`border-r border-[#EFECE6] py-1.5 px-0.5 sm:px-1 align-middle font-bold uppercase text-[#92400E] ${
                        isEditable && isEpEditMode
                          ? 'cursor-pointer border border-dashed border-[#D97706] bg-[#FFFBEB]'
                          : 'bg-[#D97706]/[0.025]'
                      }`}
                    >
                      {editingCell?.dutyDate === dateStr &&
                      editingCell?.slotType === 'EP_ONCALL' ? (
                        <div className="space-y-1 text-left" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-1">
                            {emergencyPhysicians.map((epName) => {
                              const active = parseEpNamesList(editingValue).some(
                                (n) =>
                                  normalizeShortName(n).toLowerCase() ===
                                  normalizeShortName(epName).toLowerCase(),
                              );
                              return (
                                <button
                                  key={epName}
                                  type="button"
                                  onClick={() =>
                                    setEditingValue((prev) => toggleEpNameInList(prev, epName))
                                  }
                                  className={`rounded-full border px-1.5 lg:px-2.5 py-0.5 lg:py-1 text-[8px] lg:text-[10.5px] font-extrabold cursor-pointer ${
                                    active
                                      ? 'border-[#D97706] bg-[#D97706] text-white'
                                      : 'border-[#E7E5E4] bg-white text-[#57534E]'
                                  }`}
                                >
                                  {active ? `✓ ${epName}` : epName}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-0.5">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveInlineEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              autoFocus
                              placeholder="Dr. ..."
                              className="h-6 lg:h-8 w-full min-w-0 rounded border border-[#D97706] bg-white px-1 lg:px-2 text-[9px] lg:text-xs font-bold text-[#92400E]"
                            />
                            <button
                              type="button"
                              onClick={handleSaveInlineEdit}
                              aria-label="Save EP On Call"
                              className="shrink-0 rounded bg-[#D97706] p-1 text-white cursor-pointer"
                            >
                              <Check className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ) : parseEpNamesList(epOnCall).length > 0 ? (
                        <div className="flex flex-col items-center gap-[2px]">
                          {parseEpNamesList(epOnCall).map((epName) => (
                            <span
                              key={epName}
                              className="inline-flex items-center gap-0.5 break-words leading-[1.25]"
                            >
                              <span>{epName}</span>
                              {isEditable && isEpEditMode ? (
                                <button
                                  type="button"
                                  aria-label={`Remove ${epName}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveEpFromCell(dateStr, 'EP_ONCALL', epName);
                                  }}
                                  className="ml-0.5 rounded-full bg-[#D97706]/15 px-1 lg:px-1.5 text-[8px] lg:text-[10.5px] font-black text-[#92400E] hover:bg-rose-100 hover:text-rose-700 cursor-pointer"
                                >
                                  ×
                                </button>
                              ) : null}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#D6D3D1] font-normal">
                          {isEditable && isEpEditMode ? '+ OC' : '—'}
                        </span>
                      )}
                    </td>

                    {/* EP OFFICE HOUR (8AM-5PM) — Auto-populated all EPs except AM & ONCALL, with manual leave removal */}
                    <td
                      ref={
                        editingCell?.dutyDate === dateStr && editingCell?.slotType === 'EP_PASSIVE'
                          ? editingCellRef
                          : undefined
                      }
                      onClick={() => handleCellClick(dateStr, 'EP_PASSIVE')}
                      title={
                        isEditable && isEpEditMode
                          ? 'Tap to add/remove EP Office Hour (8AM–5PM) or click × to remove on leave'
                          : undefined
                      }
                      className={`py-1.5 px-0.5 sm:px-1 align-middle font-bold uppercase text-[#0F766E] ${
                        isEditable && isEpEditMode
                          ? 'cursor-pointer border border-dashed border-[#0F766E] bg-[#F0FDFA]'
                          : 'bg-[#0F766E]/[0.025]'
                      }`}
                    >
                      {editingCell?.dutyDate === dateStr &&
                      editingCell?.slotType === 'EP_PASSIVE' ? (
                        <div className="space-y-1 text-left" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-1">
                            {emergencyPhysicians.map((epName) => {
                              const active = parseEpNamesList(editingValue).some(
                                (n) =>
                                  normalizeShortName(n).toLowerCase() ===
                                  normalizeShortName(epName).toLowerCase(),
                              );
                              return (
                                <button
                                  key={epName}
                                  type="button"
                                  onClick={() =>
                                    setEditingValue((prev) => toggleEpNameInList(prev, epName))
                                  }
                                  className={`rounded-full border px-1.5 lg:px-2.5 py-0.5 lg:py-1 text-[8px] lg:text-[10.5px] font-extrabold cursor-pointer ${
                                    active
                                      ? 'border-[#0F766E] bg-[#0F766E] text-white'
                                      : 'border-[#E7E5E4] bg-white text-[#57534E]'
                                  }`}
                                >
                                  {active ? `✓ ${epName}` : epName}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-0.5">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveInlineEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              autoFocus
                              placeholder="Dr. ..."
                              className="h-6 lg:h-8 w-full min-w-0 rounded border border-[#0F766E] bg-white px-1 lg:px-2 text-[9px] lg:text-xs font-bold text-[#0F766E]"
                            />
                            <button
                              type="button"
                              onClick={handleSaveInlineEdit}
                              aria-label="Save EP Office Hour 8AM-5PM"
                              className="shrink-0 rounded bg-[#0F766E] p-1 text-white cursor-pointer"
                            >
                              <Check className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ) : parseEpNamesList(epPassive).length > 0 ? (
                        <div className="flex flex-col items-center gap-[2px]">
                          {parseEpNamesList(epPassive).map((epName) => (
                            <span
                              key={epName}
                              className="inline-flex items-center gap-0.5 break-words leading-[1.25]"
                            >
                              <span>{epName}</span>
                              {isEditable && isEpEditMode ? (
                                <button
                                  type="button"
                                  aria-label={`Remove ${epName}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveEpFromCell(dateStr, 'EP_PASSIVE', epName);
                                  }}
                                  className="ml-0.5 rounded-full bg-[#0F766E]/15 px-1 lg:px-1.5 text-[8px] lg:text-[10.5px] font-black text-[#0F766E] hover:bg-rose-100 hover:text-rose-700 cursor-pointer"
                                >
                                  ×
                                </button>
                              ) : null}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#D6D3D1] font-normal">
                          {isEditable && isEpEditMode ? '+ OH 8-5' : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Legend */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 text-[9px] sm:text-[9.5px] text-[#57534E]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-[#E7E5E4] bg-[#F7F4EE]" />
              <span>Weekend</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-[#FDE68A] bg-[#FFFBEB]" />
              <span>Public Holiday</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-[#99F6E4] bg-[#CCFBF1]" />
              <strong className="text-[#0F766E]">Your Duty</strong>
            </span>
          </div>
          <span className="font-bold text-[#78716C]">HSAAS ED · Printable Roster Sheet</span>
        </div>
      </div>
    </div>
  );
}
