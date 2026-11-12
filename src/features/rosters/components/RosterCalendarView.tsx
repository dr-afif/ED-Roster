import { useMemo, useState } from 'react';
import { Award, Check, Edit3, Paintbrush, Search, X } from 'lucide-react';
import type { EpAssignmentRow } from '../data/rosterQueries';
import type { Assignment, PublicHolidayEntry, StaffRosterIdentity } from '../domain/types';

interface RosterCalendarViewProps {
  periodDates: readonly string[];
  staffList: readonly StaffRosterIdentity[];
  assignments: readonly Assignment[];
  epAssignments: readonly EpAssignmentRow[];
  holidays: readonly PublicHolidayEntry[];
  isEditable: boolean;
  onUpdateEpAssignment?: (
    dutyDate: string,
    slotType: 'EP_OFFICE_HOUR' | 'EP_ONCALL',
    names: string,
  ) => void;
  onBatchUpdateEpAssignments?: (
    payloads: Array<{
      dutyDate: string;
      slotType: 'EP_OFFICE_HOUR' | 'EP_ONCALL';
      physicianNames: string;
    }>,
  ) => void;
}

export function RosterCalendarView({
  periodDates,
  staffList,
  assignments,
  epAssignments,
  holidays,
  isEditable,
  onUpdateEpAssignment,
  onBatchUpdateEpAssignments,
}: RosterCalendarViewProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [isEpEditMode, setIsEpEditMode] = useState(false);
  const [activeEpStamp, setActiveEpStamp] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{
    dutyDate: string;
    slotType: 'EP_OFFICE_HOUR' | 'EP_ONCALL';
  } | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Map staffId to StaffRosterIdentity for quick name lookup
  const staffMap = useMemo(() => {
    const map = new Map<number, StaffRosterIdentity>();
    for (const s of staffList) {
      map.set(s.id, s);
    }
    return map;
  }, [staffList]);

  // Available Emergency Physicians from staffList
  const emergencyPhysicians = useMemo(() => {
    const eps = staffList.filter(
      (s) =>
        s.staffGroup?.toLowerCase().includes('physician') ||
        s.staffGroup?.toLowerCase().includes('specialist') ||
        (s as unknown as { staff_group?: string }).staff_group?.toLowerCase().includes('physician'),
    );
    if (eps.length > 0) {
      return eps.map((s) => s.rosterName || s.displayName);
    }
    // Fallback: extract distinct EP names from epAssignments
    const namesSet = new Set<string>();
    for (const ep of epAssignments) {
      for (const n of ep.physician_names.split(/[,\n]+/)) {
        const trimmed = n.trim();
        if (trimmed) namesSet.add(trimmed);
      }
    }
    return Array.from(namesSet);
  }, [staffList, epAssignments]);

  // Map EP assignments by `${dutyDate}:${slotType}`
  const epMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ep of epAssignments) {
      map.set(`${ep.duty_date}:${ep.slot_type}`, ep.physician_names);
    }
    return map;
  }, [epAssignments]);

  // Group MO assignments by date -> shift category -> list of doctor names
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

      const shift = (a.shiftCode || '').toUpperCase().trim();
      if (shift === 'AM') {
        dayData.am.push({ id: a.staffId, name, code });
      } else if (shift === 'PM') {
        dayData.pm.push({ id: a.staffId, name, code });
      } else if (
        shift === 'ND' ||
        shift === 'NIGHT' ||
        shift === 'ON1' ||
        shift === 'ON2' ||
        shift === 'PN'
      ) {
        dayData.night.push({ id: a.staffId, name, code });
      }
    }

    return map;
  }, [periodDates, assignments, staffMap]);

  // Today string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const handleCellClick = (dutyDate: string, slotType: 'EP_OFFICE_HOUR' | 'EP_ONCALL') => {
    if (!isEditable || !isEpEditMode) return;

    if (activeEpStamp) {
      // Direct stamp application
      onUpdateEpAssignment?.(dutyDate, slotType, activeEpStamp);
    } else {
      // Open inline edit
      const current = epMap.get(`${dutyDate}:${slotType}`) ?? '';
      setEditingCell({ dutyDate, slotType });
      setEditingValue(current);
    }
  };

  const handleSaveInlineEdit = () => {
    if (!editingCell) return;
    onUpdateEpAssignment?.(editingCell.dutyDate, editingCell.slotType, editingValue);
    setEditingCell(null);
  };

  const handleBatchFill = (
    target: 'weekdays' | 'weekends',
    slotType: 'EP_OFFICE_HOUR' | 'EP_ONCALL',
  ) => {
    if (!activeEpStamp || !onBatchUpdateEpAssignments) return;
    const payloads: Array<{
      dutyDate: string;
      slotType: 'EP_OFFICE_HOUR' | 'EP_ONCALL';
      physicianNames: string;
    }> = [];

    for (const date of periodDates) {
      const d = new Date(date + 'T00:00:00Z');
      const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
      if (target === 'weekdays' && !isWeekend) {
        payloads.push({ dutyDate: date, slotType, physicianNames: activeEpStamp });
      } else if (target === 'weekends' && isWeekend) {
        payloads.push({ dutyDate: date, slotType, physicianNames: activeEpStamp });
      }
    }

    onBatchUpdateEpAssignments(payloads);
  };

  const isQueryMatched = (name: string, code: string) => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return false;
    return name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
  };

  return (
    <div className="space-y-4">
      {/* EP Painter Toolbar (When in Active EP Edit Mode) */}
      {isEditable && isEpEditMode && (
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50/90 via-emerald-50/80 to-teal-50/90 p-3 shadow-xs dark:border-teal-900/60 dark:from-teal-950/40 dark:via-emerald-950/30 dark:to-teal-950/40 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-200/60 pb-2.5 dark:border-teal-800/40">
            <div className="flex items-center gap-2">
              <Paintbrush className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <span className="text-xs font-bold text-teal-900 dark:text-teal-200">
                Emergency Physician Quick Stamp & Painter:
              </span>
              {activeEpStamp ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2 py-0.5 text-xs font-extrabold text-white">
                  Active Stamp: {activeEpStamp}
                  <button
                    type="button"
                    onClick={() => setActiveEpStamp(null)}
                    className="ml-1 hover:text-teal-200"
                    title="Clear Stamp"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : (
                <span className="text-[11px] text-teal-700/80 dark:text-teal-400/80">
                  (Click a physician stamp below to quickly paint onto Office Hour or On Call cells)
                </span>
              )}
            </div>

            {activeEpStamp && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleBatchFill('weekdays', 'EP_OFFICE_HOUR')}
                  className="rounded-lg border border-teal-300 bg-white px-2.5 py-1 font-semibold text-teal-800 shadow-2xs hover:bg-teal-50 dark:border-teal-700 dark:bg-teal-900/40 dark:text-teal-200"
                >
                  ⚡ Fill Weekdays (Office Hour)
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchFill('weekends', 'EP_ONCALL')}
                  className="rounded-lg border border-teal-300 bg-white px-2.5 py-1 font-semibold text-teal-800 shadow-2xs hover:bg-teal-50 dark:border-teal-700 dark:bg-teal-900/40 dark:text-teal-200"
                >
                  ⚡ Fill Weekends (On Call)
                </button>
              </div>
            )}
          </div>

          {/* Physician Stamp Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            {emergencyPhysicians.map((name) => {
              const isSelected = activeEpStamp === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setActiveEpStamp(isSelected ? null : name)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                    isSelected
                      ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                      : 'border-teal-200 bg-white text-teal-800 hover:border-teal-400 hover:bg-teal-50 dark:border-teal-800 dark:bg-surface-primary dark:text-teal-300'
                  }`}
                >
                  <Award className="h-3 w-3" />
                  {name}
                  {isSelected && <Check className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter / Search Bar & EP Edit Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 text-text-muted" />
          <input
            type="search"
            placeholder="Search doctor to highlight on calendar..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="h-9 w-72 rounded-lg border border-border-default bg-surface-primary pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-xs text-text-secondary">
            📅 Showing {periodDates.length} days (MO &amp; EP Coverage)
          </div>

          {isEditable && (
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
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                isEpEditMode
                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                  : 'border border-border-default bg-surface-secondary/70 text-text-primary hover:bg-surface-secondary hover:border-teal-500/50'
              }`}
            >
              {isEpEditMode ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Done Editing EP
                </>
              ) : (
                <>
                  <Edit3 className="h-3.5 w-3.5 text-teal-600" />
                  Edit EP Schedule
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 📊 Finalized Monthly Table Card (Calendar View) */}
      <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-primary shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-4xl border-collapse text-center text-xs">
            <thead>
              {/* Row 1 Header */}
              <tr className="border-b border-border-default bg-slate-800 text-white select-none dark:bg-slate-900">
                <th
                  rowSpan={2}
                  className="w-14 border-r border-slate-700 px-2 py-2.5 font-bold uppercase tracking-wider text-[11px]"
                >
                  DATE
                </th>
                <th
                  rowSpan={2}
                  className="w-14 border-r border-slate-700 px-2 py-2.5 font-bold uppercase tracking-wider text-[11px]"
                >
                  DAY
                </th>
                <th
                  colSpan={3}
                  className="border-r border-slate-700 bg-slate-750 px-3 py-2 font-bold uppercase tracking-wider text-xs"
                >
                  👨‍⚕️ MEDICAL OFFICER (ON DUTY)
                </th>
                <th
                  colSpan={2}
                  className="bg-teal-800 px-3 py-2 font-bold uppercase tracking-wider text-xs dark:bg-teal-900"
                >
                  🩺 EMERGENCY PHYSICIAN (SPECIALIST)
                </th>
              </tr>

              {/* Row 2 Subheader */}
              <tr className="border-b border-border-default bg-slate-700 text-white select-none dark:bg-slate-800 text-[11px]">
                <th className="w-1/5 border-r border-slate-600 px-2 py-1.5 font-bold text-amber-300">
                  AM (08:00 - 16:00)
                </th>
                <th className="w-1/5 border-r border-slate-600 px-2 py-1.5 font-bold text-sky-300">
                  PM (16:00 - 23:00)
                </th>
                <th className="w-1/5 border-r border-slate-600 px-2 py-1.5 font-bold text-indigo-300">
                  NIGHT (23:00 - 08:00)
                </th>
                <th className="w-1/5 border-r border-slate-600 bg-teal-700/80 px-2 py-1.5 font-bold text-teal-200">
                  OFFICE HOUR (08:00 - 16:00)
                </th>
                <th className="w-1/5 bg-teal-700/80 px-2 py-1.5 font-bold text-teal-200">
                  ON CALL (16:00 - 08:00)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {periodDates.map((dateStr) => {
                const dayNum = parseInt(dateStr.slice(8, 10), 10);
                const d = new Date(dateStr + 'T00:00:00Z');
                const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getUTCDay()];
                const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                const isToday = dateStr === todayStr;
                const holiday = holidays.find((h) => h.date === dateStr);
                const dayData = calendarDailyMap.get(dateStr) ?? { am: [], pm: [], night: [] };

                const epOfficeHour = epMap.get(`${dateStr}:EP_OFFICE_HOUR`) ?? '';
                const epOnCall = epMap.get(`${dateStr}:EP_ONCALL`) ?? '';

                return (
                  <tr
                    key={dateStr}
                    className={`transition-colors ${
                      isToday
                        ? 'bg-brand-primary/10 font-medium'
                        : holiday
                          ? 'bg-rose-500/10'
                          : isWeekend
                            ? 'bg-surface-secondary/60'
                            : 'hover:bg-surface-secondary/30'
                    }`}
                  >
                    {/* Date */}
                    <td className="border-r border-border-subtle px-2 py-2 font-bold text-text-primary">
                      <span className="text-sm">{dayNum}</span>
                      {isToday && (
                        <span className="block text-[9px] font-extrabold text-brand-primary uppercase">
                          TODAY
                        </span>
                      )}
                      {holiday && !isToday && (
                        <span
                          className="block text-[8px] font-extrabold text-rose-600 uppercase truncate max-w-16 mx-auto"
                          title={holiday.name}
                        >
                          {holiday.name}
                        </span>
                      )}
                    </td>

                    {/* Day Name */}
                    <td
                      className={`border-r border-border-subtle px-2 py-2 font-bold ${
                        isWeekend ? 'text-amber-700 dark:text-amber-400' : 'text-text-secondary'
                      }`}
                    >
                      {dayName}
                    </td>

                    {/* MO AM */}
                    <td className="border-r border-border-subtle p-1.5 align-top">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {dayData.am.length > 0 ? (
                          dayData.am.map((doc) => {
                            const matched = isQueryMatched(doc.name, doc.code);
                            return (
                              <span
                                key={doc.id}
                                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                                  matched
                                    ? 'bg-amber-300 text-amber-900 ring-2 ring-amber-400 animate-pulse'
                                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/20'
                                }`}
                                title={`${doc.name} (${doc.code})`}
                              >
                                {doc.name}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-text-muted">-</span>
                        )}
                      </div>
                    </td>

                    {/* MO PM */}
                    <td className="border-r border-border-subtle p-1.5 align-top">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {dayData.pm.length > 0 ? (
                          dayData.pm.map((doc) => {
                            const matched = isQueryMatched(doc.name, doc.code);
                            return (
                              <span
                                key={doc.id}
                                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                                  matched
                                    ? 'bg-amber-300 text-amber-900 ring-2 ring-amber-400 animate-pulse'
                                    : 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-500/20'
                                }`}
                                title={`${doc.name} (${doc.code})`}
                              >
                                {doc.name}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-text-muted">-</span>
                        )}
                      </div>
                    </td>

                    {/* MO NIGHT */}
                    <td className="border-r border-border-subtle p-1.5 align-top">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {dayData.night.length > 0 ? (
                          dayData.night.map((doc) => {
                            const matched = isQueryMatched(doc.name, doc.code);
                            return (
                              <span
                                key={doc.id}
                                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                                  matched
                                    ? 'bg-amber-300 text-amber-900 ring-2 ring-amber-400 animate-pulse'
                                    : 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-500/20'
                                }`}
                                title={`${doc.name} (${doc.code})`}
                              >
                                {doc.name}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-text-muted">-</span>
                        )}
                      </div>
                    </td>

                    {/* EP Office Hour */}
                    <td
                      onClick={() => handleCellClick(dateStr, 'EP_OFFICE_HOUR')}
                      className={`border-r border-border-subtle p-1.5 align-middle ${
                        isEditable && isEpEditMode ? 'cursor-pointer hover:bg-teal-500/10' : ''
                      }`}
                      title={
                        isEditable && isEpEditMode
                          ? 'Click to assign or stamp Emergency Physician'
                          : undefined
                      }
                    >
                      {editingCell?.dutyDate === dateStr &&
                      editingCell?.slotType === 'EP_OFFICE_HOUR' ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineEdit();
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            autoFocus
                            placeholder="e.g. Dr Afif"
                            className="h-7 w-full rounded border border-teal-500 bg-surface-primary px-1.5 text-xs font-bold text-teal-800 dark:text-teal-200"
                          />
                          <button
                            type="button"
                            onClick={handleSaveInlineEdit}
                            className="rounded bg-teal-600 p-1 text-white hover:bg-teal-700"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : epOfficeHour ? (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {epOfficeHour.split(/[,\n]+/).map((n) => {
                            const trimmed = n.trim();
                            if (!trimmed) return null;
                            const matched = isQueryMatched(trimmed, '');
                            return (
                              <span
                                key={trimmed}
                                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                                  matched
                                    ? 'bg-amber-300 text-amber-900 ring-2 ring-amber-400'
                                    : 'bg-teal-500/15 text-teal-900 dark:text-teal-200 border border-teal-500/20'
                                }`}
                              >
                                {trimmed}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-text-muted text-[11px] italic">
                          {isEditable && isEpEditMode ? '+ Assign EP' : '-'}
                        </span>
                      )}
                    </td>

                    {/* EP On Call */}
                    <td
                      onClick={() => handleCellClick(dateStr, 'EP_ONCALL')}
                      className={`p-1.5 align-middle ${
                        isEditable && isEpEditMode ? 'cursor-pointer hover:bg-teal-500/10' : ''
                      }`}
                      title={
                        isEditable && isEpEditMode
                          ? 'Click to assign or stamp Emergency Physician'
                          : undefined
                      }
                    >
                      {editingCell?.dutyDate === dateStr &&
                      editingCell?.slotType === 'EP_ONCALL' ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineEdit();
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            autoFocus
                            placeholder="e.g. Dr Afif"
                            className="h-7 w-full rounded border border-teal-500 bg-surface-primary px-1.5 text-xs font-bold text-teal-800 dark:text-teal-200"
                          />
                          <button
                            type="button"
                            onClick={handleSaveInlineEdit}
                            className="rounded bg-teal-600 p-1 text-white hover:bg-teal-700"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : epOnCall ? (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {epOnCall.split(/[,\n]+/).map((n) => {
                            const trimmed = n.trim();
                            if (!trimmed) return null;
                            const matched = isQueryMatched(trimmed, '');
                            return (
                              <span
                                key={trimmed}
                                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                                  matched
                                    ? 'bg-amber-300 text-amber-900 ring-2 ring-amber-400'
                                    : 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border border-emerald-500/20'
                                }`}
                              >
                                {trimmed}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-text-muted text-[11px] italic">
                          {isEditable && isEpEditMode ? '+ Assign EP' : '-'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
