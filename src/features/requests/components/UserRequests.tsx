import { useMemo } from 'react';
import { getShiftToneClasses, Skeleton } from '@/shared/ui';
import { DEFAULT_MONTHLY_LIMIT, getMonthKey, toIsoDate, type RequestRecord } from '../domain/quota';

function formatDisplayDate(dateLike: string | Date): string {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return String(dateLike);

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export interface UserRequestsProps {
  requests: RequestRecord[];
  selectedName: string;
  selectedStaffId?: number;
  selectedMonth?: Date;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onOpenMonthPicker?: () => void;
  onEdit: (request: RequestRecord) => void;
  onDelete: (request: RequestRecord) => void;
  isLoading?: boolean;
}

export function UserRequests({
  requests = [],
  selectedName,
  selectedStaffId,
  selectedMonth,
  onPrevMonth,
  onNextMonth,
  onOpenMonthPicker,
  onEdit,
  onDelete,
  isLoading = false,
}: UserRequestsProps) {
  const targetMonth = useMemo(() => {
    if (selectedMonth) return selectedMonth;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }, [selectedMonth]);

  const monthKey = getMonthKey(targetMonth);
  const monthLabel = targetMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const filteredRequests = useMemo(() => {
    if (!selectedName && !selectedStaffId) return [];
    const comparisonName = (selectedName || '').trim().toLowerCase();

    return requests
      .filter((request) => {
        const status = (request.status ?? '').toLowerCase();
        if (status && status !== 'active' && status !== 'submitted' && status !== 'approved') {
          return false;
        }

        const iso = toIsoDate(request.date);
        if (!iso || !iso.startsWith(monthKey)) {
          return false;
        }

        if (selectedStaffId && request.staff_id) {
          if (String(request.staff_id) === String(selectedStaffId)) return true;
        }

        if (!request.name) return false;
        return request.name.trim().toLowerCase() === comparisonName;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [requests, selectedName, selectedStaffId, monthKey]);

  if (isLoading) {
    return (
      <section
        role="status"
        aria-live="polite"
        className="rounded-[24px] border border-[#E7E5E4] bg-white p-3.5 sm:p-4 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)] space-y-3"
      >
        <span className="sr-only">Loading personal request history...</span>
        <div className="flex items-center justify-between gap-2 pb-1">
          <Skeleton rounded="full" className="h-[30px] w-[30px] shrink-0" />
          <div className="flex flex-col items-center gap-1">
            <Skeleton rounded="full" className="h-4 w-32" />
            <Skeleton rounded="full" className="h-2.5 w-20" />
          </div>
          <Skeleton rounded="full" className="h-[30px] w-[30px] shrink-0" />
        </div>
        <div className="space-y-2.5">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-[#EFECE6] bg-[#FAF8F5] px-3.5 py-3"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Skeleton rounded="full" className="h-6 w-12 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton rounded="full" className="h-3.5 w-28" />
                  <Skeleton rounded="full" className="h-2.5 w-40 max-w-full" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Skeleton rounded="full" className="h-7 w-7" />
                <Skeleton rounded="full" className="h-7 w-7" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-[#E7E5E4] bg-white p-3.5 sm:p-4 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)] space-y-3">
      {/* Month Card Header Matching Prototype */}
      <header className="flex items-center justify-between gap-2 pb-1">
        <button
          type="button"
          onClick={() => onPrevMonth?.()}
          aria-label="Previous month"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] bg-[#FAF8F5] text-sm font-extrabold text-[#1C1917] transition hover:bg-[#EFECE6] cursor-pointer"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={() => onOpenMonthPicker?.()}
          title="Tap to pick month & year"
          className="cursor-pointer rounded-xl px-3 py-0.5 text-center transition hover:bg-[#FAF8F5]"
        >
          <span className="sr-only">Request History</span>
          <div className="text-[14px] sm:text-[15px] font-extrabold text-[#18181B]">
            {monthLabel} <span className="text-[11px] text-[#0F766E]">▾</span>
          </div>
          <p className="text-[10.5px] font-semibold text-[#78716C]">
            {filteredRequests.length} of {DEFAULT_MONTHLY_LIMIT} requests used
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNextMonth?.()}
          aria-label="Next month"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] bg-[#FAF8F5] text-sm font-extrabold text-[#1C1917] transition hover:bg-[#EFECE6] cursor-pointer"
        >
          ›
        </button>
      </header>

      {/* Sub-cards / Rows for Selected Month */}
      {!filteredRequests.length ? (
        <div className="rounded-[18px] border border-dashed border-[#D6D3D1] bg-[#FAF8F5] p-5 text-center text-xs font-semibold text-[#78716C]">
          No requests submitted for {monthLabel} yet. Tap a date in Calendar to add one.
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredRequests.map((request) => (
            <li
              key={request.id ?? `${request.name}-${request.date}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-[#EFECE6] bg-[#FAF8F5] px-3.5 py-2.5"
            >
              <button
                type="button"
                onClick={() => onEdit(request)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
              >
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${getShiftToneClasses(
                    request.request,
                  )}`}
                >
                  {request.request}
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-extrabold text-[#18181B]">
                    {formatDisplayDate(request.date)}
                  </div>
                  {request.comment ? (
                    <div className="truncate text-[11px] font-medium text-[#78716C]">
                      {request.comment}
                    </div>
                  ) : null}
                </div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onEdit(request)}
                  className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-1 text-[11px] font-bold text-[#0F766E] hover:border-[#0F766E] cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(request)}
                  className="rounded-full border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-bold text-[#B91C1C] hover:bg-rose-100 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
