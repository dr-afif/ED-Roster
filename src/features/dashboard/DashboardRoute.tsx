import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthBoundary } from '@/platform/auth';
import { usePublicHolidayTracker } from '@/features/public-holidays/usePublicHolidayTracker';
import { useAllRequestsQuery, useTeamMembersQuery } from '@/features/requests/useRequests';
import { DEFAULT_MONTHLY_LIMIT, toIsoDate } from '@/features/requests/domain/quota';
import {
  useDraftAssignmentsQuery,
  usePlannedAssignmentsQuery,
  useRosterEpAssignmentsQuery,
  useRosterPeriodQuery,
  useRuleVersionQuery,
} from '@/features/rosters/data/rosterQueries';
import { getDatesInRange } from '@/features/rosters/domain/rulesEngine';
import {
  APP_LOCALE,
  APP_TIMEZONE,
  formatRosterPeriodLabel,
  getMalaysiaYearMonth,
} from '@/shared/dates';
import {
  getShiftToneClasses,
  SegmentedArcGauge,
  Skeleton,
  stripShiftModifiers,
  useAppUiState,
} from '@/shared/ui';

const PROTOTYPE_STAFF_NAMES = [
  'Dr. Afif',
  'Dr. Siti',
  'Dr. Lee',
  'Dr. Wong',
  'Dr. Tan',
  'Dr. Farah',
  'Dr. Amir',
  'Dr. Lim',
] as const;

const SEED_PATTERNS: readonly (readonly string[])[] = [
  ['AM', 'AM', 'PM', 'PM', 'ON1', 'OFF', 'OFF'],
  ['PM', 'AM', 'AM', 'OFF', 'PM', 'ON1', 'OFF'],
  ['ON1', 'OFF', 'AM', 'AM', 'PM', 'PM', 'OFF'],
  ['OFF', 'ON2', 'PM', 'ON1', 'OFF', 'AM', 'AM'],
  ['AM', 'PM', 'OFF', 'ON2', 'AM', 'OFF', 'PM'],
  ['PM', 'OFF', 'AM', 'PM', 'OFF', 'AM', 'ON1'],
  ['AM', 'ON1', 'OFF', 'AM', 'PM', 'OFF', 'PM'],
  ['OFF', 'PM', 'PM', 'OFF', 'AM', 'ON2', 'OFF'],
];

const SHIFT_TIMES: Record<string, string> = {
  AM: '08:00 – 16:00',
  PM: '16:00 – 23:00',
  ON1: '23:00 – 08:00',
  ON2: '23:00 – 08:00',
  ON: '23:00 – 08:00',
  ND: '23:00 – 08:00',
  PN: 'Post-Night',
  OH: 'Office Hour',
  COURT: 'Court Duty',
  MEDSB: 'Medical Standby',
  OFF: 'Rest Day',
  GOFF: 'Ganti Off',
  AL: 'Annual Leave',
  EL: 'Emergency Leave',
  MC: 'Medical Leave',
  HKA: 'Public Holiday Off',
  GHKA: 'PH Replacement',
  COURSE: 'Course / CME',
};

function getSeededDayInfo(dayNum: number) {
  const amPool: string[] = [];
  const pmPool: string[] = [];
  const ndPool: string[] = [];
  let myShift = 'OFF';

  PROTOTYPE_STAFF_NAMES.forEach((fullName, sIdx) => {
    const short = fullName.replace('Dr. ', '');
    const pat = SEED_PATTERNS[sIdx % SEED_PATTERNS.length] ?? ['OFF'];
    const code = pat[(dayNum - 1 + sIdx) % 7] ?? 'OFF';
    if (sIdx === 0) myShift = code;
    if (code === 'AM' || code === 'OH') amPool.push(short);
    else if (code === 'PM') pmPool.push(short);
    else if (code === 'ON1' || code === 'ON2') ndPool.push(short);
  });

  const epOh = dayNum % 3 === 0 ? 'Razak' : 'Hanim';
  const epOc = dayNum % 2 === 0 ? 'Kumar' : 'Razak';

  return { myShift, amPool, pmPool, ndPool, epOh, epOc };
}

export function DashboardRoute() {
  const { user } = useAuthBoundary();
  const isOwner = user?.role === 'owner';
  const { updates, unreadUpdatesCount, deptSettings, requestWindowSummary } = useAppUiState();
  const [mobileHomeMode, setMobileHomeMode] = useState<'duty' | 'admin'>('duty');
  const currentPeriod = useMemo(() => getMalaysiaYearMonth(new Date()), []);
  const periodLabel = useMemo(
    () => formatRosterPeriodLabel(currentPeriod.year, currentPeriod.month),
    [currentPeriod.year, currentPeriod.month],
  );
  const shortPeriodLabel = useMemo(() => {
    const utcMidMonth = new Date(
      Date.UTC(Number(currentPeriod.year), Number(currentPeriod.month) - 1, 15, 4, 0, 0),
    );
    return new Intl.DateTimeFormat(APP_LOCALE, {
      month: 'short',
      year: 'numeric',
      timeZone: APP_TIMEZONE,
    }).format(utcMidMonth);
  }, [currentPeriod.year, currentPeriod.month]);
  const targetRosterHref = `/rosters/${currentPeriod.year}/${currentPeriod.month}`;

  // Live operational data queries
  const { data: periodRow, isLoading: isPeriodLoading } = useRosterPeriodQuery(
    currentPeriod.year,
    currentPeriod.month,
  );
  const { data: teamMembers = [], isLoading: isMembersLoading } = useTeamMembersQuery();
  const { data: requests = [] } = useAllRequestsQuery();
  const { data: draftAssignments = [], isLoading: isDraftLoading } = useDraftAssignmentsQuery(
    periodRow?.id,
  );
  const { data: plannedAssignments = [], isLoading: isPlannedLoading } = usePlannedAssignmentsQuery(
    periodRow?.id,
  );
  const { data: epAssignments = [] } = useRosterEpAssignmentsQuery(periodRow?.id);
  const { data: ruleVersion } = useRuleVersionQuery();
  const { summaries: phSummaries } = usePublicHolidayTracker(currentPeriod.year);

  const upcomingMonthKey = useMemo(() => {
    const yr = Number(currentPeriod.year);
    const mo = Number(currentPeriod.month);
    const nextDate = new Date(Date.UTC(yr, mo, 1));
    const nextYr = nextDate.getUTCFullYear();
    const nextMo = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
    return `${nextYr}-${nextMo}`;
  }, [currentPeriod.year, currentPeriod.month]);

  const requestMonthlyLimit = Number(
    ((ruleVersion?.config as Record<string, unknown>) ?? {}).request_monthly_limit ??
      DEFAULT_MONTHLY_LIMIT,
  );

  const periodDates = useMemo(() => {
    if (periodRow?.period_start && periodRow?.period_end) {
      return getDatesInRange(periodRow.period_start, periodRow.period_end);
    }
    const yr = Number(currentPeriod.year);
    const mo = Number(currentPeriod.month);
    const daysInMonth = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      return `${currentPeriod.year}-${currentPeriod.month}-${d}`;
    });
  }, [periodRow, currentPeriod.year, currentPeriod.month]);

  const todayIndex = useMemo(() => {
    const todayIso = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: APP_TIMEZONE,
    }).format(new Date());
    const idx = periodDates.indexOf(todayIso);
    return idx >= 0 ? idx : Math.min(12, Math.max(0, periodDates.length - 1));
  }, [periodDates]);

  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => todayIndex);

  const desktopDateStripRef = useRef<HTMLDivElement | null>(null);
  const mobileDateStripRef = useRef<HTMLDivElement | null>(null);

  const isPublished = periodRow?.status === 'published' || periodRow?.status === 'amended';
  const isDutyLoading =
    isPeriodLoading || isMembersLoading || (isPublished ? isPlannedLoading : isDraftLoading);
  const progressPercent = isPublished ? 100 : 77;

  const activeAssignments = useMemo(() => {
    const rows = isPublished ? plannedAssignments : draftAssignments;
    return rows.map((r) => ({
      staffId: r.staff_id,
      dutyDate: r.duty_date,
      shiftCode: r.shift_code,
    }));
  }, [isPublished, plannedAssignments, draftAssignments]);

  const staffNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of teamMembers) {
      map.set(m.id, (m.roster_name || m.display_name).replace(/^Dr\.?\s+/i, ''));
    }
    return map;
  }, [teamMembers]);

  const safeDayIndex = Math.max(0, Math.min(periodDates.length - 1, selectedDayIndex));
  const activeDateStr =
    periodDates[safeDayIndex] ?? `${currentPeriod.year}-${currentPeriod.month}-01`;
  const activeDayNum = parseInt(activeDateStr.slice(8, 10), 10) || 1;
  const userStaffId = user?.staffId;
  const userTargetName = (user?.rosterName || user?.displayName || '').trim().toLowerCase();

  const dayBreakdown = useMemo(() => {
    const dayItems = activeAssignments.filter((a) => a.dutyDate === activeDateStr);
    const seeded = getSeededDayInfo(activeDayNum);

    if (dayItems.length === 0) {
      if (import.meta.env.VITE_APP_ENV === 'production') {
        return {
          myShift: 'OFF',
          amNames: [] as string[],
          pmNames: [] as string[],
          onNames: [] as string[],
          epOh: '—',
          epOc: '—',
        };
      }
      return {
        myShift: seeded.myShift,
        amNames: seeded.amPool,
        pmNames: seeded.pmPool,
        onNames: seeded.ndPool,
        epOh: seeded.epOh,
        epOc: seeded.epOc,
      };
    }

    const myRow = userStaffId ? dayItems.find((a) => a.staffId === userStaffId) : undefined;
    const amNames: string[] = [];
    const pmNames: string[] = [];
    const onNames: string[] = [];
    for (const a of dayItems) {
      const { cleanShift: code } = stripShiftModifiers(a.shiftCode);
      const staffMember = teamMembers.find((s) => s.id === a.staffId);
      const sg = (staffMember?.staff_group ?? '').toLowerCase();
      if (sg.includes('non-clinical')) continue;
      const isOhClinical = sg.includes('office hour');
      const name = staffNameById.get(a.staffId) ?? `MO #${a.staffId}`;
      if (code === 'AM' || (isOhClinical && code === 'OH')) amNames.push(name);
      else if (code === 'PM') pmNames.push(name);
      else if (
        code === 'ON1' ||
        code === 'ON2' ||
        code === 'ON' ||
        code === 'ND' ||
        code === 'NIGHT'
      ) {
        onNames.push(name);
      }
    }
    const epOhRaw =
      epAssignments.find((e) => e.duty_date === activeDateStr && e.slot_type === 'EP_OFFICE_HOUR')
        ?.physician_names ?? '';
    const epOcRaw =
      epAssignments.find((e) => e.duty_date === activeDateStr && e.slot_type === 'EP_ONCALL')
        ?.physician_names ?? '';
    return {
      myShift: myRow?.shiftCode || 'OFF',
      amNames,
      pmNames,
      onNames,
      epOh: (epOhRaw || seeded.epOh).replace(/^Dr\.?\s+/i, ''),
      epOc: (epOcRaw || seeded.epOc).replace(/^Dr\.?\s+/i, ''),
    };
  }, [
    activeAssignments,
    activeDateStr,
    activeDayNum,
    userStaffId,
    teamMembers,
    staffNameById,
    epAssignments,
  ]);

  const myShiftByDate = useMemo(() => {
    const map = new Map<string, string>();
    if (userStaffId) {
      for (const a of activeAssignments) {
        if (a.staffId === userStaffId) {
          map.set(a.dutyDate, a.shiftCode);
        }
      }
    }
    for (const dateStr of periodDates) {
      if (!map.has(dateStr)) {
        if (import.meta.env.VITE_APP_ENV === 'production') {
          map.set(dateStr, 'OFF');
        } else {
          const dNum = parseInt(dateStr.slice(8, 10), 10) || 1;
          map.set(dateStr, getSeededDayInfo(dNum).myShift);
        }
      }
    }
    return map;
  }, [activeAssignments, periodDates, userStaffId]);

  const workedShiftsCount = useMemo(() => {
    let count = 0;
    for (const shift of myShiftByDate.values()) {
      const c = shift.toUpperCase();
      if (['AM', 'PM', 'ON1', 'ON2', 'ON', 'ND', 'NIGHT', 'PN', 'MEDSB', 'OH'].includes(c)) {
        count += 1;
      }
    }
    return count;
  }, [myShiftByDate]);

  const myRequestsCount = useMemo(() => {
    return requests.filter((r) => {
      const status = (r.status || '').toLowerCase();
      if (status !== 'active' && status !== 'submitted' && status !== 'approved') return false;
      const iso = toIsoDate(r.date);
      if (!iso || !iso.startsWith(upcomingMonthKey)) return false;
      if (userStaffId && r.staff_id != null && Number(r.staff_id) === Number(userStaffId)) {
        return true;
      }
      return Boolean(userTargetName && r.name && r.name.trim().toLowerCase() === userTargetName);
    }).length;
  }, [requests, upcomingMonthKey, userStaffId, userTargetName]);

  const myGhkaAvailable = useMemo(() => {
    if (!userStaffId) return 1;
    const summary = phSummaries.find((s) => s.staffId === userStaffId);
    return summary ? Math.max(0, summary.outstanding) : 1;
  }, [phSummaries, userStaffId]);

  const activeDowLabel = useMemo(() => {
    const d = new Date(`${activeDateStr}T00:00:00Z`);
    return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
  }, [activeDateStr]);

  const leadEmptyDays = useMemo(() => {
    const first = periodDates[0];
    if (!first) return 0;
    const wd = new Date(`${first}T00:00:00Z`).getUTCDay();
    return (wd + 6) % 7; // Monday = 0
  }, [periodDates]);

  const tickerItems = useMemo(() => {
    const items: Array<{ id: string; text: string; tone: 'open' | 'closed' | 'alert' | 'info' }> = [
      {
        id: 'req-win',
        text: requestWindowSummary,
        tone: deptSettings.isWindowOpen ? 'open' : 'closed',
      },
      ...updates.map((u) => ({
        id: `upd-${u.id}`,
        text: u.title,
        tone: (u.unread ? 'alert' : 'info') as 'alert' | 'info',
      })),
    ];
    return items;
  }, [requestWindowSummary, deptSettings.isWindowOpen, updates]);

  // Center selected pill inside horizontal date strip cleanly
  useEffect(() => {
    const centerSelected = (stripEl: HTMLDivElement | null) => {
      if (!stripEl) return;
      const activePill = stripEl.querySelector<HTMLElement>('[data-selected="true"]');
      if (!activePill) return;
      const stripRect = stripEl.getBoundingClientRect();
      const pillRect = activePill.getBoundingClientRect();
      if (stripRect.width > 0) {
        stripEl.scrollLeft +=
          pillRect.left - stripRect.left - stripEl.clientWidth / 2 + activePill.offsetWidth / 2;
      }
    };
    centerSelected(desktopDateStripRef.current);
    centerSelected(mobileDateStripRef.current);
  }, [safeDayIndex, mobileHomeMode]);

  const renderDateStripAndDuty = (compactMobile = false) => {
    const shiftTimeText = SHIFT_TIMES[dayBreakdown.myShift.toUpperCase()] ?? 'Scheduled';

    return (
      <div className={compactMobile ? 'home-single-view' : 'space-y-3'}>
        {/* Updates Marquee Ticker */}
        <Link
          to="/updates"
          title="View all department updates"
          className="updates-ticker flex items-center gap-2 rounded-full border border-[#EFECE6] bg-white py-1 pr-2.5 pl-1.5 shadow-[0_2px_8px_rgba(24,24,27,0.04)] transition hover:border-[#99F6E4] hover:bg-[#F0FDFA] overflow-hidden"
        >
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#18181B] px-2.5 py-0.5 text-[9.5px] font-extrabold tracking-[0.03em] text-[#FAF8F5]">
            <span>📢</span>
            <span>{unreadUpdatesCount > 0 ? `Updates (${unreadUpdatesCount})` : 'Updates'}</span>
          </span>
          <div className="updates-ticker-viewport min-w-0 flex-1 overflow-hidden">
            <div className="updates-ticker-track">
              {[0, 1].map((copyIdx) => (
                <div
                  key={copyIdx}
                  aria-hidden={copyIdx === 1}
                  className="flex shrink-0 items-center"
                >
                  {tickerItems.map((item) => (
                    <span
                      key={`${copyIdx}-${item.id}`}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap pr-6 text-[11px] font-bold text-[#18181B]"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          item.tone === 'open'
                            ? 'bg-emerald-600'
                            : item.tone === 'closed'
                              ? 'bg-amber-600'
                              : item.tone === 'alert'
                                ? 'bg-[#E06D53]'
                                : 'bg-[#0F766E]'
                        }`}
                      />
                      <span
                        className={
                          item.tone === 'open'
                            ? 'font-extrabold text-[#0F766E]'
                            : item.tone === 'closed'
                              ? 'font-extrabold text-[#B45309]'
                              : ''
                        }
                      >
                        {item.text}
                      </span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <span className="shrink-0 text-xs font-extrabold text-[#78716C]">›</span>
        </Link>

        {/* Hero Day Card */}
        <div className="hero-day-card rounded-[28px] border border-[#E7E5E4] bg-white p-4 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)] space-y-2.5">
          {/* Horizontal Scrollable 31-Day Strip */}
          <div
            ref={compactMobile ? mobileDateStripRef : desktopDateStripRef}
            className="date-strip flex gap-1.5 overflow-x-auto pb-1.5 no-scrollbar"
          >
            {periodDates.map((dateStr, idx) => {
              const dObj = new Date(`${dateStr}T00:00:00Z`);
              const dow = dObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
              const dom = parseInt(dateStr.slice(8, 10), 10);
              const isSelected = idx === safeDayIndex;
              const isTodayPill = idx === todayIndex;
              return (
                <button
                  key={dateStr}
                  type="button"
                  data-selected={isSelected ? 'true' : undefined}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`date-pill w-[45px] shrink-0 rounded-[14px] border px-1 py-1.5 text-center transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#18181B] text-white border-[#18181B] shadow-xs'
                      : 'bg-white text-[#1C1917] border-[#E7E5E4] hover:border-stone-400'
                  }`}
                >
                  <div className="dow text-[9px] font-bold">
                    {isTodayPill ? (
                      <span className="font-extrabold text-[#E06D53]">TODAY</span>
                    ) : (
                      <span className="opacity-70">{dow}</span>
                    )}
                  </div>
                  <div className="dom text-[14px] font-extrabold leading-tight">{dom}</div>
                </button>
              );
            })}
          </div>

          {/* Your Shift Banner */}
          {isDutyLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="my-shift-banner flex items-center justify-between rounded-[20px] border border-[#EFECE6] bg-[#FAF8F5] px-3.5 py-3"
            >
              <span className="sr-only">Loading today&apos;s shift...</span>
              <div className="space-y-1.5">
                <Skeleton rounded="full" className="h-2.5 w-28" />
                <Skeleton rounded="lg" className="h-5 w-40" />
              </div>
              <Skeleton rounded="full" className="h-6 w-14 shrink-0" />
            </div>
          ) : (
            <div
              className={`my-shift-banner flex items-center justify-between rounded-[20px] px-3.5 py-3 ${getShiftToneClasses(
                dayBreakdown.myShift,
              )}`}
            >
              <div>
                <div className="text-[10.5px] font-extrabold uppercase opacity-80">
                  Your Shift · {activeDowLabel} {activeDayNum} JAN
                </div>
                <div className="text-[17px] lg:text-[18px] font-extrabold mt-0.5 leading-tight">
                  {dayBreakdown.myShift} · {shiftTimeText}
                </div>
              </div>
              {safeDayIndex === todayIndex ? (
                <span className="rounded-full bg-[#18181B] px-2.5 py-1 text-[9.5px] font-extrabold tracking-[0.04em] text-white">
                  TODAY
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedDayIndex(todayIndex)}
                  className="rounded-full border border-[#E7E5E4] bg-white/90 px-2.5 py-1 text-[9.5px] font-extrabold text-[#1C1917] cursor-pointer hover:bg-white"
                >
                  Today
                </button>
              )}
            </div>
          )}

          {/* 2x2 Team On Duty Grid */}
          <div className="mini-team-grid grid grid-cols-2 gap-2">
            <div className="mini-team-box rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] px-2.5 py-2">
              <div className="lbl text-[9.5px] font-extrabold uppercase tracking-[0.04em] text-[#2D4A22] mb-1">
                AM
              </div>
              <div className="flex flex-wrap gap-1">
                {isDutyLoading ? (
                  <>
                    <Skeleton rounded="md" className="h-4 w-11" />
                    <Skeleton rounded="md" className="h-4 w-12" />
                  </>
                ) : dayBreakdown.amNames.length > 0 ? (
                  dayBreakdown.amNames.map((n) => (
                    <span
                      key={n}
                      className="rounded-[5px] border border-[#C6D8B6] bg-[#E5EED8] px-1.5 py-0.5 text-[9.5px] font-bold text-[#2D4A22]"
                    >
                      {n}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-[#A8A29E]">—</span>
                )}
              </div>
            </div>

            <div className="mini-team-box rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] px-2.5 py-2">
              <div className="lbl text-[9.5px] font-extrabold uppercase tracking-[0.04em] text-[#1E3A8A] mb-1">
                PM
              </div>
              <div className="flex flex-wrap gap-1">
                {isDutyLoading ? (
                  <>
                    <Skeleton rounded="md" className="h-4 w-11" />
                    <Skeleton rounded="md" className="h-4 w-12" />
                  </>
                ) : dayBreakdown.pmNames.length > 0 ? (
                  dayBreakdown.pmNames.map((n) => (
                    <span
                      key={n}
                      className="rounded-[5px] border border-[#B8CEF2] bg-[#DCE7F9] px-1.5 py-0.5 text-[9.5px] font-bold text-[#1E3A8A]"
                    >
                      {n}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-[#A8A29E]">—</span>
                )}
              </div>
            </div>

            <div className="mini-team-box rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] px-2.5 py-2">
              <div className="lbl text-[9.5px] font-extrabold uppercase tracking-[0.04em] text-[#9D174D] mb-1">
                Night
              </div>
              <div className="flex flex-wrap gap-1">
                {isDutyLoading ? (
                  <>
                    <Skeleton rounded="md" className="h-4 w-11" />
                    <Skeleton rounded="md" className="h-4 w-12" />
                  </>
                ) : dayBreakdown.onNames.length > 0 ? (
                  dayBreakdown.onNames.map((n) => (
                    <span
                      key={n}
                      className="rounded-[5px] border border-[#F8B9D4] bg-[#FCE7F1] px-1.5 py-0.5 text-[9.5px] font-bold text-[#9D174D]"
                    >
                      {n}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-[#A8A29E]">—</span>
                )}
              </div>
            </div>

            <div className="mini-team-box rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] px-2.5 py-2">
              <div className="lbl text-[9.5px] font-extrabold uppercase tracking-[0.04em] text-[#854D0E] mb-1">
                EP Specialist
              </div>
              <div className="flex flex-wrap gap-1">
                {isDutyLoading ? (
                  <>
                    <Skeleton rounded="md" className="h-4 w-14" />
                    <Skeleton rounded="md" className="h-4 w-14" />
                  </>
                ) : (
                  <>
                    <span className="rounded-[5px] border border-[#A7F3D0] bg-[#D1FAE5] px-1.5 py-0.5 text-[9.5px] font-bold text-[#065F46]">
                      OH: {dayBreakdown.epOh}
                    </span>
                    <span className="rounded-[5px] border border-[#FDE047] bg-[#FEF3C7] px-1.5 py-0.5 text-[9.5px] font-bold text-[#854D0E]">
                      OC: {dayBreakdown.epOc}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Month Sheet Section */}
        <div className="section-title flex items-center justify-between px-0.5 pt-0.5">
          <span className="text-[10.5px] lg:text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#A8A29E]">
            {periodLabel} · Month Sheet
          </span>
          <Link
            to={targetRosterHref}
            className="text-[10.5px] lg:text-[11px] font-extrabold uppercase text-[#0F766E] hover:underline"
          >
            Full Roster →
          </Link>
        </div>

        <div className="home-month-card rounded-[26px] border border-[#E7E5E4] bg-white p-3.5 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
          <div className="cal-grid grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-[#A8A29E] pb-1.5">
            <div className="cal-head">M</div>
            <div className="cal-head">T</div>
            <div className="cal-head">W</div>
            <div className="cal-head">T</div>
            <div className="cal-head">F</div>
            <div className="cal-head">S</div>
            <div className="cal-head">S</div>
          </div>
          <div className="cal-grid grid grid-cols-7 gap-1">
            {Array.from({ length: leadEmptyDays }).map((_, i) => (
              <div key={`lead-${i}`} />
            ))}
            {periodDates.map((dateStr, idx) => {
              const dayNum = parseInt(dateStr.slice(8, 10), 10);
              const shift = myShiftByDate.get(dateStr) || 'OFF';
              const isSelected = idx === safeDayIndex;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`cal-day min-h-[52px] flex flex-col items-stretch justify-between gap-0.5 rounded-[12px] border p-1 transition cursor-pointer ${
                    isSelected
                      ? 'border-[#E06D53] bg-[#FFF7F5] ring-2 ring-[#E06D53]/25'
                      : 'border-[#EFECE6] bg-[#FAF8F5] hover:border-stone-300'
                  }`}
                >
                  <span className="num text-[10.5px] font-extrabold text-[#1C1917] text-center leading-tight">
                    {dayNum}
                  </span>
                  {isDutyLoading ? (
                    <Skeleton rounded="md" className="cal-mini-pill h-3.5 w-full" />
                  ) : (
                    <span
                      className={`cal-mini-pill rounded-[5px] py-0.5 text-center text-[7.5px] font-extrabold leading-tight ${getShiftToneClasses(
                        shift,
                      )}`}
                    >
                      {shift}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom 3 Quick Stat Cards */}
        <div className="grid grid-cols-3 gap-2 lg:gap-2.5">
          <Link
            to={targetRosterHref}
            className="rounded-[16px] lg:rounded-[18px] border border-[#EFECE6] bg-white p-2 lg:p-2.5 shadow-[0_3px_10px_rgba(28,25,23,0.04)] hover:border-teal-300 transition"
          >
            <div className="text-[8.5px] lg:text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#78716C]">
              Jan Shifts
            </div>
            <div className="mt-0.5 text-[15px] lg:text-[17px] font-extrabold text-[#18181B] tabular-nums">
              {workedShiftsCount}{' '}
              <span className="text-[9.5px] lg:text-[10px] font-bold text-[#0F766E]">Worked</span>
            </div>
          </Link>

          <Link
            to="/requests"
            className="rounded-[16px] lg:rounded-[18px] border border-[#EFECE6] bg-white p-2 lg:p-2.5 shadow-[0_3px_10px_rgba(28,25,23,0.04)] hover:border-teal-300 transition"
          >
            <div className="text-[8.5px] lg:text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#78716C]">
              Requests
            </div>
            <div className="mt-0.5 text-[15px] lg:text-[17px] font-extrabold text-[#18181B] tabular-nums">
              {myRequestsCount}
              <span className="text-[10px] lg:text-[11px] font-bold text-[#78716C]">
                /{requestMonthlyLimit}
              </span>
            </div>
          </Link>

          <Link
            to="/records"
            className="rounded-[16px] lg:rounded-[18px] border border-[#EFECE6] bg-white p-2 lg:p-2.5 shadow-[0_3px_10px_rgba(28,25,23,0.04)] hover:border-teal-300 transition"
          >
            <div className="text-[8.5px] lg:text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#78716C]">
              GHKA
            </div>
            <div className="mt-0.5 text-[15px] lg:text-[17px] font-extrabold text-[#0F766E] tabular-nums">
              {myGhkaAvailable}{' '}
              <span className="text-[9.5px] lg:text-[10px] font-bold text-[#78716C]">Avail</span>
            </div>
          </Link>
        </div>
      </div>
    );
  };

  const renderAdminPulseColumn = () => (
    <div className="space-y-3">
      {/* Progress Arc Card — no overlapping "Overall progress" label inside Owner card */}
      <div className="rounded-[26px] border border-[#E7E5E4] bg-white p-4 text-center shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
        <SegmentedArcGauge
          value={progressPercent}
          title={`${progressPercent}%`}
          subtitle={`${shortPeriodLabel} · ${isPublished ? 'Published' : 'Planning Mode'}`}
          palette="rainbow"
          size="md"
          className="mx-auto w-full"
        />
        <div className="mt-2 flex items-center justify-center gap-2">
          <Link
            to={targetRosterHref}
            className="rounded-full bg-[#18181B] px-3.5 py-1.5 text-xs font-extrabold text-white shadow-2xs hover:bg-stone-800"
          >
            Edit Timetable
          </Link>
          <Link
            to={`${targetRosterHref}?action=export`}
            className="rounded-full border border-[#E7E5E4] bg-white px-3.5 py-1.5 text-xs font-bold text-[#57534E] hover:bg-[#FAF8F5]"
          >
            📄 PDF / Archive
          </Link>
        </div>
      </div>

      {/* Rules Engine Warnings Banner */}
      <Link
        to={`${targetRosterHref}#rules-guidance`}
        className="flex items-center justify-between gap-2.5 rounded-[20px] border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-3 shadow-2xs hover:bg-amber-50/80 transition"
      >
        <div>
          <div className="text-[12.5px] font-extrabold text-[#92400E]">2 Rules Engine Warnings</div>
          <div className="text-[11px] font-semibold text-[#B45309]">
            Dr. Wong &amp; Dr. Tan weekly OFF policy
          </div>
        </div>
        <span className="shrink-0 text-xs font-extrabold text-[#92400E]">Review →</span>
      </Link>

      {/* Shift Coverage 2x2 Bento */}
      <div className="flex items-center justify-between px-0.5 pt-0.5">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#A8A29E]">
          Shift Coverage
        </span>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#A8A29E]">
          {shortPeriodLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex min-h-[86px] flex-col justify-between rounded-[22px] border border-[#C6D8B6] bg-[#E5EED8] p-3.5 text-[#2D4A22]">
          <div className="text-[11px] font-extrabold">Morning AM</div>
          <div className="text-[23px] font-extrabold tracking-tight leading-none">75%</div>
          <div className="text-[10px] font-semibold opacity-85">4/4 MOs Daily</div>
        </div>
        <div className="flex min-h-[86px] flex-col justify-between rounded-[22px] border border-[#B8CEF2] bg-[#DCE7F9] p-3.5 text-[#1E3A8A]">
          <div className="text-[11px] font-extrabold">Evening PM</div>
          <div className="text-[23px] font-extrabold tracking-tight leading-none">55%</div>
          <div className="text-[10px] font-semibold opacity-85">Needs 2 MOs</div>
        </div>
        <div className="flex min-h-[86px] flex-col justify-between rounded-[22px] border border-[#F8B9D4] bg-[#FCE7F1] p-3.5 text-[#9D174D]">
          <div className="text-[11px] font-extrabold">Night ND</div>
          <div className="text-[23px] font-extrabold tracking-tight leading-none">87%</div>
          <div className="text-[10px] font-semibold opacity-85">2–3 MOs Nightly</div>
        </div>
        <div className="flex min-h-[86px] flex-col justify-between rounded-[22px] border border-[#FDE047] bg-[#FEF3C7] p-3.5 text-[#854D0E]">
          <div className="text-[11px] font-extrabold">On-Call ON</div>
          <div className="text-[23px] font-extrabold tracking-tight leading-none">92%</div>
          <div className="text-[10px] font-semibold opacity-85">EP + MO Covered</div>
        </div>
      </div>

      {/* Owner Quick Actions */}
      <div className="px-0.5 pt-0.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#A8A29E]">
        Owner Quick Actions
      </div>
      <div className="space-y-2">
        <Link
          to={`${targetRosterHref}?action=archive`}
          className="flex items-center justify-between gap-3 rounded-[20px] border border-[#E7E5E4] bg-white px-3.5 py-3 shadow-[0_3px_12px_-4px_rgba(28,25,23,0.05)] hover:border-teal-300 transition"
        >
          <div>
            <div className="text-[13px] font-extrabold text-[#18181B]">
              Archive &amp; Send to Telegram
            </div>
            <div className="text-[11px] font-semibold text-[#78716C]">
              Current Revision v{periodRow?.revision ?? 3} · Unarchived Delta
            </div>
          </div>
          <span className="shrink-0 text-xs font-extrabold text-[#0F766E]">Dispatch →</span>
        </Link>

        <Link
          to={`${targetRosterHref}?action=close`}
          className="flex items-center justify-between gap-3 rounded-[20px] border border-[#E7E5E4] bg-white px-3.5 py-3 shadow-[0_3px_12px_-4px_rgba(28,25,23,0.05)] hover:border-teal-300 transition"
        >
          <div>
            <div className="text-[13px] font-extrabold text-[#18181B]">
              Close &amp; Reconcile Period
            </div>
            <div className="text-[11px] font-semibold text-[#78716C]">
              2 pending GOFF accruals detected
            </div>
          </div>
          <span className="shrink-0 text-xs font-extrabold text-[#0F766E]">Open →</span>
        </Link>
      </div>
    </div>
  );

  const renderStaffSummaryColumn = () => (
    <div className="rounded-[26px] border border-[#E7E5E4] bg-white p-4 text-center shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
      <div className="mb-1.5 text-left text-xs font-extrabold text-[#18181B]">Overall Progress</div>
      <SegmentedArcGauge
        value={progressPercent}
        title={`${progressPercent}%`}
        subtitle={`${shortPeriodLabel} · ${isPublished ? 'Published' : 'Planning'}`}
        palette="rainbow"
        size="md"
        className="mx-auto w-full"
      />
      <div className="mt-2.5 border-t border-[#F4EFE6] pt-3 text-left">
        <div className="mb-2 text-[11px] font-extrabold text-[#18181B]">Shift Coverage</div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex min-h-[66px] flex-col justify-between rounded-[22px] border border-[#C6D8B6] bg-[#E5EED8] p-3 text-[#2D4A22]">
            <div className="text-[10.5px] font-extrabold">AM · 08–16</div>
            <div className="text-[18px] font-extrabold leading-none">75%</div>
          </div>
          <div className="flex min-h-[66px] flex-col justify-between rounded-[22px] border border-[#B8CEF2] bg-[#DCE7F9] p-3 text-[#1E3A8A]">
            <div className="text-[10.5px] font-extrabold">PM · 16–23</div>
            <div className="text-[18px] font-extrabold leading-none">55%</div>
          </div>
          <div className="flex min-h-[66px] flex-col justify-between rounded-[22px] border border-[#F8B9D4] bg-[#FCE7F1] p-3 text-[#9D174D]">
            <div className="text-[10.5px] font-extrabold">ON1/2 · 23–08</div>
            <div className="text-[18px] font-extrabold leading-none">87%</div>
          </div>
          <div className="flex min-h-[66px] flex-col justify-between rounded-[22px] border border-[#FDE047] bg-[#FEF3C7] p-3 text-[#854D0E]">
            <div className="text-[10.5px] font-extrabold">EP Specialist</div>
            <div className="text-[12px] font-extrabold leading-tight truncate">
              Dr. {dayBreakdown.epOh}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Desktop Header Bar */}
      <div className="sr-only lg:not-sr-only lg:flex flex-wrap items-center justify-between gap-4 border-b border-[#E7E5E4] pb-3.5">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#0F766E]">
            Emergency Department Workforce
          </div>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#18181B]">
            Operations Overview
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[#57534E]">
            Good morning, Doctor 👋 — Department shift planning &amp; daily duty overview
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={targetRosterHref}
            className="inline-flex items-center rounded-full bg-[#18181B] px-4 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-stone-800 transition cursor-pointer"
          >
            Enter Timetable
          </Link>
          <Link to={targetRosterHref} className="sr-only">
            Open {shortPeriodLabel} Roster Shell
          </Link>
        </div>
      </div>

      {/* Mobile Home: Option A (My Duty | Admin Pulse for Owners, single-screen duty for MO) */}
      <div className="lg:hidden space-y-2.5">
        {isOwner ? (
          <div className="relative grid grid-cols-2 rounded-full bg-[#EAE4DA] p-[3px] select-none">
            <div
              className={`absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-[#18181B] shadow-[0_3px_10px_rgba(0,0,0,0.16)] transition-transform duration-200 ${
                mobileHomeMode === 'admin' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            <button
              type="button"
              onClick={() => setMobileHomeMode('duty')}
              className={`relative z-10 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                mobileHomeMode === 'duty' ? 'text-white' : 'text-[#57534E]'
              }`}
            >
              My Duty
            </button>
            <button
              type="button"
              onClick={() => setMobileHomeMode('admin')}
              className={`relative z-10 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                mobileHomeMode === 'admin' ? 'text-white' : 'text-[#57534E]'
              }`}
            >
              Admin Pulse
            </button>
          </div>
        ) : null}

        {isOwner && mobileHomeMode === 'admin'
          ? renderAdminPulseColumn()
          : renderDateStripAndDuty(true)}
      </div>

      {/* Desktop Home: 7/5 Split Bento */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 min-w-0">{renderDateStripAndDuty(false)}</div>
        <div className="lg:col-span-5 min-w-0">
          {isOwner ? renderAdminPulseColumn() : renderStaffSummaryColumn()}
        </div>
      </div>
    </div>
  );
}
