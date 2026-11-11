import { useMemo, useState } from 'react';
import { toIsoDate, type RequestRecord } from '../domain/quota';

const REQUEST_CLASS_MAP: Record<string, string> = {
  am: 'req--am',
  pm: 'req--pm',
  night: 'req--night',
  on: 'req--night',
  on1: 'req--night',
  course: 'req--course',
  off: 'req--off',
  leave: 'req--off',
  hka: 'req--hka',
  ghka: 'req--ghka',
  al: 'req--off',
};

function buildDatesForMonth(referenceDate: Date) {
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

  const days = [];
  for (let day = 1; day <= end.getDate(); day += 1) {
    const dateObj = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), day);
    const key = toIsoDate(dateObj);
    days.push({
      key,
      label: dateObj.toLocaleDateString(undefined, { day: 'numeric', weekday: 'short' }),
      raw: dateObj,
    });
  }
  return days;
}

function isWeekend(dateObj: Date) {
  const day = dateObj.getDay();
  return day === 0 || day === 6;
}

function getRequestVariant(value?: string | null) {
  const token = (value ?? '').toString().trim().toLowerCase();
  if (!token) return 'req--default';
  if (REQUEST_CLASS_MAP[token]) return REQUEST_CLASS_MAP[token];
  if (token.includes('night')) return 'req--night';
  if (token.includes('course')) return 'req--course';
  if (token.includes('off') || token.includes('leave')) return 'req--off';
  return 'req--default';
}

export interface RosterTableProps {
  names: string[];
  requests: RequestRecord[];
  isLoadingNames?: boolean;
}

export function RosterTable({
  names = [],
  requests = [],
  isLoadingNames = false,
}: RosterTableProps) {
  const [monthOffset, setMonthOffset] = useState(0);

  const effectiveReferenceDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1 + monthOffset, 1);
  }, [monthOffset]);

  const dates = useMemo(() => buildDatesForMonth(effectiveReferenceDate), [effectiveReferenceDate]);

  const requestMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    requests.forEach((req) => {
      const status = (req.status ?? '').toLowerCase();
      if (status !== 'active' && status !== 'submitted' && status !== 'approved') return;

      const nameKey = (req.name || '').trim().toLowerCase();
      const dateKey = toIsoDate(req.date);
      if (!nameKey || !dateKey) return;

      let userMap = map.get(nameKey);
      if (!userMap) {
        userMap = new Map<string, string>();
        map.set(nameKey, userMap);
      }
      userMap.set(dateKey, req.request);
    });
    return map;
  }, [requests]);

  const monthLabel = effectiveReferenceDate.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Roster Table View
          </p>
          <h2 className="text-xl font-bold text-slate-900">{monthLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            onClick={() => setMonthOffset((v) => v - 1)}
          >
            ‹ Prev
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            onClick={() => setMonthOffset((v) => v + 1)}
          >
            Next ›
          </button>
        </div>
      </header>

      <div className="mt-4 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-[10px] sm:text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2.5 py-2 text-left font-bold text-slate-900 shadow-sm ring-1 ring-slate-200">
                Name
              </th>
              {dates.map((day) => (
                <th
                  key={day.key}
                  className={`whitespace-nowrap border-b border-slate-200 px-2 py-1.5 text-center font-bold text-slate-700 ${
                    isWeekend(day.raw) ? 'bg-indigo-50/70' : ''
                  }`}
                >
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoadingNames ? (
              <tr>
                <td colSpan={dates.length + 1} className="p-4 text-center text-slate-500">
                  Loading team members...
                </td>
              </tr>
            ) : !names.length ? (
              <tr>
                <td colSpan={dates.length + 1} className="p-4 text-center text-slate-500">
                  No active team members found.
                </td>
              </tr>
            ) : (
              names.map((name) => {
                const nameKey = name.trim().toLowerCase();
                const userRow = requestMap.get(nameKey);

                return (
                  <tr key={name}>
                    <th className="sticky left-0 z-10 bg-white px-2.5 py-1.5 text-left font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200">
                      {name}
                    </th>
                    {dates.map((day) => {
                      const val = userRow?.get(day.key);
                      const variant = val ? getRequestVariant(val) : '';
                      return (
                        <td
                          key={day.key}
                          className={`border-b border-slate-100 px-1 py-1 text-center ${
                            isWeekend(day.raw) ? 'bg-slate-50/70' : ''
                          }`}
                        >
                          {val ? (
                            <span className={`req ${variant} text-[10px] px-1.5 py-0.5`}>
                              {val}
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
