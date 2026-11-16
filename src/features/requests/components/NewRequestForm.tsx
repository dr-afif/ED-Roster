import React, { useEffect, useMemo, useState } from 'react';
import {
  ADMIN_ALL_SHIFT_TYPES,
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
  type ShiftTypeDefinition,
} from '../domain/quota';
import { useRequestShiftDefinitionsQuery } from '../useRequests';

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

const LEGACY_HIDDEN_SHIFTS = new Set(['ON', 'NIGHT', 'ND']);

function getShiftTileTone(code: string, isSelected: boolean, isCapped: boolean): string {
  if (isSelected) {
    return 'bg-[#18181B] border-[#18181B] text-white shadow-sm font-extrabold';
  }
  if (isCapped) {
    return 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed opacity-55';
  }
  const c = code.toUpperCase().trim();
  if (c === 'AM' || c === 'OH') {
    return 'bg-[#E5EED8] border-[#C6D8B6] text-[#2D4A22] hover:brightness-95';
  }
  if (c === 'PM') {
    return 'bg-[#DCE7F9] border-[#B8CEF2] text-[#1E3A8A] hover:brightness-95';
  }
  if (c === 'ON1' || c === 'ON2' || c === 'PN') {
    return 'bg-[#FCE7F1] border-[#F8B9D4] text-[#9D174D] hover:brightness-95';
  }
  if (c === 'AL' || c === 'MC' || c === 'EL' || c === 'HKA' || c === 'GHKA') {
    return 'bg-[#D1FAE5] border-[#A7F3D0] text-[#065F46] hover:brightness-95';
  }
  if (c === 'COURSE' || c === 'COURT') {
    return 'bg-[#FEF3C7] border-[#FDE047] text-[#854D0E] hover:brightness-95';
  }
  return 'bg-[#FAF8F5] border-stone-200 text-stone-700 hover:bg-stone-100';
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
  const { data: dbShiftDefs = [] } = useRequestShiftDefinitionsQuery();
  const [isStaffPickerOpen, setIsStaffPickerOpen] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');

  // If user is owner/admin, provide full catalog of departmental shifts (excluding legacy ON/NIGHT/ND).
  // Regular doctors are constrained to standard requestable types (DEFAULT_SHIFT_TYPES).
  const availableShiftTypes: ShiftTypeDefinition[] = useMemo(() => {
    if (!isOwner) {
      return DEFAULT_SHIFT_TYPES;
    }
    if (dbShiftDefs.length > 0) {
      const mapped = dbShiftDefs
        .filter((s) => s.is_active && !LEGACY_HIDDEN_SHIFTS.has(s.code.toUpperCase()))
        .map((s) => ({
          ID: s.code,
          Name: s.code,
          GroupID: ['OFF', 'AL', 'MC', 'EL', 'HKA', 'GOFF'].includes(s.code.toUpperCase())
            ? 'OFF'
            : null,
          IsPublic: true,
        }));
      for (const extra of ['OH', 'COURT']) {
        if (!mapped.some((m) => m.Name.toUpperCase() === extra)) {
          mapped.push({ ID: extra, Name: extra, GroupID: null, IsPublic: false });
        }
      }
      return mapped;
    }
    return ADMIN_ALL_SHIFT_TYPES;
  }, [isOwner, dbShiftDefs]);

  const limitGroupById = useMemo(() => buildLimitGroupById(DEFAULT_LIMIT_GROUPS), []);
  const limitGroupIdByShiftType = useMemo(
    () => buildLimitGroupIdByShiftType(availableShiftTypes),
    [availableShiftTypes],
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

  const filteredMembers = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter(
      (m) =>
        (m.roster_name || '').toLowerCase().includes(q) ||
        (m.display_name || '').toLowerCase().includes(q) ||
        (m.staff_code || '').toLowerCase().includes(q),
    );
  }, [teamMembers, staffSearch]);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl bg-white p-4 shadow-xs ring-1 ring-stone-200/80"
    >
      <fieldset className="flex flex-col gap-3.5" disabled={isSubmitting}>
        <legend className="text-sm font-extrabold text-stone-900">
          {initialValues?.id ? 'Update Request' : 'New Request'}
        </legend>

        {isOwner ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded-2xl border border-stone-200/80 bg-[#FAF8F5] px-3 py-2 text-xs">
              <div className="min-w-0">
                <span className="font-semibold text-stone-500">Submit on behalf of: </span>
                <span className="font-extrabold text-stone-900 truncate">{targetMemberName}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStaffSearch('');
                  setIsStaffPickerOpen((v) => !v);
                }}
                className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-bold text-stone-800 shadow-2xs hover:bg-stone-100 transition cursor-pointer"
              >
                {isStaffPickerOpen ? 'Done' : 'Change'}
              </button>
            </div>

            {isStaffPickerOpen && (
              <div className="rounded-2xl border border-stone-200 bg-white p-2.5 shadow-md space-y-2">
                <input
                  type="search"
                  placeholder="Search MO name or code..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-3 py-1.5 text-xs font-medium text-stone-900 focus:border-teal-600 focus:outline-none"
                />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredMembers.map((member) => {
                    const isActive = member.id === targetStaffId;
                    const label = member.roster_name || member.display_name;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setValidationError('');
                          setTargetStaffId(member.id);
                          setIsStaffPickerOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-bold transition cursor-pointer ${
                          isActive
                            ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                            : 'text-stone-800 hover:bg-stone-50'
                        }`}
                      >
                        <span>
                          {label}{' '}
                          <span className="text-[10px] font-normal text-stone-400">
                            ({member.staff_code})
                          </span>
                        </span>
                        {isActive && <span className="text-[10px] text-teal-700">Selected ✓</span>}
                      </button>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <p className="py-3 text-center text-xs text-stone-400">No matching MO</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-[#FAF8F5] border border-stone-200/70 px-3 py-2 text-xs text-stone-600">
            <span className="font-semibold text-stone-500">Team member: </span>
            <span className="text-stone-900 font-extrabold">{selectedName}</span>
          </div>
        )}

        <label className="text-xs font-bold text-stone-700">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setValidationError('');
              setDate(e.target.value);
            }}
            className="mt-1 w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-none"
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

        {/* Shift Type Grid */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700">Request Type</span>
            {isOwner && (
              <span className="rounded-lg bg-teal-50 border border-teal-200/70 px-2 py-0.5 text-[10px] font-extrabold text-teal-800">
                Admin Mode: Full Shift Catalog ({availableShiftTypes.length})
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {availableShiftTypes.map((st) => {
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

              const btnClass = `border text-[11px] font-extrabold py-2.5 rounded-xl text-center transition duration-150 active:scale-[0.96] flex items-center justify-center min-w-0 px-1 cursor-pointer ${getShiftTileTone(
                st.Name,
                isSelected,
                isCapped,
              )}`;

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

          <p className="mt-1 text-[11px] font-medium text-stone-500">
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

        <label className="text-xs font-bold text-stone-700">
          Comment (optional)
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Add context for this request"
            className="mt-1 w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-[#18181B] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-stone-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-stone-300 cursor-pointer"
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
