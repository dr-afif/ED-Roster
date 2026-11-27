import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { getRequestPillClasses } from '../requestTone';
import {
  ADMIN_ALL_SHIFT_TYPES,
  DAILY_LIMIT,
  DEFAULT_MONTHLY_LIMIT,
  DEFAULT_MONTHLY_WEEKEND_LIMIT,
  DEFAULT_SHIFT_TYPES,
  ON1_DAILY_LIMIT,
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

export interface RequestQuotaConfig {
  monthlyLimit?: number;
  weekendLimit?: number;
  dailyOffLimit?: number;
  on1DailyLimit?: number;
}

export interface NewRequestFormProps {
  selectedName: string;
  selectedStaffId: number;
  isOwner?: boolean;
  quotaConfig?: RequestQuotaConfig;
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
const OFF_GROUP_CODES = new Set(['OFF', 'GOFF', 'AL', 'MC', 'EL', 'HKA', 'GHKA', 'COURSE']);

export function NewRequestForm({
  selectedName,
  selectedStaffId,
  isOwner = false,
  quotaConfig,
  initialValues,
  requests = [],
  teamMembers = [],
  onSubmit,
  isSubmitting = false,
}: NewRequestFormProps) {
  const monthlyLimit = quotaConfig?.monthlyLimit ?? DEFAULT_MONTHLY_LIMIT;
  const weekendLimit = quotaConfig?.weekendLimit ?? DEFAULT_MONTHLY_WEEKEND_LIMIT;
  const dailyOffLimit = quotaConfig?.dailyOffLimit ?? DAILY_LIMIT;
  const on1DailyLimit = quotaConfig?.on1DailyLimit ?? ON1_DAILY_LIMIT;
  const { data: dbShiftDefs = [] } = useRequestShiftDefinitionsQuery();
  const [isStaffPickerOpen, setIsStaffPickerOpen] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');

  const allKnownShiftTypes: ShiftTypeDefinition[] = useMemo(() => {
    if (dbShiftDefs.length > 0) {
      const mapped = dbShiftDefs
        .filter((s) => s.is_active && !LEGACY_HIDDEN_SHIFTS.has(s.code.toUpperCase()))
        .map((s) => {
          const upper = s.code.toUpperCase();
          return {
            ID: s.code,
            Name: s.code,
            GroupID: upper === 'ON1' ? 'ON1' : OFF_GROUP_CODES.has(upper) ? 'OFF' : null,
            IsPublic: true,
          };
        });
      for (const extra of ['OH', 'COURT']) {
        if (!mapped.some((m) => m.Name.toUpperCase() === extra)) {
          mapped.push({ ID: extra, Name: extra, GroupID: null, IsPublic: false });
        }
      }
      return mapped;
    }
    return ADMIN_ALL_SHIFT_TYPES;
  }, [dbShiftDefs]);

  const availableShiftTypes: ShiftTypeDefinition[] = useMemo(() => {
    if (!isOwner) {
      return DEFAULT_SHIFT_TYPES;
    }
    return allKnownShiftTypes;
  }, [isOwner, allKnownShiftTypes]);

  const limitGroupById = useMemo(
    () =>
      buildLimitGroupById([
        { ID: 'OFF', GroupName: 'OFF / Leave', DefaultLimit: dailyOffLimit },
        { ID: 'ON1', GroupName: 'ON1 Night Duty', DefaultLimit: on1DailyLimit },
      ]),
    [dailyOffLimit, on1DailyLimit],
  );
  const limitGroupIdByShiftType = useMemo(
    () => buildLimitGroupIdByShiftType([...ADMIN_ALL_SHIFT_TYPES, ...allKnownShiftTypes]),
    [allKnownShiftTypes],
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
  const [confirmDialog, setConfirmDialog] = useState<{
    mode: 'replace_existing' | 'edit_requeue';
    oldShift: string;
    newShift: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    if (initialValues) {
      if (initialValues.date) setDate(initialValues.date);
      if (initialValues.request) setRequest(initialValues.request);
      setComment(initialValues.comment || '');
      if (initialValues.staffId) setTargetStaffId(initialValues.staffId);
    }
  }, [initialValues]);

  const selectedDateKey = toIsoDate(date);
  const isEditing = Boolean(initialValues?.id);

  const existingSameDateRequest = useMemo(() => {
    if (!selectedDateKey || !targetStaffId) return null;
    return (
      requests.find((r) => {
        const status = (r.status ?? '').toLowerCase();
        if (status && status !== 'active' && status !== 'submitted' && status !== 'approved') {
          return false;
        }
        if (initialValues?.id && String(r.id) === String(initialValues.id)) {
          return false;
        }
        return (
          toIsoDate(r.date) === selectedDateKey &&
          r.staff_id !== undefined &&
          String(r.staff_id) === String(targetStaffId)
        );
      }) ?? null
    );
  }, [requests, selectedDateKey, targetStaffId, initialValues?.id]);

  const effectiveInitialForQuota = useMemo(() => {
    if (initialValues?.id) {
      return {
        id: initialValues.id,
        date: initialValues.date,
        request: initialValues.request,
      };
    }
    if (existingSameDateRequest?.id) {
      return {
        id: existingSameDateRequest.id,
        date: existingSameDateRequest.date,
        request: existingSameDateRequest.request,
      };
    }
    return null;
  }, [initialValues, existingSameDateRequest]);

  const selectedTypeStatus = getLimitStatusForType({
    type: request,
    date: selectedDateKey,
    limitGroupIdByShiftType,
    limitGroupById,
    usageByDateAndGroup,
    initialValues: effectiveInitialForQuota,
  });

  const targetMemberName = useMemo(() => {
    const found = teamMembers.find((m) => m.id === targetStaffId);
    return found?.roster_name || found?.display_name || selectedName;
  }, [teamMembers, targetStaffId, selectedName]);

  const upperReq = request.toUpperCase().trim();
  const isCommentRequired = upperReq === 'COURSE' || upperReq === 'MEDSB';
  const showAmberRequiredBorder = isCommentRequired && !comment.trim();

  const submitForm = async () => {
    try {
      await onSubmit({
        id: initialValues?.id,
        staffId: targetStaffId,
        date,
        request,
        comment,
      });
      setConfirmDialog(null);
    } catch (err: unknown) {
      setConfirmDialog(null);
      setValidationError(err instanceof Error ? err.message : 'Failed to save request.');
    }
  };

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

    // Check monthly total & weekend limits (skip if Owner/Admin)
    if (!isOwner) {
      const monthlyCount = getMonthlyRequestCount({
        requests,
        targetName: targetMemberName,
        dateString: date,
        initialRequestId: effectiveInitialForQuota?.id,
      });
      if (monthlyCount >= monthlyLimit) {
        setValidationError(
          `Monthly request limit reached for ${targetMemberName} (${monthlyLimit} requests allowed per month).`,
        );
        return;
      }

      const d = new Date(date);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isLeaveGroupRequest = limitGroupIdByShiftType[upperReq] === 'OFF';
      if (isWeekend && isLeaveGroupRequest) {
        const weekendCount = getMonthlyWeekendRequestCount({
          requests,
          targetName: targetMemberName,
          dateString: date,
          weekendLimitGroupId: 'OFF',
          limitGroupIdByShiftType,
          initialRequestId: effectiveInitialForQuota?.id,
        });
        if (weekendCount >= weekendLimit) {
          setValidationError(
            `Monthly weekend leave limit reached for ${targetMemberName} (${weekendLimit} weekend leave requests allowed per month).`,
          );
          return;
        }
      }
    }

    if (upperReq === 'COURSE' && !comment.trim()) {
      setValidationError('Please enter Course Name & Place in the comment field.');
      return;
    }
    if (upperReq === 'MEDSB' && !comment.trim()) {
      setValidationError('Please enter Medical Standby Event & Venue in the comment field.');
      return;
    }

    if (isEditing) {
      const origDate = toIsoDate(initialValues?.date);
      const origShift = (initialValues?.request ?? '').toUpperCase().trim();
      if (selectedDateKey !== origDate || upperReq !== origShift) {
        setConfirmDialog({
          mode: 'edit_requeue',
          oldShift: origShift || 'OFF',
          newShift: upperReq,
          date: selectedDateKey,
        });
        return;
      }
      await submitForm();
      return;
    }

    if (existingSameDateRequest) {
      setConfirmDialog({
        mode: 'replace_existing',
        oldShift: (existingSameDateRequest.request || 'OFF').toUpperCase(),
        newShift: upperReq,
        date: selectedDateKey,
      });
      return;
    }

    await submitForm();
  };

  const monthlyCard = useMemo(() => {
    if (!date) return null;
    const monthlyCount = getMonthlyRequestCount({
      requests,
      targetName: targetMemberName,
      dateString: date,
      initialRequestId: effectiveInitialForQuota?.id,
    });
    const isOverLimit = monthlyCount >= monthlyLimit;

    let colorClasses = 'text-[#065F46] bg-[#D1FAE5]/60 border-[#A7F3D0]';
    if (isOverLimit) {
      colorClasses = 'text-[#991B1B] bg-[#FEF2F2] border-[#FECACA] font-bold';
    } else if (monthlyCount >= monthlyLimit - 2) {
      colorClasses = 'text-[#92400E] bg-[#FFFBEB] border-[#FDE68A]';
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
  }, [date, requests, targetMemberName, effectiveInitialForQuota, monthlyLimit]);

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
    <>
      <form
        onSubmit={handleSubmit}
        className="rounded-[22px] bg-[#FAF8F5] p-3.5 border border-[#EFECE6]"
      >
        <fieldset className="flex flex-col gap-3" disabled={isSubmitting}>
          <legend className="sr-only">{isEditing ? 'Update Request' : 'New Request'}</legend>

          {isOwner ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between rounded-[14px] border border-[#E7E5E4] bg-white px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-[#78716C]">Submit on behalf of: </span>
                  <span className="font-extrabold text-[#18181B] truncate">{targetMemberName}</span>
                </div>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStaffSearch('');
                      setIsStaffPickerOpen((v) => !v);
                    }}
                    className="shrink-0 rounded-full border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-1 text-[11px] font-bold text-[#18181B] hover:bg-[#EFECE6] transition cursor-pointer"
                  >
                    {isStaffPickerOpen ? 'Done' : 'Change'}
                  </button>
                ) : null}
              </div>

              {isStaffPickerOpen && !isEditing ? (
                <div className="rounded-[16px] border border-[#E7E5E4] bg-white p-2.5 shadow-md space-y-2">
                  <input
                    type="search"
                    placeholder="Search MO name or code..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-1.5 text-xs font-medium text-[#18181B] focus:border-[#0F766E] focus:outline-none"
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
                              ? 'bg-[#F0FDFA] text-[#0F766E] ring-1 ring-[#99F6E4]'
                              : 'text-[#18181B] hover:bg-[#FAF8F5]'
                          }`}
                        >
                          <span>
                            {label}{' '}
                            <span className="text-[10px] font-normal text-[#A8A29E]">
                              ({member.staff_code})
                            </span>
                          </span>
                          {isActive ? (
                            <span className="text-[10px] text-[#0F766E]">Selected ✓</span>
                          ) : null}
                        </button>
                      );
                    })}
                    {filteredMembers.length === 0 ? (
                      <p className="py-3 text-center text-xs text-[#A8A29E]">No matching MO</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[14px] bg-white border border-[#E7E5E4] px-3 py-2 text-xs text-[#57534E]">
              <span className="font-semibold text-[#78716C]">Team member: </span>
              <span className="text-[#18181B] font-extrabold">{selectedName}</span>
            </div>
          )}

          {/* Live Monthly Limit Summary Card */}
          {monthlyCard ? (
            <div
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${monthlyCard.colorClasses}`}
            >
              <span>Monthly total for {monthlyCard.displayMonth}:</span>
              <span className="font-extrabold">
                {monthlyCard.monthlyCount} / {monthlyLimit} used
              </span>
            </div>
          ) : null}

          {/* Shift Type Grid */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#18181B]">Request Type</span>
              {isOwner ? (
                <span className="rounded-full bg-[#F0FDFA] border border-[#99F6E4] px-2.5 py-0.5 text-[10px] font-extrabold text-[#0F766E]">
                  Admin Mode: Full Shift Catalog ({availableShiftTypes.length})
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {availableShiftTypes.map((st) => {
                const status = getLimitStatusForType({
                  type: st.Name,
                  date: selectedDateKey,
                  limitGroupIdByShiftType,
                  limitGroupById,
                  usageByDateAndGroup,
                  initialValues: effectiveInitialForQuota,
                });

                const isCapped = !isOwner && status.isLimited && Boolean(status.isAtLimit);
                const isSelected = request === st.Name;

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
                    className={`rounded-[14px] py-2.5 px-2 text-center text-[12px] font-extrabold transition active:scale-[0.96] cursor-pointer ${
                      isCapped
                        ? 'border border-[#E7E5E4] bg-stone-100 text-stone-400 opacity-55 cursor-not-allowed'
                        : `${getRequestPillClasses(st.Name)} ${
                            isSelected ? 'ring-2 ring-[#18181B] ring-offset-2' : ''
                          }`
                    }`}
                  >
                    <span className="truncate">{st.Name}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-0.5 text-[11px] font-semibold text-[#78716C]">
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

          <label className="text-xs font-extrabold text-[#18181B]">
            {upperReq === 'COURSE' ? (
              <>
                Course Name &amp; Place <span className="text-[#D97706]">*Required</span>
              </>
            ) : upperReq === 'MEDSB' ? (
              <>
                Medical Standby Event &amp; Venue <span className="text-[#D97706]">*Required</span>
              </>
            ) : (
              'Comment (optional)'
            )}
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 120)}px`;
              }}
              rows={2}
              placeholder={
                upperReq === 'COURSE'
                  ? 'Course Name: ...\nPlace: ...'
                  : upperReq === 'MEDSB'
                    ? 'Event: ...\nVenue: ...'
                    : 'Add context for this request'
              }
              className={`mt-1 min-h-[54px] max-h-32 w-full resize-none overflow-y-auto rounded-[14px] border bg-white px-3 py-2 text-xs font-medium text-[#18181B] focus:outline-none ${
                showAmberRequiredBorder
                  ? 'border-[#F59E0B] ring-1 ring-[#F59E0B]/40'
                  : 'border-[#E7E5E4] focus:border-[#0F766E]'
              }`}
            />
          </label>

          {validationError ? (
            <div
              role="alert"
              className="rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs font-semibold text-[#B91C1C]"
            >
              {validationError}
            </div>
          ) : null}

          {isEditing ? (
            <p className="rounded-[12px] border border-[#E7E5E4] bg-white px-3 py-2 text-[11px] font-medium text-[#57534E]">
              Editing comments keeps your current queue position. Changing the shift type cancels
              the old request and submits a new one at the end of the queue.
            </p>
          ) : existingSameDateRequest ? (
            <p className="rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[11px] font-semibold text-[#92400E]">
              {targetMemberName} already has an{' '}
              <span className="font-extrabold">{existingSameDateRequest.request}</span> request on{' '}
              {selectedDateKey}. Saving a new request will replace it at the end of the queue.
            </p>
          ) : null}

          <div className="sticky bottom-0 z-10 -mx-1 bg-gradient-to-t from-[#FAF8F5] via-[#FAF8F5]/95 to-transparent px-1 pt-2 pb-0.5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#14867D,#0F766E)] px-4 py-3 text-[13px] font-extrabold text-white shadow-[0_8px_18px_rgba(15,118,110,0.28)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Request' : 'Save Request'}
            </button>
          </div>
        </fieldset>
      </form>

      {confirmDialog && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="replace-request-modal-title"
            >
              <div
                className="fixed inset-0 bg-[#18181B]/55 backdrop-blur-[3px]"
                aria-hidden="true"
                onClick={() => !isSubmitting && setConfirmDialog(null)}
              />
              <div
                className="relative z-10 w-full sm:max-w-md rounded-t-[28px] sm:rounded-[24px] border border-[#E7E5E4] bg-white p-5 shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[#D97706]">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3
                      id="replace-request-modal-title"
                      className="text-[15px] font-extrabold text-[#18181B]"
                    >
                      {confirmDialog.mode === 'replace_existing'
                        ? 'Replace Existing Request?'
                        : 'Confirm Request Change'}
                    </h3>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-[#57534E]">
                      {confirmDialog.mode === 'replace_existing' ? (
                        <>
                          {targetMemberName} already has an{' '}
                          <span className="font-extrabold text-[#18181B]">
                            {confirmDialog.oldShift}
                          </span>{' '}
                          request on{' '}
                          <span className="font-extrabold text-[#18181B]">
                            {confirmDialog.date}
                          </span>
                          . Saving{' '}
                          <span className="font-extrabold text-[#18181B]">
                            {confirmDialog.newShift}
                          </span>{' '}
                          will cancel the older request (kept for audit) and place this new request
                          at the{' '}
                          <span className="font-extrabold text-[#18181B]">latest/lowest</span>{' '}
                          position in the queue.
                        </>
                      ) : (
                        <>
                          Changing from{' '}
                          <span className="font-extrabold text-[#18181B]">
                            {confirmDialog.oldShift}
                          </span>{' '}
                          to{' '}
                          <span className="font-extrabold text-[#18181B]">
                            {confirmDialog.newShift}
                          </span>{' '}
                          will cancel your older request (kept for audit) and submit this as a new
                          request at the{' '}
                          <span className="font-extrabold text-[#18181B]">latest/lowest</span>{' '}
                          position in the queue.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setConfirmDialog(null)}
                    className="rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-4 py-2 text-xs font-bold text-[#18181B] hover:bg-[#EFECE6] transition cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void submitForm()}
                    className="rounded-xl bg-[linear-gradient(135deg,#14867D,#0F766E)] px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:opacity-95 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting
                      ? 'Saving...'
                      : confirmDialog.mode === 'replace_existing'
                        ? 'Confirm & Replace'
                        : 'Confirm Change'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
