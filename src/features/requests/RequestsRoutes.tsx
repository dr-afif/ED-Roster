import { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, ClipboardList, Table } from 'lucide-react';
import { useAuth } from '../../platform/auth';
import {
  DEFAULT_MONTHLY_LIMIT,
  DEFAULT_MONTHLY_WEEKEND_LIMIT,
  getMonthlyStatsForUser,
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
  const isOwner = user?.role === 'owner';
  const selectedName = user?.rosterName || user?.displayName || 'Medical Officer';
  const selectedStaffId = user?.staffId || 1;

  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingRequest, setEditingRequest] = useState<RequestRecord | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  });
  const [actionError, setActionError] = useState('');

  const { data: requests = [], isLoading: isLoadingRequests } = useAllRequestsQuery();
  const { data: teamMembers = [], isLoading: isLoadingMembers } = useTeamMembersQuery();
  const { data: publicHolidays = [] } = usePublicHolidaysQuery();

  const submitMutation = useSubmitRequestMutation();
  const deleteMutation = useDeleteRequestMutation();

  const teamMemberNames = useMemo(() => {
    return teamMembers.map((m) => m.roster_name || m.display_name).filter(Boolean);
  }, [teamMembers]);

  const monthlyStats = useMemo(() => {
    return getMonthlyStatsForUser({
      requests,
      selectedName,
      calendarMonth,
    });
  }, [requests, selectedName, calendarMonth]);

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
        setViewMode('calendar');
      }
    }
    setEditingRequest(request);
  };

  const handleDeleteRequest = async (request: RequestRecord) => {
    if (!request.id) return;
    if (!window.confirm(`Delete ${request.request} request on ${request.date}?`)) return;

    try {
      setActionError('');
      await deleteMutation.mutateAsync(request.id);
      if (editingRequest?.id === request.id) {
        setEditingRequest(null);
      }
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
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to save request.');
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sticky Mobile View Mode Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-200/60 shadow-2xs">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">
              Request Panel
            </h2>
            <p className="mt-0.5 text-xs font-medium text-stone-500">
              Displaying active requests made by team members.
            </p>
          </div>
        </div>

        <div className="sticky top-14 z-10 -mx-3.5 px-3.5 py-2 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-stone-200/60 sm:static sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:border-0">
          <div className="inline-flex w-full sm:w-auto rounded-full bg-stone-200/70 p-1 ring-1 ring-stone-200">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition duration-150 cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-[#18181B] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Calendar View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition duration-150 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#18181B] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Table className="h-3.5 w-3.5" />
              <span>Table View</span>
            </button>
          </div>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
        >
          {actionError}
        </div>
      )}

      {/* 📊 Monthly Quota Summary Cards (Warm Editorial Circular Rings) */}
      {monthlyStats.length > 0 && (
        <div className="max-w-md space-y-2">
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
            const weekendStroke =
              stat.weekendCount >= stat.weekendLimit ? '#E11D48' : '#E06D53';

            return (
              <div key={stat.key} className="space-y-2">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex items-center gap-3 rounded-3xl border border-stone-200/80 bg-white p-3.5 shadow-xs">
                    <svg width="42" height="42" viewBox="0 0 36 36" className="shrink-0">
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
                      <p className="text-[11px] font-bold text-stone-500 truncate">Total Requests</p>
                      <p className="text-base font-extrabold text-stone-900 tabular-nums">
                        {stat.count} / {stat.limit}
                      </p>
                      <p className="text-[10px] font-semibold text-stone-400 truncate">{stat.label}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-3xl border border-stone-200/80 bg-white p-3.5 shadow-xs">
                    <svg width="42" height="42" viewBox="0 0 36 36" className="shrink-0">
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
                      <p className="text-[11px] font-bold text-stone-500 truncate">
                        {stat.weekendLabel} Requests
                      </p>
                      <p className="text-base font-extrabold text-stone-900 tabular-nums">
                        {stat.weekendCount} / {stat.weekendLimit}
                      </p>
                      <p className="text-[10px] font-semibold text-stone-400 truncate">Sat &amp; Sun</p>
                    </div>
                  </div>
                </div>

                {(stat.count >= stat.limit || stat.weekendCount >= stat.weekendLimit) && (
                  <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 px-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {stat.count >= stat.limit
                        ? 'Total Monthly Limit reached!'
                        : `${stat.weekendLabel} limit reached!`}
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 🎛️ Unified Switch View: Calendar vs Table */}
      {viewMode === 'calendar' ? (
        <CalendarView
          requests={requests}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          publicHolidays={publicHolidays}
          onMonthChange={setCalendarMonth}
        />
      ) : (
        <RosterTable
          names={teamMemberNames}
          requests={requests}
          isLoadingNames={isLoadingMembers}
        />
      )}

      {/* 📋 Personal Request History */}
      <div className="mt-6 border-t border-slate-200 pt-6">
        <UserRequests
          requests={requests}
          selectedName={selectedName}
          selectedStaffId={selectedStaffId}
          onEdit={handleEditRequest}
          onDelete={handleDeleteRequest}
          isLoading={isLoadingRequests}
        />
      </div>

      {/* Slide-over panel when a date is selected */}
      {selectedDate && (
        <DateDetailPanel
          date={selectedDate}
          requests={requests}
          selectedName={selectedName}
          selectedStaffId={selectedStaffId}
          isOwner={isOwner}
          editingRequest={editingRequest}
          teamMembers={teamMembers}
          onClose={handlePanelClose}
          onEdit={handleEditRequest}
          onDelete={handleDeleteRequest}
          onSubmit={handleSubmitRequest}
          isSubmitting={submitMutation.isPending}
          error={actionError}
        />
      )}
    </div>
  );
}

export function AdminRequestsRoute() {
  // Admin and Staff share the unified Request Panel, with Admin having privileged submit-on-behalf and edit capabilities.
  return <StaffRequestsRoute />;
}
