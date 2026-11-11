import { useMemo, useState } from 'react';
import { DEFAULT_MONTHLY_LIMIT, getMonthLabel, type RequestRecord } from '../domain/quota';

function formatDisplayDate(dateLike: string | Date): string {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return String(dateLike);

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function getMonthToken(dateLike: string | Date): string | null {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export interface UserRequestsProps {
  requests: RequestRecord[];
  selectedName: string;
  selectedStaffId?: number;
  onEdit: (request: RequestRecord) => void;
  onDelete: (request: RequestRecord) => void;
  isLoading?: boolean;
}

export function UserRequests({
  requests = [],
  selectedName,
  selectedStaffId,
  onEdit,
  onDelete,
  isLoading = false,
}: UserRequestsProps) {
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  const filteredRequests = useMemo(() => {
    if (!selectedName && !selectedStaffId) return [];
    const comparisonName = (selectedName || '').trim().toLowerCase();

    return requests
      .filter((request) => {
        const status = (request.status ?? '').toLowerCase();
        if (status !== 'active' && status !== 'submitted' && status !== 'approved') {
          return false;
        }

        if (selectedStaffId && request.staff_id) {
          if (String(request.staff_id) === String(selectedStaffId)) return true;
        }

        if (!request.name) return false;
        return request.name.trim().toLowerCase() === comparisonName;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [requests, selectedName, selectedStaffId]);

  const groupedRequests = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; items: RequestRecord[] }>();

    filteredRequests.forEach((request) => {
      const token = getMonthToken(request.date) ?? 'unknown';
      let group = groups.get(token);
      if (!group) {
        group = {
          key: token,
          label: getMonthLabel(token),
          items: [],
        };
        groups.set(token, group);
      }
      group.items.push(request);
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.key === 'unknown') return 1;
      if (b.key === 'unknown') return -1;
      return a.key.localeCompare(b.key);
    });
  }, [filteredRequests]);

  const toggleGroup = (key: string) => {
    setCollapsedMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-5 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 animate-pulse">
          <div className="h-4 w-1/4 rounded-full bg-slate-200" />
          <div className="h-10 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!filteredRequests.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-medium text-slate-500">
        No active requests yet. Tap a date on the calendar above to create one.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="px-1 text-base font-bold text-slate-900">Request History</h3>
      {groupedRequests.map((group) => {
        const isExpanded = !collapsedMonths[group.key];
        const count = group.items.length;
        const isOverLimit = count >= DEFAULT_MONTHLY_LIMIT;

        let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (isOverLimit) {
          badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
        } else if (count >= DEFAULT_MONTHLY_LIMIT - 2) {
          badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
        }

        return (
          <div key={group.key} className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-900"
              onClick={() => toggleGroup(group.key)}
            >
              <div className="flex items-center gap-2">
                <span>{group.label}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${badgeColor}`}
                >
                  {count} / {DEFAULT_MONTHLY_LIMIT} used
                </span>
              </div>
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                {count} request{count === 1 ? '' : 's'}
                <span className="rounded-full border border-slate-300 px-2 py-0.5 text-slate-600">
                  {isExpanded ? '▾' : '▸'}
                </span>
              </span>
            </button>

            {isExpanded && (
              <ul className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3">
                {group.items.map((request) => {
                  return (
                    <li
                      key={request.id ?? `${request.name}-${request.date}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {formatDisplayDate(request.date)} |{' '}
                          <span className="text-indigo-700">{request.request}</span>
                        </p>
                        {request.comment && (
                          <p className="mt-0.5 max-w-lg text-xs text-slate-600">
                            {request.comment}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-amber-300 bg-amber-50/50 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                          onClick={() => onEdit(request)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-rose-300 bg-rose-50/50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                          onClick={() => onDelete(request)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
