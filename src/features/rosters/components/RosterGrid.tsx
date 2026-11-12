import { useState } from 'react';
import type { ShiftDefinitionRow } from '../data/rosterQueries';
import type { Assignment, PublicHolidayEntry, StaffRosterIdentity } from '../domain/types';

interface RosterGridProps {
  periodDates: readonly string[];
  staffList: readonly StaffRosterIdentity[];
  assignments: readonly Assignment[];
  shiftDefinitions: readonly ShiftDefinitionRow[];
  holidays: readonly PublicHolidayEntry[];
  density: 'comfortable' | 'compact';
  isEditable: boolean;
  onSelectCell: (staff: StaffRosterIdentity, date: string, currentCode?: string) => void;
  selectedCell?: { staffId: number; date: string } | null;
}

function getShiftBadgeStyle(shiftCode?: string): string {
  if (!shiftCode) return 'text-stone-300 hover:text-stone-500';
  const c = shiftCode.toUpperCase().trim();
  if (c.includes('AM')) {
    return 'bg-[#E5EED8] text-[#2D4A22] border border-[#C6D8B6] font-bold shadow-2xs';
  }
  if (c.includes('PM')) {
    return 'bg-[#DCE7F9] text-[#1E3A8A] border border-[#B8CEF2] font-bold shadow-2xs';
  }
  if (c.includes('ND') || c.includes('NIGHT')) {
    return 'bg-[#FCE7F1] text-[#9D174D] border border-[#F8B9D4] font-bold shadow-2xs';
  }
  if (c.includes('ON')) {
    return 'bg-[#FEF3C7] text-[#854D0E] border border-[#FDE047] font-bold shadow-2xs';
  }
  if (c.includes('PN')) {
    return 'bg-[#EDE9FE] text-[#5B21B6] border border-[#DDD6FE] font-bold shadow-2xs';
  }
  if (c.includes('OFF') || c.includes('GOFF')) {
    return 'bg-[#F5F5F4] text-[#57534E] border border-[#E7E5E4] font-bold';
  }
  if (
    c.includes('AL') ||
    c.includes('EL') ||
    c.includes('MC') ||
    c.includes('HKA') ||
    c.includes('GHKA')
  ) {
    return 'bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] font-bold shadow-2xs';
  }
  if (c.includes('COURSE') || c.includes('COURT')) {
    return 'bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD] font-bold shadow-2xs';
  }
  return 'bg-[#FAF8F5] text-stone-800 border border-stone-200 font-semibold';
}

export function RosterGrid({
  periodDates,
  staffList,
  assignments,
  shiftDefinitions,
  holidays,
  density,
  isEditable,
  onSelectCell,
  selectedCell,
}: RosterGridProps) {
  const [filterQuery, setFilterQuery] = useState('');

  // Map assignments by `staffId:date`
  const cellMap = new Map<string, Assignment>();
  for (const a of assignments) {
    cellMap.set(`${a.staffId}:${a.dutyDate}`, a);
  }

  // Map shift colors
  const colorMap = new Map<string, string>();
  for (const s of shiftDefinitions) {
    colorMap.set(s.code.toUpperCase(), s.color_token);
  }

  // Filter staff list defensively
  const filteredStaff = staffList.filter((s) => {
    const q = (filterQuery || '').toLowerCase().trim();
    if (!q) return true;
    const rName = String(
      s.rosterName ?? (s as unknown as { roster_name?: string }).roster_name ?? '',
    ).toLowerCase();
    const sCode = String(
      s.staffCode ?? (s as unknown as { staff_code?: string }).staff_code ?? '',
    ).toLowerCase();
    const dName = String(
      s.displayName ?? (s as unknown as { display_name?: string }).display_name ?? '',
    ).toLowerCase();
    return rName.includes(q) || sCode.includes(q) || dName.includes(q);
  });

  return (
    <div className="space-y-3">
      {/* Search / Filter toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search staff by name or code..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="h-9 w-64 rounded-lg border border-border-default bg-surface-primary px-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Clear
            </button>
          )}
        </div>
        <div className="text-xs text-text-secondary">
          Showing {filteredStaff.length} of {staffList.length} staff members
        </div>
      </div>

      {/* Grid container with sticky scroll */}
      <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-primary shadow-xs">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border-default bg-surface-secondary/70">
              {/* Sticky Staff Header */}
              <th
                scope="col"
                className="sticky left-0 z-20 min-w-44 bg-surface-secondary px-3 py-2.5 font-semibold text-text-primary shadow-[1px_0_0_0_rgba(0,0,0,0.06)]"
              >
                Staff Member
              </th>

              {/* Day Columns */}
              {periodDates.map((date) => {
                const dayNum = parseInt(date.slice(8, 10), 10);
                const d = new Date(date + 'T00:00:00Z');
                const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
                const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                const holiday = holidays.find((h) => h.date === date);

                return (
                  <th
                    key={date}
                    scope="col"
                    className={`min-w-10 border-l border-border-subtle px-1 py-1.5 text-center font-medium ${
                      holiday
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        : isWeekend
                          ? 'bg-surface-secondary/90 text-text-secondary'
                          : 'text-text-primary'
                    }`}
                    title={holiday ? `${date}: ${holiday.name}` : date}
                  >
                    <div className="text-[11px] font-bold leading-none">{dayNum}</div>
                    <div className="text-[9px] uppercase tracking-wider text-text-muted">
                      {dayName}
                    </div>
                    {holiday && (
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500"
                        title={holiday.name}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border-subtle">
            {filteredStaff.length === 0 ? (
              <tr>
                <td
                  colSpan={periodDates.length + 1}
                  className="px-4 py-8 text-center text-sm text-text-muted"
                >
                  No staff members match &quot;{filterQuery}&quot;.
                </td>
              </tr>
            ) : (
              filteredStaff.map((staff) => {
                const rosterName =
                  staff.rosterName ||
                  (staff as unknown as { roster_name?: string }).roster_name ||
                  'Staff';
                const staffCode =
                  staff.staffCode || (staff as unknown as { staff_code?: string }).staff_code || '';
                const staffGroup =
                  staff.staffGroup ||
                  (staff as unknown as { staff_group?: string }).staff_group ||
                  '';

                return (
                  <tr key={staff.id} className="hover:bg-surface-secondary/40">
                    {/* Sticky Staff Name Cell */}
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-surface-primary px-3 py-2 font-normal shadow-[1px_0_0_0_rgba(0,0,0,0.06)]"
                    >
                      <div className="font-semibold text-text-primary">{rosterName}</div>
                      <div className="text-[10px] text-text-muted">
                        {staffCode ? `${staffCode} · ` : ''}
                        {staffGroup}
                      </div>
                    </th>

                    {/* Day Cells */}
                    {periodDates.map((date) => {
                      const assignment = cellMap.get(`${staff.id}:${date}`);
                      const shiftCode = assignment?.shiftCode;
                      const isSelected =
                        selectedCell?.staffId === staff.id && selectedCell?.date === date;

                      return (
                        <td
                          key={date}
                          onClick={() => {
                            if (isEditable) {
                              onSelectCell(staff, date, shiftCode);
                            }
                          }}
                          className={`border-l border-slate-100 dark:border-slate-800 p-0.5 text-center transition-colors ${
                            isSelected ? 'ring-2 ring-teal-600 ring-inset z-10' : ''
                          } ${isEditable ? 'cursor-pointer hover:bg-teal-50/30 dark:hover:bg-teal-950/20' : ''}`}
                        >
                          <div
                            className={`flex items-center justify-center rounded-lg font-semibold tracking-tight transition-transform ${
                              density === 'comfortable' ? 'h-8 text-xs' : 'h-6 text-[11px]'
                            } ${getShiftBadgeStyle(shiftCode)} ${isEditable ? 'hover:scale-[1.04] active:scale-[0.96]' : ''}`}
                            title={
                              shiftCode
                                ? `${rosterName} on ${date}: ${shiftCode}`
                                : `${rosterName} on ${date}: No assignment`
                            }
                          >
                            {shiftCode ?? '·'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
