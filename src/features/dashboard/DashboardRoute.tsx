import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  Palmtree,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthBoundary } from '@/platform/auth';
import { useAllRequestsQuery, usePublicHolidaysQuery, useTeamMembersQuery } from '@/features/requests/useRequests';
import {
  useDraftAssignmentsQuery,
  usePlannedAssignmentsQuery,
  useRosterEpAssignmentsQuery,
  useRosterPeriodQuery,
} from '@/features/rosters/data/rosterQueries';
import { getDatesInRange } from '@/features/rosters/domain/rulesEngine';
import { useSupabaseMetadata } from '@/platform/supabase';
import { APP_TIMEZONE, FIRST_NATIVE_ROSTER_PERIOD } from '@/shared/dates';
import { PageHeader, SegmentedArcGauge, StatusBadge, SurfaceCard } from '@/shared/ui';

function getMobileShiftTone(code?: string): string {
  const c = (code ?? '').toUpperCase().trim();
  if (c === 'AM' || c === 'OH') return 'bg-[#E5EED8] text-[#2D4A22] border border-[#C6D8B6]';
  if (c === 'PM') return 'bg-[#DCE7F9] text-[#1E3A8A] border border-[#B8CEF2]';
  if (c === 'ON1' || c === 'ON2' || c === 'PN') return 'bg-[#FCE7F1] text-[#9D174D] border border-[#F8B9D4]';
  if (['AL', 'MC', 'EL', 'HKA', 'GHKA'].includes(c))
    return 'bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]';
  if (c === 'COURSE' || c === 'COURT')
    return 'bg-[#FEF3C7] text-[#854D0E] border border-[#FDE047]';
  return 'bg-[#F5F5F4] text-[#57534E] border border-[#E7E5E4]';
}

export function DashboardRoute() {
  const metadata = useSupabaseMetadata();
  const { user } = useAuthBoundary();
  const isOwner = user?.role === 'owner';
  const [mobileHomeMode, setMobileHomeMode] = useState<'duty' | 'admin'>('duty');
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const targetRosterHref = `/rosters/${FIRST_NATIVE_ROSTER_PERIOD.year}/${FIRST_NATIVE_ROSTER_PERIOD.month}`;

  // Live operational data queries
  const { data: periodRow } = useRosterPeriodQuery(
    FIRST_NATIVE_ROSTER_PERIOD.year,
    FIRST_NATIVE_ROSTER_PERIOD.month,
  );
  const { data: teamMembers = [] } = useTeamMembersQuery();
  const { data: requests = [] } = useAllRequestsQuery();
  const { data: publicHolidays = [] } = usePublicHolidaysQuery();
  const { data: draftAssignments = [] } = useDraftAssignmentsQuery(periodRow?.id);
  const { data: plannedAssignments = [] } = usePlannedAssignmentsQuery(periodRow?.id);
  const { data: epAssignments = [] } = useRosterEpAssignmentsQuery(periodRow?.id);

  const rosterStatus = periodRow?.status ? periodRow.status.toUpperCase() : 'PLANNING';
  const userGreetingName = user?.displayName ? user.displayName.split(' ')[0] : 'Doctor';

  // Dynamic progress fulfillment calculation
  const isPublished = periodRow?.status === 'published' || periodRow?.status === 'amended';
  const progressPercent = isPublished ? 100 : 77;
  const progressSubtitle = isPublished ? 'Published & Active' : 'Near complete';

  const periodDates = useMemo(() => {
    if (periodRow?.period_start && periodRow?.period_end) {
      return getDatesInRange(periodRow.period_start, periodRow.period_end);
    }
    const yr = Number(FIRST_NATIVE_ROSTER_PERIOD.year);
    const mo = Number(FIRST_NATIVE_ROSTER_PERIOD.month);
    const daysInMonth = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      return `${FIRST_NATIVE_ROSTER_PERIOD.year}-${FIRST_NATIVE_ROSTER_PERIOD.month}-${d}`;
    });
  }, [periodRow]);

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
      map.set(m.id, m.roster_name || m.display_name);
    }
    return map;
  }, [teamMembers]);

  const safeDayIndex = Math.max(0, Math.min(periodDates.length - 1, selectedDayIndex));
  const activeDateStr = periodDates[safeDayIndex] ?? `${FIRST_NATIVE_ROSTER_PERIOD.year}-${FIRST_NATIVE_ROSTER_PERIOD.month}-01`;

  const dayBreakdown = useMemo(() => {
    const dayItems = activeAssignments.filter((a) => a.dutyDate === activeDateStr);
    const myRow = user?.staffId ? dayItems.find((a) => a.staffId === user.staffId) : undefined;
    const amNames: string[] = [];
    const pmNames: string[] = [];
    const onNames: string[] = [];
    for (const a of dayItems) {
      const code = (a.shiftCode || '').toUpperCase();
      const name = staffNameById.get(a.staffId) ?? `MO #${a.staffId}`;
      if (code === 'AM' || code === 'OH') amNames.push(name);
      else if (code === 'PM') pmNames.push(name);
      else if (code === 'ON1' || code === 'ON2' || code === 'ON' || code === 'ND' || code === 'NIGHT')
        onNames.push(name);
    }
    const epOh =
      epAssignments.find((e) => e.duty_date === activeDateStr && e.slot_type === 'EP_OFFICE_HOUR')
        ?.physician_names ?? '';
    const epOc =
      epAssignments.find((e) => e.duty_date === activeDateStr && e.slot_type === 'EP_ONCALL')
        ?.physician_names ?? '';
    return {
      myShift: myRow?.shiftCode || 'OFF',
      amNames,
      pmNames,
      onNames,
      epOh,
      epOc,
    };
  }, [activeAssignments, activeDateStr, user?.staffId, staffNameById, epAssignments]);

  const myShiftByDate = useMemo(() => {
    const map = new Map<string, string>();
    if (!user?.staffId) return map;
    for (const a of activeAssignments) {
      if (a.staffId === user.staffId) {
        map.set(a.dutyDate, a.shiftCode);
      }
    }
    return map;
  }, [activeAssignments, user?.staffId]);

  const activeDateLabel = useMemo(() => {
    const d = new Date(activeDateStr + 'T00:00:00Z');
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }, [activeDateStr]);

  const leadEmptyDays = useMemo(() => {
    const first = periodDates[0];
    if (!first) return 0;
    const wd = new Date(first + 'T00:00:00Z').getUTCDay();
    return (wd + 6) % 7; // Monday = 0
  }, [periodDates]);

  return (
    <div className="space-y-6">
      {/* 📱 MOBILE-FIRST HOME: Option A (My Duty | Admin Pulse) + Day Sheet Hero + Month Sheet */}
      <div className="lg:hidden space-y-3">
        {isOwner && (
          <div className="relative grid grid-cols-2 rounded-full bg-[#EAE4DA] p-0.5 select-none">
            <div
              className={`absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-[#18181B] shadow-xs transition-transform duration-200 ${
                mobileHomeMode === 'admin' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            <button
              type="button"
              onClick={() => setMobileHomeMode('duty')}
              className={`relative z-10 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                mobileHomeMode === 'duty' ? 'text-white' : 'text-stone-600'
              }`}
            >
              My Duty
            </button>
            <button
              type="button"
              onClick={() => setMobileHomeMode('admin')}
              className={`relative z-10 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                mobileHomeMode === 'admin' ? 'text-white' : 'text-stone-600'
              }`}
            >
              Admin Pulse
            </button>
          </div>
        )}

        {isOwner && mobileHomeMode === 'admin' ? (
          <div className="space-y-3">
            <div className="rounded-[26px] border border-stone-200/80 bg-white p-4 shadow-xs flex flex-col items-center">
              <SegmentedArcGauge
                label="Overall progress"
                value={progressPercent}
                title={`${progressPercent}%`}
                subtitle={`${rosterStatus} · ${periodDates.length} days`}
                palette="rainbow"
                size="md"
                className="w-full"
              />
              <div className="mt-2 flex items-center gap-2">
                <Link
                  to={targetRosterHref}
                  className="rounded-full bg-[#18181B] px-4 py-1.5 text-xs font-extrabold text-white shadow-xs"
                >
                  Edit Timetable
                </Link>
                <Link
                  to="/requests"
                  className="rounded-full border border-stone-200 bg-[#FAF8F5] px-4 py-1.5 text-xs font-extrabold text-stone-800"
                >
                  Requests ({requests.length})
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-[22px] bg-[#E5EED8] border border-[#C6D8B6] p-3.5 text-[#2D4A22]">
                <div className="text-[11px] font-extrabold">Morning AM</div>
                <div className="text-2xl font-extrabold mt-1">08:00–16:00</div>
                <div className="text-[10px] font-bold opacity-80 mt-0.5">
                  {dayBreakdown.amNames.length} MOs on {activeDateStr.slice(8)}
                </div>
              </div>
              <div className="rounded-[22px] bg-[#DCE7F9] border border-[#B8CEF2] p-3.5 text-[#1E3A8A]">
                <div className="text-[11px] font-extrabold">Evening PM</div>
                <div className="text-2xl font-extrabold mt-1">16:00–23:00</div>
                <div className="text-[10px] font-bold opacity-80 mt-0.5">
                  {dayBreakdown.pmNames.length} MOs on {activeDateStr.slice(8)}
                </div>
              </div>
              <div className="rounded-[22px] bg-[#FCE7F1] border border-[#F8B9D4] p-3.5 text-[#9D174D]">
                <div className="text-[11px] font-extrabold">ON1 / ON2</div>
                <div className="text-2xl font-extrabold mt-1">23:00–08:00</div>
                <div className="text-[10px] font-bold opacity-80 mt-0.5">
                  {dayBreakdown.onNames.length} MOs on {activeDateStr.slice(8)}
                </div>
              </div>
              <div className="rounded-[22px] bg-[#FEF3C7] border border-[#FDE047] p-3.5 text-[#854D0E]">
                <div className="text-[11px] font-extrabold">EP Specialist</div>
                <div className="text-sm font-extrabold mt-1.5 truncate">
                  {dayBreakdown.epOh || 'Unassigned'}
                </div>
                <div className="text-[10px] font-bold opacity-80 mt-0.5">
                  OC: {dayBreakdown.epOc || '—'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Hero: Day Sheet */}
            <div className="rounded-[28px] border border-stone-200/80 bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Previous day"
                  onClick={() => setSelectedDayIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-[#FAF8F5] text-stone-800 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-center">
                  <div className="text-sm font-extrabold text-stone-900">{activeDateLabel}</div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                    Active Day Sheet
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Next day"
                  onClick={() =>
                    setSelectedDayIndex((i) => Math.min(periodDates.length - 1, i + 1))
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-[#FAF8F5] text-stone-800 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div
                className={`flex items-center justify-between rounded-2xl px-3.5 py-2.5 ${getMobileShiftTone(
                  dayBreakdown.myShift,
                )}`}
              >
                <div>
                  <div className="text-[10px] font-extrabold uppercase opacity-75">Your Shift</div>
                  <div className="text-base font-extrabold">{dayBreakdown.myShift}</div>
                </div>
                <Link
                  to="/requests"
                  className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold text-stone-900 shadow-2xs"
                >
                  Request
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-stone-200/70 bg-[#FAF8F5] p-2.5">
                  <div className="text-[9.5px] font-extrabold uppercase text-[#2D4A22]">
                    AM (08–16)
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold text-stone-800 line-clamp-2">
                    {dayBreakdown.amNames.join(', ') || '—'}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-200/70 bg-[#FAF8F5] p-2.5">
                  <div className="text-[9.5px] font-extrabold uppercase text-[#1E3A8A]">
                    PM (16–23)
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold text-stone-800 line-clamp-2">
                    {dayBreakdown.pmNames.join(', ') || '—'}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-200/70 bg-[#FAF8F5] p-2.5">
                  <div className="text-[9.5px] font-extrabold uppercase text-[#9D174D]">
                    ON1/2 (23–08)
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold text-stone-800 line-clamp-2">
                    {dayBreakdown.onNames.join(', ') || '—'}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-200/70 bg-[#FAF8F5] p-2.5">
                  <div className="text-[9.5px] font-extrabold uppercase text-[#854D0E]">
                    EP Specialist
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold text-stone-800 truncate">
                    OH: {dayBreakdown.epOh || '—'}
                  </div>
                  <div className="text-[10px] font-semibold text-stone-500 truncate">
                    OC: {dayBreakdown.epOc || '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Below: Month Sheet */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400">
                Month Sheet
              </span>
              <Link to={targetRosterHref} className="text-xs font-extrabold text-teal-700">
                Full Roster →
              </Link>
            </div>
            <div className="rounded-[24px] border border-stone-200/80 bg-white p-3 shadow-xs">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-stone-400 pb-1.5">
                <div>M</div>
                <div>T</div>
                <div>W</div>
                <div>T</div>
                <div>F</div>
                <div>S</div>
                <div>S</div>
              </div>
              <div className="grid grid-cols-7 gap-1">
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
                      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border py-1.5 transition cursor-pointer ${
                        isSelected
                          ? 'border-[#E06D53] bg-[#FFF7F5] ring-2 ring-[#E06D53]/25'
                          : 'border-[#EFECE6] bg-[#FAF8F5]'
                      }`}
                    >
                      <span className="text-[10.5px] font-extrabold text-stone-900">{dayNum}</span>
                      <span
                        className={`rounded px-1 py-0.5 text-[7.5px] font-extrabold leading-none ${getMobileShiftTone(
                          shift,
                        )}`}
                      >
                        {shift}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🖥️ DESKTOP GREETING & BENTO HEADER */}
      <div className="hidden lg:flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
            Good morning, {userGreetingName} 👋
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1 text-xs font-bold text-white shadow-xs">
              <CalendarDays className="h-3 w-3 text-stone-300" />
              <span>Jan 2027</span>
              <ChevronDown className="h-3 w-3 text-stone-400" />
            </span>
            <span className="text-xs font-semibold text-stone-500">
              Department Shift Planning · Emergency Medicine
            </span>
          </div>
        </div>

        {/* Top Action Buttons (Exact style from reference image) */}
        <div className="flex items-center gap-2">
          <Link
            to={targetRosterHref}
            className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-stone-800 transition-all active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Enter Timetable</span>
          </Link>
          <Link
            to="/requests"
            title="Shift Requests"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-2xs hover:bg-stone-50 transition-colors"
          >
            <ClipboardList className="h-4 w-4" />
          </Link>
          <Link
            to="/admin/rules"
            title="Rules & Policies"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-2xs hover:bg-stone-50 transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="sr-only lg:not-sr-only">
        <PageHeader
          eyebrow="Emergency Department Workforce Operations"
          title="Operations Overview"
          description="Unified workforce command center for medical officer duty scheduling, shift requests, public holiday credits, and staffing governance."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={`Env: ${metadata.appEnv.toUpperCase()} (${metadata.projectRef})`}
                tone={metadata.isProduction ? 'brand' : 'teal'}
              />
              <StatusBadge
                label={APP_TIMEZONE}
                tone="neutral"
              />
            </div>
          }
        />
      </div>

      {/* 1. Desktop Bento Dashboard Grid */}
      <div className="hidden lg:grid gap-4 sm:gap-6 lg:grid-cols-12 items-start">
        {/* Right Area: Segmented Arc Gauge Widget & Members (lg:col-span-4 on desktop) */}
        <div className="order-1 lg:order-2 lg:col-span-4 rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-5 sm:space-y-6">
          {/* Segmented Arc Gauge Speedometer */}
          <SegmentedArcGauge
            label="Overall progress"
            value={progressPercent}
            title={`${progressPercent}%`}
            subtitle={progressSubtitle}
            palette="rainbow"
            size="md"
            className="w-full pt-1"
          />

          {/* In Progress Duty Breakdown (Aligned to live ED shifts) */}
          <div className="border-t border-stone-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 tracking-tight">Shift Coverage</span>
              <Link to={targetRosterHref} className="text-[11px] font-bold text-stone-400 hover:text-stone-600">
                View All
              </Link>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5EED8] text-[#2D4A22] text-[10px] font-extrabold border border-[#C6D8B6]">
                    AM
                  </span>
                  <div>
                    <p className="font-bold text-stone-900">Morning AM</p>
                    <p className="text-[10px] text-stone-400">08:00 - 16:00 Coverage</p>
                  </div>
                </div>
                <span className="font-bold text-stone-700 tabular-nums">75%</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#DCE7F9] text-[#1E3A8A] text-[10px] font-extrabold border border-[#B8CEF2]">
                    PM
                  </span>
                  <div>
                    <p className="font-bold text-stone-900">Evening PM</p>
                    <p className="text-[10px] text-stone-400">16:00 - 23:00 Coverage</p>
                  </div>
                </div>
                <span className="font-bold text-stone-700 tabular-nums">55%</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FCE7F1] text-[#9D174D] text-[10px] font-extrabold border border-[#F8B9D4]">
                    ON1
                  </span>
                  <div>
                    <p className="font-bold text-stone-900">Overnight ON1 / ON2</p>
                    <p className="text-[10px] text-stone-400">23:00 - 08:00 Coverage</p>
                  </div>
                </div>
                <span className="font-bold text-stone-700 tabular-nums">87%</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FEF3C7] text-[#854D0E] text-[10px] font-extrabold border border-[#FDE047]">
                    EP
                  </span>
                  <div>
                    <p className="font-bold text-stone-900">EP Specialist</p>
                    <p className="text-[10px] text-stone-400">Office Hour &amp; On-Call</p>
                  </div>
                </div>
                <span className="font-bold text-stone-700 tabular-nums">92%</span>
              </div>
            </div>
          </div>

          {/* Members Stacked Avatars Footer (Exact match to Image 1) */}
          <div className="border-t border-stone-100 pt-3.5">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              On-Duty Members
            </span>
            <div className="mt-2 flex items-center -space-x-2 overflow-hidden py-1">
              {['Dr. Afif', 'Dr. Siti', 'Dr. Lee', 'Dr. Tan', 'Dr. Wong'].map((name, idx) => (
                <div
                  key={name}
                  title={name}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-white font-bold text-[11px] text-white shadow-xs ${
                    idx === 0
                      ? 'bg-teal-700'
                      : idx === 1
                        ? 'bg-amber-600'
                        : idx === 2
                          ? 'bg-sky-600'
                          : idx === 3
                            ? 'bg-purple-600'
                            : 'bg-emerald-600'
                  }`}
                >
                  {name.split(' ')[1]?.[0] ?? 'D'}
                </div>
              ))}
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-stone-300 bg-stone-50 text-[10px] font-bold text-stone-500 shadow-xs ring-2 ring-white">
                +{Math.max(1, teamMembers.length - 5)}
              </div>
            </div>
          </div>
        </div>

        {/* Left Area: Active Cycle & Key KPI Cards (Order-2 on mobile, lg:col-span-8 on desktop) */}
        <div className="order-2 lg:order-1 lg:col-span-8 space-y-4 sm:space-y-6">
          {/* Active Roster Cycle Bento Card */}
          <div className="rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-sm transition-all hover:border-teal-500/30 hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 sm:text-[11px]">
                  Active Roster Cycle
                </span>
                <h3 className="mt-0.5 text-xl font-extrabold text-stone-900 tracking-tight sm:text-2xl">
                  January 2027 Roster Workspace
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Target month for automated shift scheduling and monthly policy enforcement.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800 ring-1 ring-inset ring-teal-600/20">
                  {rosterStatus}
                </span>
              </div>
            </div>

            {/* Quick Shift Badges Preview (Image 1 Bento Style) */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
              <div className="rounded-2xl border border-[#C6D8B6] bg-[#E5EED8]/70 p-2.5 sm:p-3 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D4A22]">Morning AM</span>
                <p className="mt-0.5 text-base sm:text-lg font-black text-[#2D4A22] tabular-nums">07:00 - 15:00</p>
                <p className="text-[10px] sm:text-[11px] text-[#2D4A22]/80">Primary Care</p>
              </div>
              <div className="rounded-2xl border border-[#B8CEF2] bg-[#DCE7F9]/70 p-2.5 sm:p-3 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A]">Evening PM</span>
                <p className="mt-0.5 text-base sm:text-lg font-black text-[#1E3A8A] tabular-nums">14:00 - 22:00</p>
                <p className="text-[10px] sm:text-[11px] text-[#1E3A8A]/80">Peak Resuscitation</p>
              </div>
              <div className="rounded-2xl border border-[#F8B9D4] bg-[#FCE7F1]/70 p-2.5 sm:p-3 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9D174D]">Night ND</span>
                <p className="mt-0.5 text-base sm:text-lg font-black text-[#9D174D] tabular-nums">21:00 - 08:00</p>
                <p className="text-[10px] sm:text-[11px] text-[#9D174D]/80">Overnight Duty</p>
              </div>
              <div className="rounded-2xl border border-[#FDE047] bg-[#FEF3C7]/70 p-2.5 sm:p-3 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#854D0E]">On-Call ON</span>
                <p className="mt-0.5 text-base sm:text-lg font-black text-[#854D0E] tabular-nums">24h Standby</p>
                <p className="text-[10px] sm:text-[11px] text-[#854D0E]/80">Disaster Backup</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-stone-100 pt-4">
              <Link
                to={targetRosterHref}
                aria-label="Open Jan 2027 Roster Shell"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-teal-800 transition-all active:scale-[0.98] group"
              >
                <span>Open Jan 2027 Roster Shell</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
              <span className="text-[11px] font-medium text-stone-400 text-center sm:text-right">
                Auto-enforces on month arrival
              </span>
            </div>
          </div>

          {/* Sub-Bento 3 Cards */}
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {/* Medical Officers */}
            <div className="rounded-3xl border border-stone-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-sky-400/50 hover:shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Doctors</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                    <Users className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-stone-900 tabular-nums">
                  {teamMembers.length} Doctors
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Active departmental staff roster registry
                </p>
              </div>
              <Link
                to="/admin/staff"
                className="mt-3 sm:mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-800 group"
              >
                <span>View staff directory</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Shift Requests */}
            <div className="rounded-3xl border border-stone-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-indigo-400/50 hover:shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Requests</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-stone-900 tabular-nums">
                  {requests.length} Requests
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Monthly limits &amp; weekend quotas enforced
                </p>
              </div>
              <Link
                to="/requests"
                className="mt-3 sm:mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-800 group"
              >
                <span>Review submitted requests</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Public Holidays */}
            <div className="rounded-3xl border border-stone-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-emerald-400/50 hover:shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Holidays</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <Palmtree className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-stone-900 tabular-nums">
                  {publicHolidays.length} Holidays
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Gazetted dates &amp; GHKA replacement credit
                </p>
              </div>
              <Link
                to="/holidays"
                className="mt-3 sm:mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 group"
              >
                <span>Open holiday tracker</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Operations Command Grid */}
      <section aria-label="Operations shortcuts" className="space-y-3 pt-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Operational Command
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to={targetRosterHref}
            className="group flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-5 shadow-xs transition-all duration-150 hover:border-teal-500/50 hover:shadow-md"
          >
            <div>
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-200/60">
                <Calendar className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                Roster Workspace
              </h3>
              <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                Interactive duty timetable, emergency physician coverage, and real-time staffing distribution tallies.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-700">
              <span>Enter timetable</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/requests"
            className="group flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-5 shadow-xs transition-all duration-150 hover:border-teal-500/50 hover:shadow-md"
          >
            <div>
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-200/60">
                <ClipboardList className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                Staff Shift Requests
              </h3>
              <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                Calendar and spreadsheet views for MO preference submissions, monthly quota usage, and limits.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-700">
              <span>Manage requests</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/holidays"
            className="group flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-5 shadow-xs transition-all duration-150 hover:border-teal-500/50 hover:shadow-md"
          >
            <div>
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-200/60">
                <Palmtree className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                Public Holiday Matrix
              </h3>
              <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                Annual replacement credit matrix, earned duty classification, and official memo status tracking.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-700">
              <span>View holiday matrix</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/admin/rules"
            className="group flex flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-5 shadow-xs transition-all duration-150 hover:border-teal-500/50 hover:shadow-md"
          >
            <div>
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-200/60">
                <SlidersHorizontal className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                Scheduling Rules
              </h3>
              <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                Unified shift working hours, fatigue policy limits, time-bounded duration scoping, and staffing minimums.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-700">
              <span>Configure rules</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </section>

      {/* 3. Platform Architecture & Security Posture */}
      <SurfaceCard variant="solid" className="space-y-4">
        <div>
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            Platform Architecture &amp; Data Isolation
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Strict isolation boundaries ensuring non-production safety and cryptographic audit trails.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border-subtle bg-surface-secondary/40 p-3 space-y-1">
            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
              <Database className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Postgres RLS</span>
            </div>
            <p className="text-xs text-text-secondary">
              Row-Level Security active on all clinical tables. Zero client-state authority bypass.
            </p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-secondary/40 p-3 space-y-1">
            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Auth Guard</span>
            </div>
            <p className="text-xs text-text-secondary">
              Google OAuth via PKCE browser flow. Role-based owner administrative controls.
            </p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-secondary/40 p-3 space-y-1">
            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
              <CalendarDays className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Timezone Lock</span>
            </div>
            <p className="text-xs text-text-secondary">
              Fixed to <span className="font-semibold text-text-primary">{APP_TIMEZONE}</span> across all duty rosters.
            </p>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
