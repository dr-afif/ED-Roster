import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Settings2, Users } from 'lucide-react';
import type { Assignment, StaffRosterIdentity } from '../domain/types';

export interface TallyThresholds {
  amMin: number;
  pmMin: number;
  nightMin: number;
  nightMax: number;
  totalLeaveMax: number;
}

const DEFAULT_THRESHOLDS: TallyThresholds = {
  amMin: 4,
  pmMin: 4,
  nightMin: 2,
  nightMax: 4,
  totalLeaveMax: 3,
};

interface RosterTallyTablesProps {
  periodDates: readonly string[];
  staffList: readonly StaffRosterIdentity[];
  assignments: readonly Assignment[];
}

export function RosterTallyTables({ periodDates, staffList, assignments }: RosterTallyTablesProps) {
  const [thresholds, setThresholds] = useState<TallyThresholds>(DEFAULT_THRESHOLDS);
  const [showSettings, setShowSettings] = useState(false);
  const [showMemberTally, setShowMemberTally] = useState(false);

  // Group assignments by date -> shiftCode -> count
  const dailyTally = new Map<
    string,
    { am: number; pm: number; night: number; leave: number; empty: number }
  >();
  for (const date of periodDates) {
    dailyTally.set(date, { am: 0, pm: 0, night: 0, leave: 0, empty: staffList.length });
  }

  // Group assignments by staffId -> stats
  const memberTally = new Map<
    number,
    {
      am: number;
      pm: number;
      night: number;
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
      off: 0,
      goff: 0,
      leave: 0,
      totalWorked: 0,
    });
  }

  for (const a of assignments) {
    const code = (a.shiftCode || '').toUpperCase().trim();
    const day = dailyTally.get(a.dutyDate);
    const mem = memberTally.get(a.staffId);

    const isAm = code === 'AM';
    const isPm = code === 'PM';
    const isNight =
      code === 'ND' || code === 'NIGHT' || code === 'ON1' || code === 'ON2' || code === 'PN';
    const isLeave = ['AL', 'EL', 'MC', 'LEAVE', 'CR_LEAVE', 'MATERNITY', 'UNPAID'].includes(code);
    const isOff = code === 'OFF';
    const isGoff = code === 'GOFF';

    if (day) {
      if (isAm) day.am += 1;
      else if (isPm) day.pm += 1;
      else if (isNight) day.night += 1;
      else if (isLeave) day.leave += 1;
      if (code) day.empty = Math.max(0, day.empty - 1);
    }

    if (mem) {
      if (isAm) {
        mem.am += 1;
        mem.totalWorked += 1;
      } else if (isPm) {
        mem.pm += 1;
        mem.totalWorked += 1;
      } else if (isNight) {
        mem.night += 1;
        mem.totalWorked += 1;
      } else if (isOff) {
        mem.off += 1;
      } else if (isGoff) {
        mem.goff += 1;
      } else if (isLeave) {
        mem.leave += 1;
      }
    }
  }

  return (
    <div className="space-y-4 pt-2">
      {/* 1. Daily Shift Distribution Tally */}
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-primary shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-surface-secondary/60 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-text-primary">📊 Shift Distribution Tally</span>
            <span className="text-[11px] text-text-secondary">
              (Daily duty staffing totals & alert guidance)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-primary px-2.5 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Alert Thresholds
          </button>
        </div>

        {/* Optional Thresholds Config Panel */}
        {showSettings && (
          <div className="border-b border-border-default bg-amber-500/5 p-3 text-xs">
            <div className="mb-2 font-semibold text-text-primary">
              ⚙️ Shift Coverage Guidance Thresholds:
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-text-muted">Min AM</span>
                <input
                  type="number"
                  min="0"
                  value={thresholds.amMin}
                  onChange={(e) =>
                    setThresholds((t) => ({ ...t, amMin: Number(e.target.value) || 0 }))
                  }
                  className="h-7 rounded border border-border-default bg-surface-primary px-2 text-xs text-text-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-text-muted">Min PM</span>
                <input
                  type="number"
                  min="0"
                  value={thresholds.pmMin}
                  onChange={(e) =>
                    setThresholds((t) => ({ ...t, pmMin: Number(e.target.value) || 0 }))
                  }
                  className="h-7 rounded border border-border-default bg-surface-primary px-2 text-xs text-text-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-text-muted">Min Night</span>
                <input
                  type="number"
                  min="0"
                  value={thresholds.nightMin}
                  onChange={(e) =>
                    setThresholds((t) => ({ ...t, nightMin: Number(e.target.value) || 0 }))
                  }
                  className="h-7 rounded border border-border-default bg-surface-primary px-2 text-xs text-text-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-text-muted">Max Night</span>
                <input
                  type="number"
                  min="0"
                  value={thresholds.nightMax}
                  onChange={(e) =>
                    setThresholds((t) => ({ ...t, nightMax: Number(e.target.value) || 0 }))
                  }
                  className="h-7 rounded border border-border-default bg-surface-primary px-2 text-xs text-text-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-text-muted">Max Leave</span>
                <input
                  type="number"
                  min="0"
                  value={thresholds.totalLeaveMax}
                  onChange={(e) =>
                    setThresholds((t) => ({ ...t, totalLeaveMax: Number(e.target.value) || 0 }))
                  }
                  className="h-7 rounded border border-border-default bg-surface-primary px-2 text-xs text-text-primary"
                />
              </label>
            </div>
          </div>
        )}

        {/* Tally Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border-default bg-surface-secondary/40 text-[11px] font-semibold text-text-secondary">
                <th className="sticky left-0 z-10 min-w-36 bg-surface-secondary px-3 py-1.5 text-left shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                  Shift Category
                </th>
                {periodDates.map((date) => {
                  const dayNum = parseInt(date.slice(8, 10), 10);
                  return (
                    <th
                      key={date}
                      className="min-w-10 border-l border-border-subtle px-1 py-1 text-center font-bold"
                    >
                      {dayNum}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
              {/* Row AM */}
              <tr>
                <td className="sticky left-0 z-10 bg-surface-primary px-3 py-1 font-sans font-bold text-amber-700 dark:text-amber-400 shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                  🌅 AM Shift
                </td>
                {periodDates.map((date) => {
                  const count = dailyTally.get(date)?.am ?? 0;
                  const isBelow = count < thresholds.amMin;
                  return (
                    <td
                      key={date}
                      className={`border-l border-border-subtle px-1 py-1 text-center font-bold ${
                        isBelow
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 font-extrabold'
                          : 'text-text-primary'
                      }`}
                      title={isBelow ? `Alert: Below AM minimum of ${thresholds.amMin}` : undefined}
                    >
                      {count}
                      {isBelow && (
                        <span className="text-[9px] text-amber-600 block leading-none">⚠️</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row PM */}
              <tr>
                <td className="sticky left-0 z-10 bg-surface-primary px-3 py-1 font-sans font-bold text-sky-700 dark:text-sky-400 shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                  🌇 PM Shift
                </td>
                {periodDates.map((date) => {
                  const count = dailyTally.get(date)?.pm ?? 0;
                  const isBelow = count < thresholds.pmMin;
                  return (
                    <td
                      key={date}
                      className={`border-l border-border-subtle px-1 py-1 text-center font-bold ${
                        isBelow
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 font-extrabold'
                          : 'text-text-primary'
                      }`}
                      title={isBelow ? `Alert: Below PM minimum of ${thresholds.pmMin}` : undefined}
                    >
                      {count}
                      {isBelow && (
                        <span className="text-[9px] text-amber-600 block leading-none">⚠️</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row Night */}
              <tr>
                <td className="sticky left-0 z-10 bg-surface-primary px-3 py-1 font-sans font-bold text-indigo-700 dark:text-indigo-400 shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                  🌙 Night Duty (ND)
                </td>
                {periodDates.map((date) => {
                  const count = dailyTally.get(date)?.night ?? 0;
                  const isBelow = count < thresholds.nightMin;
                  const isAbove = count > thresholds.nightMax;
                  const isAlert = isBelow || isAbove;
                  return (
                    <td
                      key={date}
                      className={`border-l border-border-subtle px-1 py-1 text-center font-bold ${
                        isAlert
                          ? 'bg-rose-500/15 text-rose-800 dark:text-rose-300 font-extrabold'
                          : 'text-text-primary'
                      }`}
                      title={
                        isBelow
                          ? `Alert: Below Night minimum of ${thresholds.nightMin}`
                          : isAbove
                            ? `Alert: Exceeds Night maximum of ${thresholds.nightMax}`
                            : undefined
                      }
                    >
                      {count}
                      {isAlert && (
                        <span className="text-[9px] text-rose-600 block leading-none">⚠️</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row Total Leave */}
              <tr>
                <td className="sticky left-0 z-10 bg-surface-primary px-3 py-1 font-sans font-medium text-emerald-700 dark:text-emerald-400 shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                  🏖️ Total Leave
                </td>
                {periodDates.map((date) => {
                  const count = dailyTally.get(date)?.leave ?? 0;
                  const isAbove = count > thresholds.totalLeaveMax;
                  return (
                    <td
                      key={date}
                      className={`border-l border-border-subtle px-1 py-1 text-center font-bold ${
                        isAbove
                          ? 'bg-rose-500/15 text-rose-800 dark:text-rose-300'
                          : 'text-text-muted'
                      }`}
                      title={
                        isAbove
                          ? `Alert: Exceeds Total Leave maximum of ${thresholds.totalLeaveMax}`
                          : undefined
                      }
                    >
                      {count}
                      {isAbove && (
                        <span className="text-[9px] text-rose-600 block leading-none">⚠️</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row Empty */}
              <tr>
                <td className="sticky left-0 z-10 bg-surface-primary px-3 py-1 font-sans text-text-muted shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                  ⚪ Unassigned
                </td>
                {periodDates.map((date) => {
                  const count = dailyTally.get(date)?.empty ?? 0;
                  return (
                    <td
                      key={date}
                      className={`border-l border-border-subtle px-1 py-1 text-center ${
                        count > 0 ? 'text-amber-600 font-semibold' : 'text-text-muted'
                      }`}
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

      {/* 2. Individual Member Shift Tally Card */}
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-primary shadow-xs">
        <button
          type="button"
          onClick={() => setShowMemberTally(!showMemberTally)}
          className="flex w-full items-center justify-between border-b border-border-default bg-surface-secondary/60 px-4 py-2.5 text-left"
        >
          <div className="flex items-center gap-2">
            {showMemberTally ? (
              <ChevronDown className="h-4 w-4 text-text-muted" />
            ) : (
              <ChevronRight className="h-4 w-4 text-text-muted" />
            )}
            <span className="text-sm font-bold text-text-primary">
              👤 Individual Member Shift Tally
            </span>
            <span className="text-xs text-text-muted">
              ({staffList.length} members · Monthly workload distribution)
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Users className="h-3.5 w-3.5" />
            <span>{showMemberTally ? 'Collapse' : 'Expand'}</span>
          </div>
        </button>

        {showMemberTally && (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-surface-secondary text-[11px] font-semibold text-text-secondary">
                <tr className="border-b border-border-default">
                  <th className="px-3 py-2">Doctor Name</th>
                  <th className="px-2 py-2 text-center">Code</th>
                  <th className="px-2 py-2 text-center font-bold text-amber-700 dark:text-amber-400">
                    AM
                  </th>
                  <th className="px-2 py-2 text-center font-bold text-sky-700 dark:text-sky-400">
                    PM
                  </th>
                  <th className="px-2 py-2 text-center font-bold text-indigo-700 dark:text-indigo-400">
                    NIGHT
                  </th>
                  <th className="px-2 py-2 text-center font-bold text-brand-primary">
                    Total Worked
                  </th>
                  <th className="px-2 py-2 text-center font-medium text-emerald-700">OFF</th>
                  <th className="px-2 py-2 text-center font-medium text-purple-700">GOFF</th>
                  <th className="px-2 py-2 text-center font-medium text-rose-700">Leaves</th>
                  <th className="px-3 py-2 text-center">Guidance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle font-mono text-xs">
                {staffList.map((staff) => {
                  const stats = memberTally.get(staff.id) ?? {
                    am: 0,
                    pm: 0,
                    night: 0,
                    off: 0,
                    goff: 0,
                    leave: 0,
                    totalWorked: 0,
                  };
                  const isHighNight = stats.night >= 7;
                  const isLowWorked = stats.totalWorked > 0 && stats.totalWorked < 15;

                  return (
                    <tr key={staff.id} className="hover:bg-surface-secondary/40 font-sans">
                      <td className="px-3 py-2 font-medium text-text-primary">
                        {staff.rosterName || staff.displayName}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-[11px] text-text-muted">
                        {staff.staffCode}
                      </td>
                      <td className="px-2 py-2 text-center font-mono font-bold text-amber-700 dark:text-amber-400">
                        {stats.am}
                      </td>
                      <td className="px-2 py-2 text-center font-mono font-bold text-sky-700 dark:text-sky-400">
                        {stats.pm}
                      </td>
                      <td
                        className={`px-2 py-2 text-center font-mono font-bold ${
                          isHighNight
                            ? 'text-rose-600 bg-rose-500/10'
                            : 'text-indigo-700 dark:text-indigo-400'
                        }`}
                      >
                        {stats.night}
                      </td>
                      <td className="px-2 py-2 text-center font-mono font-extrabold text-brand-primary bg-brand-primary/5">
                        {stats.totalWorked}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                        {stats.off}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-purple-700 dark:text-purple-400 font-semibold">
                        {stats.goff}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-rose-700 dark:text-rose-400 font-semibold">
                        {stats.leave}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isHighNight ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                            <AlertTriangle className="h-3 w-3" />
                            Heavy Night Load ({stats.night})
                          </span>
                        ) : isLowWorked ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                            Low Shifts ({stats.totalWorked})
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
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
        )}
      </div>
    </div>
  );
}
