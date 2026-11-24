import { useState } from 'react';
import { ChevronDown, ChevronRight, Settings2, SlidersHorizontal, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { type SharedTallyThresholds, useAppUiState } from '@/shared/ui';
import { getMoWorkMode, type Assignment, type StaffRosterIdentity } from '../domain/types';

export type TallyThresholds = SharedTallyThresholds;

interface RosterTallyTablesProps {
  periodDates: readonly string[];
  staffList: readonly StaffRosterIdentity[];
  assignments: readonly Assignment[];
}

function cleanShiftCode(raw?: string): string {
  return (raw || '')
    .toUpperCase()
    .replace(/\(S\)|-S|\(X\)|-X/g, '')
    .trim();
}

export function RosterTallyTables({ periodDates, staffList, assignments }: RosterTallyTablesProps) {
  const { tallyThresholds, setTallyThresholds, showToast } = useAppUiState();
  const [prevTallyThresholds, setPrevTallyThresholds] =
    useState<SharedTallyThresholds>(tallyThresholds);
  const [draftThresholds, setDraftThresholds] = useState<SharedTallyThresholds>(tallyThresholds);
  const [isDirty, setIsDirty] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMemberTally, setShowMemberTally] = useState(false);

  if (prevTallyThresholds !== tallyThresholds) {
    setPrevTallyThresholds(tallyThresholds);
    setDraftThresholds(tallyThresholds);
    setIsDirty(false);
  }

  const thresholds = isDirty ? draftThresholds : tallyThresholds;

  const dailyTally = new Map<
    string,
    { am: number; pm: number; night: number; pn: number; leave: number; empty: number }
  >();
  for (const date of periodDates) {
    dailyTally.set(date, { am: 0, pm: 0, night: 0, pn: 0, leave: 0, empty: staffList.length });
  }

  const memberTally = new Map<
    number,
    {
      am: number;
      pm: number;
      night: number;
      pn: number;
      off: number;
      goff: number;
      leave: number;
      totalWorked: number;
    }
  >();
  for (const staff of staffList) {
    memberTally.set(staff.id, {
      am: 0,
      pm: 0,
      night: 0,
      pn: 0,
      off: 0,
      goff: 0,
      leave: 0,
      totalWorked: 0,
    });
  }

  const staffById = new Map(staffList.map((s) => [s.id, s]));

  for (const a of assignments) {
    const code = cleanShiftCode(a.shiftCode);
    const day = dailyTally.get(a.dutyDate);
    const mem = memberTally.get(a.staffId);
    const workMode = getMoWorkMode(staffById.get(a.staffId)?.staffGroup);

    if (workMode === 'oh_non_clinical') {
      if (day && code) day.empty = Math.max(0, day.empty - 1);
      continue;
    }

    const isAm = code === 'AM' || code === 'AMX' || (workMode === 'oh_clinical' && code === 'OH');
    const isPm = code === 'PM' || code === 'PMX';
    const isNight =
      code === 'ND' || code === 'NIGHT' || code === 'ON' || code === 'ON1' || code === 'ON2';
    const isPostNight = code === 'PN';
    const isOff = code === 'OFF';
    const isGoff = code === 'GOFF';
    const isLeave =
      !(workMode === 'oh_clinical' && code === 'OH') &&
      [
        'AL',
        'EL',
        'MC',
        'HKA',
        'GHKA',
        'COURSE',
        'OH',
        'COURT',
        'LEAVE',
        'CR_LEAVE',
        'MATERNITY',
        'UNPAID',
      ].includes(code);

    if (day) {
      if (isAm) day.am += 1;
      else if (isPm) day.pm += 1;
      else if (isNight) day.night += 1;
      else if (isPostNight) day.pn += 1;
      else if (isOff || isGoff || isLeave) day.leave += 1;
      if (code) day.empty = Math.max(0, day.empty - 1);
    }

    if (mem) {
      if (isAm) {
        mem.am += 1;
        mem.totalWorked += 1;
      } else if (isPm) {
        mem.pm += 1;
        mem.totalWorked += 1;
      } else if (code === 'MEDSB') {
        mem.totalWorked += 1;
      } else if (isNight) {
        mem.night += 1;
        mem.totalWorked += 1;
      } else if (isPostNight) {
        mem.pn += 1;
      } else if (isOff) {
        mem.off += 1;
      } else if (isGoff) {
        mem.goff += 1;
      } else if (isLeave) {
        mem.leave += 1;
      }
    }
  }

  const updateDraftField = (field: keyof SharedTallyThresholds, rawValue: string) => {
    setDraftThresholds((prev) => ({ ...prev, [field]: Math.max(0, Number(rawValue) || 0) }));
    setIsDirty(true);
  };

  const handleSaveThresholds = () => {
    setTallyThresholds(draftThresholds);
    setIsDirty(false);
    showToast('Alert thresholds saved & synced with Rules & Policies ✓');
  };

  return (
    <div className="space-y-3 pt-1">
      {/* 1. Daily Shift Distribution Tally */}
      <div className="overflow-hidden rounded-[22px] border border-[#E7E5E4] bg-white shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7E5E4] bg-[#FAFAF9] px-4 py-2.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[13px] font-extrabold text-[#1C1917]">
              📊 Shift Distribution Tally
            </span>
            <span className="text-[11px] font-semibold text-[#78716C]">
              · Daily duty staffing totals &amp; alert guidance
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition cursor-pointer ${
              showSettings
                ? 'bg-[#18181B] text-white border-[#18181B]'
                : 'bg-white text-[#57534E] border-[#E7E5E4] hover:border-stone-400'
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>Alert Thresholds</span>
          </button>
        </div>

        {/* Thresholds Config Panel (Persisted & Synced to Rules & Policies) */}
        {showSettings ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 font-extrabold text-[#92400E]">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Guidance Thresholds:</span>
              </span>
              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[#78716C]">
                <span>AM Min</span>
                <input
                  type="number"
                  min="0"
                  value={draftThresholds.amMin}
                  onChange={(e) => updateDraftField('amMin', e.target.value)}
                  className="h-7 w-11 rounded-md border border-[#D6D3D1] bg-white px-1.5 text-center text-xs font-extrabold text-[#1C1917]"
                />
              </label>
              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[#78716C]">
                <span>PM Min</span>
                <input
                  type="number"
                  min="0"
                  value={draftThresholds.pmMin}
                  onChange={(e) => updateDraftField('pmMin', e.target.value)}
                  className="h-7 w-11 rounded-md border border-[#D6D3D1] bg-white px-1.5 text-center text-xs font-extrabold text-[#1C1917]"
                />
              </label>
              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[#78716C]">
                <span>Night Min</span>
                <input
                  type="number"
                  min="0"
                  value={draftThresholds.nightMin}
                  onChange={(e) => updateDraftField('nightMin', e.target.value)}
                  className="h-7 w-11 rounded-md border border-[#D6D3D1] bg-white px-1.5 text-center text-xs font-extrabold text-[#1C1917]"
                />
              </label>
              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[#78716C]">
                <span>Night Max</span>
                <input
                  type="number"
                  min="0"
                  value={draftThresholds.nightMax}
                  onChange={(e) => updateDraftField('nightMax', e.target.value)}
                  className="h-7 w-11 rounded-md border border-[#D6D3D1] bg-white px-1.5 text-center text-xs font-extrabold text-[#1C1917]"
                />
              </label>
              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[#78716C]">
                <span>Leave Max</span>
                <input
                  type="number"
                  min="0"
                  value={draftThresholds.totalLeaveMax}
                  onChange={(e) => updateDraftField('totalLeaveMax', e.target.value)}
                  className="h-7 w-11 rounded-md border border-[#D6D3D1] bg-white px-1.5 text-center text-xs font-extrabold text-[#1C1917]"
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                  isDirty ? 'tone-am' : 'tone-leave'
                }`}
              >
                {isDirty ? 'Unsaved edits' : 'Synced ✓'}
              </span>
              <Link
                to="/admin/rules"
                className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-1 text-[10.5px] font-bold text-[#57534E] hover:border-stone-400 hover:text-[#18181B]"
              >
                Rules &amp; Policies ↗
              </Link>
              <button
                type="button"
                onClick={handleSaveThresholds}
                className="rounded-full bg-[#0F766E] px-3 py-1 text-[11px] font-extrabold text-white hover:bg-[#115E59] cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        ) : null}

        {/* Tally Matrix */}
        <div className="overflow-x-auto lg:overflow-hidden">
          <table className="w-max min-w-full lg:w-full lg:table-fixed border-collapse text-center text-[10px]">
            <thead>
              <tr className="border-b border-[#E7E5E4] bg-[#FAF8F5] text-[#57534E] font-extrabold">
                <th className="sticky left-0 z-10 w-[108px] min-w-[98px] bg-[#FAF8F5] px-2.5 py-2 text-center border-r border-[#E7E5E4]">
                  Bucket
                </th>
                {periodDates.map((date) => {
                  const dayNum = parseInt(date.slice(8, 10), 10);
                  const isSunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
                  return (
                    <th
                      key={date}
                      className={`min-w-[26px] lg:min-w-0 py-1.5 px-0.5 text-center font-extrabold ${
                        isSunday ? 'border-r-2 border-r-[#D6D3D1]' : 'border-r border-r-[#F4EFE6]'
                      }`}
                    >
                      {dayNum}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="text-[10px]">
              {/* Row AM */}
              <tr className="border-b border-[#F4EFE6]">
                <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-center font-extrabold text-[#9A3412] border-r border-[#E7E5E4] whitespace-nowrap">
                  <span>☀️ AM (≥{thresholds.amMin})</span>
                  <span className="sr-only">AM Shift</span>
                </td>
                {periodDates.map((date) => {
                  const count = dailyTally.get(date)?.am ?? 0;
                  const isBelow = count < thresholds.amMin;
                  const isSunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
                  return (
                    <td
                      key={date}
                      className={`py-1.5 px-0.5 text-center font-extrabold tabular-nums ${
                        isBelow ? 'bg-[#FEF2F2] text-[#DC2626]' : 'text-[#1C1917]'
                      } ${isSunday ? 'border-r-2 border-r-[#D6D3D1]' : 'border-r border-r-[#F4EFE6]'}`}
                      title={isBelow ? `Alert: Below AM minimum of ${thresholds.amMin}` : undefined}
                    >
                      {count}
                      {isBelow ? '⚠' : ''}
                    </td>
                  );
                })}
              </tr>

              {/* Row PM */}
              <tr className="border-b border-[#F4EFE6]">
                <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-center font-extrabold text-[#0F766E] border-r border-[#E7E5E4] whitespace-nowrap">
                  <span>🌇 PM (≥{thresholds.pmMin})</span>
                  <span className="sr-only">PM Shift</span>
                </td>
                {periodDates.map((date) => {
                  const count = dailyTally.get(date)?.pm ?? 0;
                  const isBelow = count < thresholds.pmMin;
                  const isSunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
                  return (
                    <td
                      key={date}
                      className={`py-1.5 px-0.5 text-center font-extrabold tabular-nums ${
                        isBelow ? 'bg-[#FEF2F2] text-[#DC2626]' : 'text-[#1C1917]'
                      } ${isSunday ? 'border-r-2 border-r-[#D6D3D1]' : 'border-r border-r-[#F4EFE6]'}`}
                      title={isBelow ? `Alert: Below PM minimum of ${thresholds.pmMin}` : undefined}
                    >
                      {count}
                      {isBelow ? '⚠' : ''}
                    </td>
                  );
                })}
              </tr>

              {/* Row Night */}
              <tr className="border-b border-[#F4EFE6]">
                <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-center font-extrabold text-[#3730A3] border-r border-[#E7E5E4] whitespace-nowrap">
                  <span>
                    🌙 Night ({thresholds.nightMin}–{thresholds.nightMax})
                  </span>
                  <span className="sr-only">Night Duty</span>
                </td>
                {periodDates.map((date) => {
                  const count = dailyTally.get(date)?.night ?? 0;
                  const isBelow = count < thresholds.nightMin;
                  const isAbove = count > thresholds.nightMax;
                  const isAlert = isBelow || isAbove;
                  const isSunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
                  return (
                    <td
                      key={date}
                      className={`py-1.5 px-0.5 text-center font-extrabold tabular-nums ${
                        isAlert ? 'bg-[#FEF2F2] text-[#DC2626]' : 'text-[#1C1917]'
                      } ${isSunday ? 'border-r-2 border-r-[#D6D3D1]' : 'border-r border-r-[#F4EFE6]'}`}
                      title={
                        isBelow
                          ? `Alert: Below Night minimum of ${thresholds.nightMin}`
                          : isAbove
                            ? `Alert: Exceeds Night maximum of ${thresholds.nightMax}`
                            : undefined
                      }
                    >
                      {count}
                      {isAlert ? '⚠' : ''}
                    </td>
                  );
                })}
              </tr>

              {/* Row Post Night */}
              <tr className="border-b border-[#F4EFE6]">
                <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-center font-extrabold text-[#6D28D9] border-r border-[#E7E5E4] whitespace-nowrap">
                  <span>😴 Post Night (PN)</span>
                  <span className="sr-only">Post Night</span>
                </td>
                {periodDates.map((date) => {
                  const count = dailyTally.get(date)?.pn ?? 0;
                  const isSunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
                  return (
                    <td
                      key={date}
                      className={`py-1.5 px-0.5 text-center font-bold tabular-nums text-[#57534E] ${
                        isSunday ? 'border-r-2 border-r-[#D6D3D1]' : 'border-r border-r-[#F4EFE6]'
                      }`}
                    >
                      {count}
                    </td>
                  );
                })}
              </tr>

              {/* Row Total Leave */}
              <tr className="border-b border-[#F4EFE6]">
                <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-center font-extrabold text-[#166534] border-r border-[#E7E5E4] whitespace-nowrap">
                  <span>🌴 Leave (≤{thresholds.totalLeaveMax})</span>
                  <span className="sr-only">Total Leave</span>
                </td>
                {periodDates.map((date) => {
                  const count = dailyTally.get(date)?.leave ?? 0;
                  const isAbove = count > thresholds.totalLeaveMax;
                  const isSunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
                  return (
                    <td
                      key={date}
                      className={`py-1.5 px-0.5 text-center font-bold tabular-nums ${
                        isAbove ? 'bg-[#FFF1F2] text-[#BE123C]' : 'text-[#57534E]'
                      } ${isSunday ? 'border-r-2 border-r-[#D6D3D1]' : 'border-r border-r-[#F4EFE6]'}`}
                      title={
                        isAbove
                          ? `Alert: Exceeds Total Leave maximum of ${thresholds.totalLeaveMax}`
                          : undefined
                      }
                    >
                      {count}
                    </td>
                  );
                })}
              </tr>

              {/* Row Unassigned */}
              <tr>
                <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-center font-bold text-[#78716C] border-r border-[#E7E5E4] whitespace-nowrap">
                  ○ Unassigned
                </td>
                {periodDates.map((date) => {
                  const count = dailyTally.get(date)?.empty ?? 0;
                  const isSunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
                  return (
                    <td
                      key={date}
                      className={`py-1.5 px-0.5 text-center font-bold tabular-nums ${
                        count > 0 ? 'text-[#D97706]' : 'text-[#A8A29E]'
                      } ${isSunday ? 'border-r-2 border-r-[#D6D3D1]' : 'border-r border-r-[#F4EFE6]'}`}
                    >
                      {count}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Individual Member Shift Tally Card (Expandable) */}
      <div className="overflow-hidden rounded-[22px] border border-[#E7E5E4] bg-white shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
        <button
          type="button"
          onClick={() => setShowMemberTally(!showMemberTally)}
          className={`flex w-full items-center justify-between bg-[#FAFAF9] px-4 py-2.5 text-left cursor-pointer ${
            showMemberTally ? 'border-b border-[#E7E5E4]' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            {showMemberTally ? (
              <ChevronDown className="h-4 w-4 text-[#57534E]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[#57534E]" />
            )}
            <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[#1C1917]">
              <Users className="h-4 w-4 text-[#0F766E] shrink-0" />
              <span>Individual Member Shift Tally</span>
            </span>
            <span className="text-[11px] font-semibold text-[#78716C]">
              ({staffList.length} members · Monthly workload distribution)
            </span>
          </div>
          <span className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-0.5 text-[10.5px] font-bold text-[#57534E]">
            {showMemberTally ? 'Collapse' : 'Expand'}
          </span>
        </button>

        {showMemberTally ? (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full border-collapse text-center text-[11px]">
              <thead className="sticky top-0 z-10 bg-[#FAF8F5] text-[#57534E] font-extrabold">
                <tr className="border-b border-[#E7E5E4]">
                  <th className="sticky left-0 bg-[#FAF8F5] px-3 py-2 text-left border-r border-[#E7E5E4]">
                    Doctor Name
                  </th>
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2 text-[#B45309]">AM</th>
                  <th className="px-2 py-2 text-[#0F766E]">PM</th>
                  <th className="px-2 py-2 text-[#3730A3]">NIGHT</th>
                  <th className="px-2 py-2 text-[#6D28D9]">PN</th>
                  <th className="px-2 py-2 text-[#0F766E]">
                    <span className="sr-only">Total</span>Worked
                  </th>
                  <th className="px-2 py-2 text-[#15803D]">OFF</th>
                  <th className="px-2 py-2 text-[#6D28D9]">GOFF</th>
                  <th className="px-2 py-2 text-[#BE123C]">Leaves</th>
                  <th className="px-3 py-2">Guidance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4EFE6]">
                {staffList.map((staff) => {
                  const stats = memberTally.get(staff.id) ?? {
                    am: 0,
                    pm: 0,
                    night: 0,
                    pn: 0,
                    off: 0,
                    goff: 0,
                    leave: 0,
                    totalWorked: 0,
                  };
                  const isHighNight = stats.night >= 7;
                  const isLowWorked = stats.totalWorked > 0 && stats.totalWorked < 15;

                  return (
                    <tr key={staff.id} className="hover:bg-[#FAF8F5]">
                      <td className="sticky left-0 bg-white px-3 py-2 text-left font-extrabold text-[#18181B] border-r border-[#E7E5E4]">
                        {staff.rosterName}
                      </td>
                      <td className="px-2 py-2 font-mono text-[10px] text-[#78716C]">
                        {staff.staffCode}
                      </td>
                      <td className="px-2 py-2 font-extrabold text-[#B45309] tabular-nums">
                        {stats.am}
                      </td>
                      <td className="px-2 py-2 font-extrabold text-[#0F766E] tabular-nums">
                        {stats.pm}
                      </td>
                      <td
                        className={`px-2 py-2 font-extrabold tabular-nums ${
                          isHighNight ? 'text-[#DC2626]' : 'text-[#3730A3]'
                        }`}
                      >
                        {stats.night}
                      </td>
                      <td className="px-2 py-2 font-bold text-[#6D28D9] tabular-nums">
                        {stats.pn}
                      </td>
                      <td className="px-2 py-2 font-extrabold bg-[#F0FDFA] text-[#0F766E] tabular-nums">
                        {stats.totalWorked}
                      </td>
                      <td className="px-2 py-2 font-bold text-[#15803D] tabular-nums">
                        {stats.off}
                      </td>
                      <td className="px-2 py-2 font-bold text-[#6D28D9] tabular-nums">
                        {stats.goff}
                      </td>
                      <td className="px-2 py-2 font-bold text-[#BE123C] tabular-nums">
                        {stats.leave}
                      </td>
                      <td className="px-3 py-2">
                        {isHighNight ? (
                          <span className="inline-flex items-center gap-1 rounded-full tone-nd px-2 py-0.5 text-[10px] font-bold">
                            ⚠ Heavy Night
                          </span>
                        ) : isLowWorked ? (
                          <span className="inline-flex items-center gap-1 rounded-full tone-am px-2 py-0.5 text-[10px] font-bold">
                            Low Shifts
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full tone-leave px-2 py-0.5 text-[10px] font-bold">
                            ✓ Balanced
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
