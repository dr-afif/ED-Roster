import React, { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LIMIT_GROUPS,
  DEFAULT_MONTHLY_LIMIT,
  DEFAULT_MONTHLY_WEEKEND_LIMIT,
  DEFAULT_SHIFT_TYPES,
  buildLimitGroupById,
  buildLimitGroupIdByShiftType,
  buildUsageByDateAndGroup,
  getLimitStatusForType,
  getMonthlyRequestCount,
  getMonthlyWeekendRequestCount,
  toIsoDate,
  type RequestRecord,
} from '../domain/quota';

export interface NewRequestFormProps {
  selectedName: string;
  selectedStaffId: number;
  isOwner?: boolean;
  initialValues?: {
    id?: number | string;
    date?: string;
    request?: string;
    comment?: string | null;
    name?: string;
    staffId?: number;
  } | null;
  requests: RequestRecord[];
  teamMembers?: Array<{
    id: number;
    roster_name: string;
    display_name: string;
    staff_code: string;
  }>;
  onSubmit: (payload: {
    id?: number | string;
    staffId: number;
    date: string;
    request: string;
    comment?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function NewRequestForm({
  selectedName,
  selectedStaffId,
  isOwner = false,
  initialValues,
  requests = [],
  teamMembers = [],
  onSubmit,
  isSubmitting = false,
}: NewRequestFormProps) {
  const limitGroupById = useMemo(() => buildLimitGroupById(DEFAULT_LIMIT_GROUPS), []);
  const limitGroupIdByShiftType = useMemo(
    () => buildLimitGroupIdByShiftType(DEFAULT_SHIFT_TYPES),
    [],
  );

  const usageByDateAndGroup = useMemo(() => {
    return buildUsageByDateAndGroup(requests, limitGroupIdByShiftType);
  }, [requests, limitGroupIdByShiftType]);

  const [date, setDate] = useState(() => initialValues?.date || toIsoDate(new Date()));
  const [request, setRequest] = useState(() => initialValues?.request || 'OFF');
  const [comment, setComment] = useState(() => initialValues?.comment || '');
  const [targetStaffId, setTargetStaffId] = useState<number>(() => {
    return initialValues?.staffId || selectedStaffId;
  });
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (initialValues) {
      if (initialValues.date) setDate(initialValues.date);
      if (initialValues.request) setRequest(initialValues.request);
      setComment(initialValues.comment || '');
      if (initialValues.staffId) setTargetStaffId(initialValues.staffId);
    }
  }, [initialValues]);

  const selectedDateKey = toIsoDate(date);
  const selectedTypeStatus = getLimitStatusForType({
    type: request,
    date: selectedDateKey,
    limitGroupIdByShiftType,
    limitGroupById,
    usageByDateAndGroup,
    initialValues: initialValues
      ? {
          id: initialValues.id,
          date: initialValues.date,
          request: initialValues.request,
        }
      : null,
  });

  const targetMemberName = useMemo(() => {
    const found = teamMembers.find((m) => m.id === targetStaffId);
    return found?.roster_name || found?.display_name || selectedName;
  }, [teamMembers, targetStaffId, selectedName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!date) {
      setValidationError('Please select a date.');
      return;
    }

    if (!targetStaffId) {
      setValidationError('Please select a staff member.');
      return;
    }

    // Check daily limit (skip if Owner/Admin)
    if (!isOwner && selectedTypeStatus.isLimited && selectedTypeStatus.isAtLimit) {
      setValidationError(
        `Limit reached for group '${selectedTypeStatus.groupName}' (${selectedTypeStatus.limit} slots) on this date.`,
      );
      return;
    }

    // Check monthly total limit (skip if Owner/Admin)
    if (!isOwner) {
      const monthlyCount = getMonthlyRequestCount({
        requests,
        targetName: targetMemberName,
        dateString: date,
        initialRequestId: initialValues?.id,
      });
      if (monthlyCount >= DEFAULT_MONTHLY_LIMIT) {
        setValidationError(
          `Monthly request limit reached for ${targetMemberName} (${DEFAULT_MONTHLY_LIMIT} requests allowed per month).`,
        );
        return;
      }

      // Check weekend limit
      const d = new Date(date);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (isWeekend) {
        const weekendCount = getMonthlyWeekendRequestCount({
          requests,
          targetName: targetMemberName,
          dateString: date,
          weekendLimitGroupId: 'ALL',
          limitGroupIdByShiftType,
          initialRequestId: initialValues?.id,
        });
        if (weekendCount >= DEFAULT_MONTHLY_WEEKEND_LIMIT) {
          setValidationError(
            `Monthly weekend request limit reached for ${targetMemberName} (${DEFAULT_MONTHLY_WEEKEND_LIMIT} weekend requests allowed per month).`,
          );
          return;
        }
      }
    }

    try {
      await onSubmit({
        id: initialValues?.id,
        staffId: targetStaffId,
        date,
        request,
        comment,
      });
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save request.');
    }
  };

  // Monthly Limit Card computation
  const monthlyCard = useMemo(() => {
    if (!date) return null;
    const monthlyCount = getMonthlyRequestCount({
      requests,
      targetName: targetMemberName,
      dateString: date,
      initialRequestId: initialValues?.id,
    });
    const isOverLimit = monthlyCount >= DEFAULT_MONTHLY_LIMIT;

    let colorClasses = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (isOverLimit) {
      colorClasses = 'text-rose-700 bg-rose-50 border-rose-200 font-bold';
    } else if (monthlyCount >= DEFAULT_MONTHLY_LIMIT - 2) {
      colorClasses = 'text-amber-700 bg-amber-50 border-amber-200';
    }

    let displayMonth = 'this month';
    try {
      displayMonth = new Date(date).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      // ignore
    }

    return {
      monthlyCount,
      displayMonth,
      colorClasses,
    };
  }, [date, requests, targetMemberName, initialValues]);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
    >
      <fieldset className="flex flex-col gap-4" disabled={isSubmitting}>
        <legend className="text-base font-bold text-slate-900">
          {initialValues?.id ? 'Update Request' : 'New Request'}
        </legend>

        {isOwner ? (
          <label className="text-sm font-semibold text-slate-700">
            Submit on behalf of:
            <select
              value={targetStaffId}
              onChange={(e) => {
                setValidationError('');
                setTargetStaffId(Number(e.target.value));
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              required
            >
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.roster_name || member.display_name} ({member.staff_code})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Team member: </span>
            <span className="text-slate-900 font-bold">{selectedName}</span>
          </div>
        )}

        <label className="text-sm font-semibold text-slate-700">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setValidationError('');
              setDate(e.target.value);
            }}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            required
          />
        </label>

        {/* Live Monthly Limit Summary Card */}
        {monthlyCard && (
          <div
            className={`flex items-center justify-between rounded-xl border p-2.5 text-xs ${monthlyCard.colorClasses}`}
          >
            <span>Monthly total for {monthlyCard.displayMonth}:</span>
            <span className="font-bold">
              {monthlyCard.monthlyCount} / {DEFAULT_MONTHLY_LIMIT} used
            </span>
          </div>
        )}

        {/* Shift Type 4-column Grid */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Request Type</span>
          <div className="grid grid-cols-4 gap-2">
            {DEFAULT_SHIFT_TYPES.map((st) => {
              const status = getLimitStatusForType({
                type: st.Name,
                date: selectedDateKey,
                limitGroupIdByShiftType,
                limitGroupById,
                usageByDateAndGroup,
                initialValues: initialValues
                  ? {
                      id: initialValues.id,
                      date: initialValues.date,
                      request: initialValues.request,
                    }
                  : null,
              });

              const isCapped = !isOwner && status.isLimited && Boolean(status.isAtLimit);
              const isSelected = request === st.Name;

              let btnClass =
                'border text-xs font-bold py-2.5 rounded-full text-center transition duration-200 active:scale-[0.96] flex items-center justify-center min-w-0 px-1 cursor-pointer';

              if (isSelected) {
                btnClass +=
                  ' bg-gradient-to-tr from-indigo-600 to-indigo-700 border-indigo-600 text-white shadow-sm font-extrabold';
              } else if (isCapped) {
                btnClass +=
                  ' bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60';
              } else {
                btnClass +=
                  ' bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50';
              }

              return (
                <button
                  key={st.Name}
                  type="button"
                  disabled={isCapped}
                  title={st.Name + (isCapped ? ' (Full / Capped)' : '')}
                  onClick={() => {
                    setValidationError('');
                    setRequest(st.Name);
                  }}
                  className={btnClass}
                >
                  <span className="truncate">{st.Name}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-1 text-[11px] font-medium text-slate-500">
            {selectedDateKey && selectedTypeStatus.isLimited ? (
              <>
                {selectedTypeStatus.usage}/{selectedTypeStatus.limit} requests for group &apos;
                {selectedTypeStatus.groupName}&apos; on this date.
                {!isOwner && selectedTypeStatus.isAtLimit ? ' Selection capped.' : ''}
              </>
            ) : selectedTypeStatus.isLimited ? (
              `Group '${selectedTypeStatus.groupName}' is subject to limits.`
            ) : (
              'This shift type is unlimited.'
            )}
          </p>
        </div>

        <label className="text-sm font-semibold text-slate-700">
          Comment (optional)
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Add context for this request"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          {isSubmitting ? 'Saving...' : initialValues?.id ? 'Update Request' : 'Save Request'}
        </button>

        {validationError && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
          >
            {validationError}
          </div>
        )}
      </fieldset>
    </form>
  );
}
