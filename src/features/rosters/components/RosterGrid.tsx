import { getShiftToneClasses, stripShiftModifiers } from '@/shared/ui';
import type { ShiftDefinitionRow } from '../data/rosterQueries';
import type { Assignment, PublicHolidayEntry, StaffRosterIdentity } from '../domain/types';

export interface RosterGridProps {
  periodDates: readonly string[];
  staffList: readonly StaffRosterIdentity[];
  assignments: readonly Assignment[];
  shiftDefinitions: readonly ShiftDefinitionRow[];
  holidays: readonly PublicHolidayEntry[];
  isEditable: boolean;
  isTableEditEnabled?: boolean;
  rosterEditMode?: 'normal' | 'fast' | 'standby' | 'extended';
  onSelectCell: (
    staff: StaffRosterIdentity,
    date: string,
    currentCode?: string,
    shiftKey?: boolean,
  ) => void;
  onBlockedEditTap?: () => void;
  selectedCell?: { staffId: number; date: string } | null;
  selectedRangeKeys?: ReadonlySet<string>;
  requests?: ReadonlyArray<{
    staff_id?: number | string;
    date: string;
    request: string;
    note?: string;
  }>;
  amendedCellKeys?: ReadonlySet<string>;
  dirtyCellKeys?: ReadonlySet<string>;
}

const WORKING_SHIFTS = new Set(['AM', 'PM', 'ON1', 'ON2', 'PN', 'MEDSB']);

export function RosterGrid({
  periodDates,
  staffList,
  assignments,
  shiftDefinitions,
  holidays,
  isEditable,
  isTableEditEnabled = false,
  rosterEditMode = 'normal',
  onSelectCell,
  onBlockedEditTap,
  selectedCell,
  selectedRangeKeys,
  requests = [],
  amendedCellKeys,
  dirtyCellKeys,
}: RosterGridProps) {
  void shiftDefinitions;

  // Map assignments by `staffId:date`
  const cellMap = new Map<string, Assignment>();
  for (const a of assignments) {
    cellMap.set(`${a.staffId}:${a.dutyDate}`, a);
  }

  // Map requests by `staffId:date`
  const requestMap = new Map<string, { request: string; note?: string }>();
  for (const r of requests) {
    if (r.staff_id != null && r.date && r.request) {
      requestMap.set(`${r.staff_id}:${r.date}`, {
        request: r.request.toUpperCase().trim(),
        note: r.note,
      });
    }
  }

  // Prototype adaptive mobile row height
  const rowTargetH =
    staffList.length <= 15 ? 36 : Math.max(27, Math.floor(540 / Math.max(1, staffList.length)));
  const cellH = Math.max(22, rowTargetH - 5);
  const cellPadY = Math.max(2, Math.floor((rowTargetH - 18) / 2));
  const needsVScroll = staffList.length * rowTargetH > 505;

  return (
    <div className="space-y-2">
      {/* Prototype Matrix Card */}
      <div
        className={`overflow-x-auto lg:overflow-hidden rounded-[20px] border border-[#E7E5E4] bg-white shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)] ${
          needsVScroll ? 'max-h-[530px] lg:max-h-none overflow-y-auto lg:overflow-y-visible' : ''
        }`}
      >
        <table className="w-max min-w-full lg:w-full lg:table-fixed border-collapse text-center">
          <thead>
            <tr className="border-b border-[#E7E5E4] bg-[#FAF8F5] text-[9.5px] font-extrabold text-[#57534E]">
              <th
                scope="col"
                className="sticky top-0 left-0 z-20 w-[108px] min-w-[96px] bg-[#FAF8F5] px-2.5 py-2 text-left font-extrabold text-[#57534E] border-r border-[#E7E5E4]"
              >
                Staff Member
              </th>

              {periodDates.map((date) => {
                const dayNum = parseInt(date.slice(8, 10), 10);
                const d = new Date(`${date}T00:00:00Z`);
                const utcDay = d.getUTCDay();
                const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][utcDay];
                const isWeekend = utcDay === 0 || utcDay === 6;
                const isSunday = utcDay === 0;
                const holiday = holidays.find((h) => h.date === date);

                return (
                  <th
                    key={date}
                    scope="col"
                    title={
                      holiday ? `${date}: ${holiday.name}` : isWeekend ? `${date}: Weekend` : date
                    }
                    className={`sticky top-0 z-10 min-w-[38px] lg:min-w-0 py-1.5 px-0.5 text-center font-extrabold ${
                      holiday
                        ? 'bg-[#FFE4E6] text-[#BE123C]'
                        : isWeekend
                          ? 'bg-[#FEF3C7] text-[#B45309]'
                          : 'bg-[#FAF8F5] text-[#57534E]'
                    } ${
                      isSunday ? 'border-r-2 border-r-[#D6D3D1]' : 'border-r border-r-[#F4EFE6]'
                    }`}
                  >
                    <div className="text-[10px] font-extrabold leading-tight">{dayNum}</div>
                    <div
                      className={`text-[7px] font-extrabold leading-tight ${
                        holiday ? 'text-[#E11D48]' : isWeekend ? 'text-[#D97706]' : 'text-[#A8A29E]'
                      }`}
                    >
                      {holiday ? 'PH' : dayName}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {staffList.map((staff) => {
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
                <tr
                  key={staff.id}
                  className="border-b border-[#F4EFE6] hover:bg-[#FAF8F5]/60 transition-colors"
                >
                  <th
                    scope="row"
                    title={`${rosterName}${staffCode ? ` · ${staffCode}` : ''}${staffGroup ? ` · ${staffGroup}` : ''}`}
                    style={{ paddingTop: cellPadY, paddingBottom: cellPadY }}
                    className="sticky left-0 z-10 w-[112px] min-w-[100px] bg-white px-2.5 text-left text-[11.5px] font-extrabold text-[#18181B] border-r border-[#E7E5E4] truncate"
                  >
                    {rosterName}
                  </th>

                  {periodDates.map((date) => {
                    const d = new Date(`${date}T00:00:00Z`);
                    const utcDay = d.getUTCDay();
                    const isWeekend = utcDay === 0 || utcDay === 6;
                    const isSunday = utcDay === 0;
                    const holiday = holidays.find((h) => h.date === date);

                    const assignment = cellMap.get(`${staff.id}:${date}`);
                    const shiftCode = assignment?.shiftCode;
                    const parsed = stripShiftModifiers(shiftCode);
                    const reqEntry = requestMap.get(`${staff.id}:${date}`);
                    const isPendingRequest = Boolean(!parsed.cleanShift && reqEntry?.request);
                    const displayShiftCode =
                      shiftCode || (isPendingRequest ? reqEntry?.request : undefined);
                    const displayParsed = stripShiftModifiers(displayShiftCode);
                    const isHonoredRequest = Boolean(
                      reqEntry && parsed.cleanShift && parsed.cleanShift === reqEntry.request,
                    );
                    const isOverride = Boolean(
                      reqEntry && parsed.cleanShift && parsed.cleanShift !== reqEntry.request,
                    );
                    const hasMoNote = Boolean(reqEntry?.note && reqEntry.note.trim());
                    const trimmedAdminNote = assignment?.note?.trim() ?? '';
                    const hasStandbyNote = /\bstandby\s*\(s\)/i.test(trimmedAdminNote);
                    const isStandby = parsed.isStandby || hasStandbyNote;
                    const isDisplayStandby = displayParsed.isStandby || hasStandbyNote;
                    const hasAdminNote = Boolean(
                      trimmedAdminNote && !/^standby\s*\(s\)$/i.test(trimmedAdminNote),
                    );
                    const isAmended = Boolean(amendedCellKeys?.has(`${staff.id}:${date}`));
                    const isDirty = Boolean(dirtyCellKeys?.has(`${staff.id}:${date}`));
                    const isSelected =
                      (selectedCell?.staffId === staff.id && selectedCell?.date === date) ||
                      Boolean(selectedRangeKeys?.has(`${staff.id}:${date}`));

                    const isWorking = WORKING_SHIFTS.has(parsed.cleanShift);
                    const isCellDisabled =
                      isEditable &&
                      isTableEditEnabled &&
                      ((rosterEditMode === 'standby' && (!parsed.cleanShift || isWorking)) ||
                        (rosterEditMode === 'extended' && !isWorking));

                    const tdBg = holiday
                      ? 'bg-[#FFF5F6]'
                      : isWeekend
                        ? 'bg-[#FFFDF2]'
                        : 'bg-transparent';

                    const tipParts: string[] = [];
                    tipParts.push(
                      shiftCode
                        ? `${rosterName} on ${date}: ${shiftCode}`
                        : isPendingRequest
                          ? `${rosterName} on ${date}: Requested ${reqEntry?.request} (Not yet assigned)`
                          : `${rosterName} on ${date}: No assignment`,
                    );
                    if (isHonoredRequest) {
                      tipParts.push(`Request Honored: ${reqEntry?.request}`);
                    }
                    if (isOverride) {
                      tipParts.push(
                        `Override: Requested ${reqEntry?.request} → Assigned ${parsed.cleanShift || 'None'}`,
                      );
                    }
                    if (hasMoNote) tipParts.push(`MO Note: ${reqEntry?.note}`);
                    if (isStandby) tipParts.push('Standby (S)');
                    if (hasAdminNote) tipParts.push(`Admin Note: ${assignment?.note}`);
                    if (isAmended) tipParts.push('Post-publication amendment');
                    if (isDirty) tipParts.push('Unsaved edit');

                    const modOutlineClass = isDirty
                      ? 'outline outline-[1.5px] outline-dashed outline-[#E06D53]'
                      : isStandby && parsed.isExtended
                        ? 'outline outline-[1.5px] outline-dashed outline-[#0F766E]'
                        : isStandby
                          ? 'outline outline-[1.5px] outline-[#D97706]'
                          : parsed.isExtended
                            ? 'outline outline-[1.5px] outline-[#0F766E]'
                            : isPendingRequest
                              ? 'outline outline-[1px] outline-dashed outline-[#0F766E]/55 opacity-85'
                              : '';

                    return (
                      <td
                        key={date}
                        data-cell-key={`${staff.id}:${date}`}
                        onClick={(e) => {
                          if (!isEditable) return;
                          if (!isTableEditEnabled) {
                            onBlockedEditTap?.();
                            return;
                          }
                          if (isCellDisabled) return;
                          onSelectCell(staff, date, shiftCode, e.shiftKey);
                        }}
                        className={`${tdBg} p-[1.5px] text-center transition-colors ${
                          isSunday ? 'border-r-2 border-r-[#D6D3D1]' : 'border-r border-r-[#F4EFE6]'
                        } ${isSelected ? 'ring-2 ring-[#0F766E] ring-inset z-10' : ''} ${
                          isEditable
                            ? isCellDisabled
                              ? 'cursor-not-allowed'
                              : 'cursor-pointer'
                            : ''
                        }`}
                      >
                        <div
                          title={tipParts.join('\n')}
                          style={{ height: cellH }}
                          className={`relative flex items-center justify-center rounded-[6px] tracking-tight transition-transform overflow-hidden font-extrabold text-[10.5px] sm:text-[11px] lg:text-[10.5px] ${getShiftToneClasses(
                            displayShiftCode,
                            isHonoredRequest,
                          )} ${modOutlineClass} ${
                            isCellDisabled
                              ? 'opacity-35'
                              : isEditable && isTableEditEnabled
                                ? 'hover:scale-[1.04] active:scale-[0.96]'
                                : ''
                          }`}
                        >
                          {hasAdminNote ? (
                            <span
                              aria-hidden="true"
                              className="absolute top-[2px] left-[2px] h-[4.5px] w-[4.5px] rounded-full bg-[#7C3AED]"
                            />
                          ) : null}
                          {hasMoNote ? (
                            <span
                              aria-hidden="true"
                              className="absolute top-[2px] right-[2px] h-[4.5px] w-[4.5px] rounded-full bg-[#0284C7]"
                            />
                          ) : null}
                          {isHonoredRequest ? (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-[2px] right-[2px] h-[4.5px] w-[4.5px] rounded-full bg-[#16A34A]"
                            />
                          ) : isOverride ? (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-[2px] right-[2px] h-[4.5px] w-[4.5px] rounded-full bg-[#D97706]"
                            />
                          ) : null}
                          {isAmended ? (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-[1px] left-[2px] text-[6px] font-extrabold text-[#E11D48] leading-none"
                            >
                              Δ
                            </span>
                          ) : null}
                          <span>{displayParsed.cleanShift || '·'}</span>
                          {isDisplayStandby ? (
                            <span className="ml-0.5 rounded-[3px] bg-[#D97706] px-[2.5px] text-[7.5px] font-extrabold text-white leading-tight">
                              S
                            </span>
                          ) : null}
                          {displayParsed.isExtended ? (
                            <span className="ml-0.5 rounded-[3px] bg-[#0F766E] px-[2.5px] text-[7.5px] font-extrabold text-white leading-tight">
                              EX
                            </span>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Inline Prototype Legend Bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-2 text-[10px] font-bold text-[#57534E]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#0F766E]" />
          <span>Solid Fill = Requested Shift (Honored)</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#D97706]" />
          <span>Override</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0284C7]" />
          <span>MO Comment</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />
          <span>Admin Note</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="font-extrabold text-[#E11D48]">Δ</span>
          <span>Amended</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="rounded-[3px] bg-[#D97706] px-1 text-[7.5px] font-extrabold text-white">
            S
          </span>
          <span>Standby</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="rounded-[3px] bg-[#0F766E] px-1 text-[7.5px] font-extrabold text-white">
            EX
          </span>
          <span>Extended</span>
        </span>
      </div>
    </div>
  );
}
