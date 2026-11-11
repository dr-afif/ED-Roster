import { useMemo, useState } from 'react';
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
      {/* 🧭 Header & View Mode Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
            <span>📝</span>
            <span className="bg-gradient-to-r from-slate-900 to-indigo-800 bg-clip-text text-transparent">
              Request Panel
            </span>
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Displaying active requests made by team members.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-200/60 p-1 shadow-inner self-start sm:self-auto ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition duration-200 ${
              viewMode === 'calendar'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📅 Calendar View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition duration-200 ${
              viewMode === 'table'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📊 Table View
          </button>
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

      {/* 📊 Monthly Quota Summary Cards */}
      {monthlyStats.length > 0 && (
        <div className="max-w-sm">
          {monthlyStats.map((stat) => {
            const pct = Math.min(100, (stat.count / (stat.limit || DEFAULT_MONTHLY_LIMIT)) * 100);
            const weekendPct = Math.min(
              100,
              (stat.weekendCount / (stat.weekendLimit || DEFAULT_MONTHLY_WEEKEND_LIMIT)) * 100,
            );

            let barColor = 'bg-emerald-500';
            let textColor = 'text-emerald-700';
            let bgColor = 'bg-emerald-50';
            let borderColor = 'border-emerald-200';

            if (stat.count >= stat.limit) {
              barColor = 'bg-rose-500';
              textColor = 'text-rose-700';
              bgColor = 'bg-rose-50';
              borderColor = 'border-rose-200';
            } else if (stat.count >= stat.limit - 2) {
              barColor = 'bg-amber-500';
              textColor = 'text-amber-700';
              bgColor = 'bg-amber-50';
              borderColor = 'border-amber-200';
            }

            return (
              <div
                key={stat.key}
                className={`rounded-3xl border ${borderColor} ${bgColor} p-4 shadow-sm transition flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    {stat.label} Quotas
                  </span>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between mb-1 text-[11px] font-bold">
                    <span className="text-slate-600">Total Requests</span>
                    <span className={textColor}>
                      {stat.count} / {stat.limit}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mb-1">
                  <div className="flex justify-between mb-1 text-[11px] font-bold">
                    <span className="text-slate-600">{stat.weekendLabel} Requests</span>
                    <span
                      className={
                        stat.weekendCount >= stat.weekendLimit
                          ? 'text-rose-700 font-bold'
                          : 'text-slate-700'
                      }
                    >
                      {stat.weekendCount} / {stat.weekendLimit}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className={`h-full ${
                        stat.weekendCount >= stat.weekendLimit ? 'bg-rose-500' : 'bg-slate-400'
                      } transition-all duration-500 rounded-full`}
                      style={{ width: `${weekendPct}%` }}
                    />
                  </div>
                </div>

                {(stat.count >= stat.limit || stat.weekendCount >= stat.weekendLimit) && (
                  <p className="mt-2 text-xs font-bold text-rose-600 flex items-center gap-1">
                    ⚠️{' '}
                    {stat.count >= stat.limit
                      ? 'Total Monthly Limit reached!'
                      : `${stat.weekendLabel} limit reached!`}
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
