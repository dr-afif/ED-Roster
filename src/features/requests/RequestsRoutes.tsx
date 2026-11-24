import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FIRST_NATIVE_ROSTER_PERIOD } from '@/shared/dates';
import { MonthYearWheelModal, useAppUiState } from '@/shared/ui';
import { useRuleVersionQuery } from '@/features/rosters/data/rosterQueries';
import { useAuth } from '../../platform/auth';
import {
  DAILY_LIMIT,
  DEFAULT_MONTHLY_LIMIT,
  DEFAULT_MONTHLY_WEEKEND_LIMIT,
  ON1_DAILY_LIMIT,
  getMonthKey,
  getMonthlyStatsForUser,
  toIsoDate,
  type RequestRecord,
} from './domain/quota';
import {
  useAllRequestsQuery,
  useDeleteRequestMutation,
  usePublicHolidaysQuery,
  useSubmitRequestMutation,
  useTeamMembersQuery,
} from './useRequests';
import { CalendarView } from './components/CalendarView';
import { DateDetailPanel } from './components/DateDetailPanel';
import { RosterTable } from './components/RosterTable';
import { UserRequests } from './components/UserRequests';
import './calendar.css';

export function StaffRequestsRoute() {
  const { user } = useAuth();
  const { requestWindowSummary, deptSettings, showToast } = useAppUiState();
  const isOwner = user?.role === 'owner';
  const selectedName = user?.rosterName || user?.displayName || 'Medical Officer';
  const selectedStaffId = user?.staffId || 1;

  const [viewMode, setViewMode] = useState<'calendar' | 'table' | 'list'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingRequest, setEditingRequest] = useState<RequestRecord | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  });
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data: requests = [], isLoading: isLoadingRequests } = useAllRequestsQuery();
  const { data: teamMembers = [], isLoading: isLoadingMembers } = useTeamMembersQuery();
  const { data: publicHolidays = [] } = usePublicHolidaysQuery();
  const { data: ruleVersion } = useRuleVersionQuery();

  const rawRuleConfig = (ruleVersion?.config as Record<string, unknown>) ?? {};
  const requestMonthlyLimit = Number(rawRuleConfig.request_monthly_limit ?? DEFAULT_MONTHLY_LIMIT);
  const requestWeekendLimit = Number(
    rawRuleConfig.request_weekend_limit ?? DEFAULT_MONTHLY_WEEKEND_LIMIT,
  );
  const requestDailyOffLimit = Number(rawRuleConfig.request_daily_off_limit ?? DAILY_LIMIT);
  const requestOn1DailyLimit = Number(rawRuleConfig.request_on1_daily_limit ?? ON1_DAILY_LIMIT);

  const quotaConfig = useMemo(
    () => ({
      monthlyLimit: requestMonthlyLimit,
      weekendLimit: requestWeekendLimit,
      dailyOffLimit: requestDailyOffLimit,
      on1DailyLimit: requestOn1DailyLimit,
    }),
    [requestMonthlyLimit, requestWeekendLimit, requestDailyOffLimit, requestOn1DailyLimit],
  );

  const submitMutation = useSubmitRequestMutation();
  const deleteMutation = useDeleteRequestMutation();

  const teamMemberNames = useMemo(() => {
    return teamMembers.map((m) => m.roster_name || m.display_name).filter(Boolean);
  }, [teamMembers]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, string>();
    publicHolidays.forEach((h) => {
      map.set(toIsoDate(h.holiday_date), h.name);
    });
    return map;
  }, [publicHolidays]);

  const monthlyStats = useMemo(() => {
    return getMonthlyStatsForUser({
      requests,
      selectedName,
      selectedStaffId,
      calendarMonth: selectedMonth,
      settings: {
        monthly_request_limit: requestMonthlyLimit,
        monthly_weekend_limit: requestWeekendLimit,
        weekend_limit_group_id: 'OFF',
      },
    });
  }, [
    requests,
    selectedName,
    selectedStaffId,
    selectedMonth,
    requestMonthlyLimit,
    requestWeekendLimit,
  ]);

  const selectedMonthKey = getMonthKey(selectedMonth);

  const userRequestsCount = useMemo(() => {
    const comparisonName = (selectedName || '').trim().toLowerCase();
    return requests.filter((request) => {
      const status = (request.status ?? '').toLowerCase();
      if (status && status !== 'active' && status !== 'submitted' && status !== 'approved') {
        return false;
      }
      const iso = toIsoDate(request.date);
      if (!iso || !iso.startsWith(selectedMonthKey)) {
        return false;
      }
      if (
        selectedStaffId &&
        request.staff_id &&
        String(request.staff_id) === String(selectedStaffId)
      ) {
        return true;
      }
      return Boolean(request.name && request.name.trim().toLowerCase() === comparisonName);
    }).length;
  }, [requests, selectedName, selectedStaffId, selectedMonthKey]);

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDateSelect = (date: Date) => {
    if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
      setSelectedDate(null);
      setEditingRequest(null);
    } else {
      setSelectedDate(date);
      setEditingRequest(null);
      setActionError('');
    }
  };

  const handleSelectDateString = (dateStr: string) => {
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      setSelectedDate(parsed);
      setEditingRequest(null);
      setActionError('');
    }
  };

  const handlePanelClose = () => {
    setSelectedDate(null);
    setEditingRequest(null);
    setActionError('');
  };

  const handleEditRequest = (request: RequestRecord) => {
    if (request.date) {
      const d = new Date(request.date);
      if (!Number.isNaN(d.getTime())) {
        setSelectedDate(d);
      }
    }
    setEditingRequest(request);
  };

  const handleDeleteRequest = async (request: RequestRecord) => {
    if (!request.id) return;
    try {
      setActionError('');
      await deleteMutation.mutateAsync(request.id);
      if (editingRequest?.id === request.id) {
        setEditingRequest(null);
      }
      showToast('Request removed');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete request.');
    }
  };

  const handleSubmitRequest = async (payload: {
    id?: number | string;
    staffId: number;
    date: string;
    request: string;
    comment?: string;
  }) => {
    try {
      setActionError('');
      await submitMutation.mutateAsync(payload);
      handlePanelClose();
      showToast('Request saved ✓');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to save request.');
      throw err;
    }
  };

  const now = new Date();
  const upcomingMonthObj = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return (
    <div className="space-y-3">
      {/* Desktop Header Bar (Hidden on mobile where AppShell header shows "Shift Requests") */}
      <div className="sr-only lg:not-sr-only lg:flex flex-wrap items-center justify-between gap-4 border-b border-[#E7E5E4] pb-3.5">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#0F766E]">
            Emergency Department Workforce
          </div>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#18181B]">
            Request Panel
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[#57534E]">
            Displaying active requests made by team members.
          </p>
        </div>

        <Link
          to={`/rosters/${FIRST_NATIVE_ROSTER_PERIOD.year}/${FIRST_NATIVE_ROSTER_PERIOD.month}`}
          className="inline-flex items-center rounded-full bg-[#18181B] px-4 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-stone-800 transition cursor-pointer"
        >
          Enter Timetable
        </Link>
      </div>

      {/* Live Request Window Status Pill */}
      <div
        className={`flex items-center justify-between gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-bold ${
          deptSettings.isWindowOpen
            ? 'border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E]'
            : 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
        }`}
      >
        <span className="inline-flex items-center gap-1.5 truncate">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              deptSettings.isWindowOpen ? 'bg-emerald-600' : 'bg-amber-600'
            }`}
          />
          <span className="truncate">{requestWindowSummary}</span>
        </span>
      </div>

      {/* Sticky Rounded-Full 3-Tab Sliding Switcher */}
      <div className="sticky-subbar">
        <div className="relative grid grid-cols-3 rounded-full bg-[#EAE4DA] p-[3px] select-none">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(33.333%-2px)] rounded-full bg-[#18181B] shadow-[0_3px_10px_rgba(0,0,0,0.16)] transition-transform duration-200 ease-out"
            style={{
              transform:
                viewMode === 'table'
                  ? 'translateX(100%)'
                  : viewMode === 'list'
                    ? 'translateX(200%)'
                    : 'translateX(0%)',
            }}
          />
          <button
            type="button"
            aria-label="Calendar View"
            onClick={() => setViewMode('calendar')}
            className={`relative z-10 py-2 text-[12px] font-extrabold transition-colors cursor-pointer ${
              viewMode === 'calendar' ? 'text-white' : 'text-[#57534E] hover:text-[#18181B]'
            }`}
          >
            Calendar
          </button>
          <button
            type="button"
            aria-label="Team Table (Table View)"
            onClick={() => setViewMode('table')}
            className={`relative z-10 py-2 text-[12px] font-extrabold transition-colors cursor-pointer ${
              viewMode === 'table' ? 'text-white' : 'text-[#57534E] hover:text-[#18181B]'
            }`}
          >
            Team Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`relative z-10 py-2 text-[12px] font-extrabold transition-colors cursor-pointer ${
              viewMode === 'list' ? 'text-white' : 'text-[#57534E] hover:text-[#18181B]'
            }`}
          >
            My List ({userRequestsCount})
          </button>
        </div>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-[18px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-semibold text-[#B91C1C]"
        >
          {actionError}
        </div>
      ) : null}

      {/* Monthly Quota Summary Cards (Prototype 2-col quota-pair) */}
      {monthlyStats.length > 0 ? (
        <div className="space-y-2">
          {monthlyStats.map((stat) => {
            const pct = Math.min(100, (stat.count / (stat.limit || DEFAULT_MONTHLY_LIMIT)) * 100);
            const weekendPct = Math.min(
              100,
              (stat.weekendCount / (stat.weekendLimit || DEFAULT_MONTHLY_WEEKEND_LIMIT)) * 100,
            );
            const totalStroke =
              stat.count >= stat.limit
                ? '#E11D48'
                : stat.count >= stat.limit - 2
                  ? '#D97706'
                  : '#0F766E';
            const weekendStroke = stat.weekendCount >= stat.weekendLimit ? '#E11D48' : '#E06D53';

            return (
              <div key={stat.key} className="space-y-2">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex items-center gap-2.5 rounded-[22px] border border-[#E7E5E4] bg-white p-3 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
                    <svg width="38" height="38" viewBox="0 0 36 36" className="shrink-0">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#E7E5E4" strokeWidth="4" />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke={totalStroke}
                        strokeWidth="4"
                        strokeDasharray={`${Math.round((pct / 100) * 88)} 88`}
                        transform="rotate(-90 18 18)"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold text-[#78716C] truncate">Total Quota</p>
                      <p className="text-[15px] font-extrabold text-[#18181B] tabular-nums">
                        {stat.count} / {stat.limit}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-[22px] border border-[#E7E5E4] bg-white p-3 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
                    <svg width="38" height="38" viewBox="0 0 36 36" className="shrink-0">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#E7E5E4" strokeWidth="4" />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke={weekendStroke}
                        strokeWidth="4"
                        strokeDasharray={`${Math.round((weekendPct / 100) * 88)} 88`}
                        transform="rotate(-90 18 18)"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold text-[#78716C] truncate">
                        Weekend
                        <span className="sr-only"> {stat.weekendLabel} Requests</span>
                      </p>
                      <p className="text-[15px] font-extrabold text-[#18181B] tabular-nums">
                        {stat.weekendCount} / {stat.weekendLimit}
                      </p>
                    </div>
                  </div>
                </div>

                {stat.count >= stat.limit || stat.weekendCount >= stat.weekendLimit ? (
                  <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 px-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {stat.count >= stat.limit
                        ? 'Total Monthly Limit reached!'
                        : `${stat.weekendLabel} limit reached!`}
                    </span>
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Strictly Mutually Exclusive Views: Calendar | Team Table | My List */}
      {viewMode === 'calendar' ? (
        <CalendarView
          requests={requests}
          isLoading={isLoadingRequests}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          publicHolidays={publicHolidays}
          selectedMonth={selectedMonth}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onOpenMonthPicker={() => setIsMonthPickerOpen(true)}
          onMonthChange={setSelectedMonth}
        />
      ) : viewMode === 'table' ? (
        <RosterTable
          names={teamMemberNames}
          requests={requests}
          isLoadingNames={isLoadingMembers}
          selectedMonth={selectedMonth}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onOpenMonthPicker={() => setIsMonthPickerOpen(true)}
          onSelectDate={handleSelectDateString}
        />
      ) : (
        <UserRequests
          requests={requests}
          selectedName={selectedName}
          selectedStaffId={selectedStaffId}
          selectedMonth={selectedMonth}
          monthlyLimit={requestMonthlyLimit}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onOpenMonthPicker={() => setIsMonthPickerOpen(true)}
          onEdit={handleEditRequest}
          onDelete={handleDeleteRequest}
          isLoading={isLoadingRequests}
        />
      )}

      {/* Month / Year Wheel Picker Modal */}
      <MonthYearWheelModal
        isOpen={isMonthPickerOpen}
        onClose={() => setIsMonthPickerOpen(false)}
        title="Select Request Month"
        subtitle="Scroll or tap month & year"
        selectedYear={selectedMonth.getFullYear()}
        selectedMonth={selectedMonth.getMonth() + 1}
        shortcutLabel="Upcoming"
        shortcutYear={upcomingMonthObj.getFullYear()}
        shortcutMonth={upcomingMonthObj.getMonth() + 1}
        onSelect={(yr, mo) => setSelectedMonth(new Date(yr, mo - 1, 1))}
      />

      {/* Slide-over Drawer / Mobile Bottom Sheet when a date is selected */}
      {selectedDate ? (
        <DateDetailPanel
          date={selectedDate}
          holidayName={holidaysByDate.get(toIsoDate(selectedDate))}
          requests={requests}
          selectedName={selectedName}
          selectedStaffId={selectedStaffId}
          isOwner={isOwner}
          quotaConfig={quotaConfig}
          editingRequest={editingRequest}
          teamMembers={teamMembers}
          onClose={handlePanelClose}
          onEdit={handleEditRequest}
          onDelete={handleDeleteRequest}
          onSubmit={handleSubmitRequest}
          isSubmitting={submitMutation.isPending}
          error={actionError}
        />
      ) : null}
    </div>
  );
}

export function AdminRequestsRoute() {
  return <StaffRequestsRoute />;
}
