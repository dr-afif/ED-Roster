import { useMemo, useState } from 'react';
import { getShiftToneClasses, Skeleton, useIsMobileViewport } from '@/shared/ui';
import { getMonthKey, toIsoDate, type RequestRecord } from '../domain/quota';

const REQUEST_CLASS_MAP: Record<string, string> = {
  am: 'req--am',
  oh: 'req--am',
  pm: 'req--pm',
  night: 'req--night',
  on: 'req--night',
  on1: 'req--night',
  on2: 'req--night',
  pn: 'req--night',
  nd: 'req--night',
  al: 'req--leave',
  el: 'req--leave',
  mc: 'req--leave',
  hka: 'req--leave',
  ghka: 'req--leave',
  course: 'req--course',
  court: 'req--course',
  medsb: 'req--course',
  off: 'req--off',
  goff: 'req--off',
  leave: 'req--off',
};

function buildDatesForMonth(referenceDate: Date) {
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

  const days = [];
  for (let day = 1; day <= end.getDate(); day += 1) {
    const dateObj = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), day);
    const key = toIsoDate(dateObj);
    days.push({
      key,
      dayNumber: day,
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
  selectedMonth?: Date;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onOpenMonthPicker?: () => void;
  onSelectDate?: (dateStr: string) => void;
}

export function RosterTable({
  names = [],
  requests = [],
  isLoadingNames = false,
  selectedMonth,
  onPrevMonth,
  onNextMonth,
  onOpenMonthPicker,
  onSelectDate,
}: RosterTableProps) {
  const isMobile = useIsMobileViewport(1023);
  const [monthOffset, setMonthOffset] = useState(0);

  const effectiveReferenceDate = useMemo(() => {
    if (selectedMonth) return selectedMonth;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1 + monthOffset, 1);
  }, [selectedMonth, monthOffset]);

  const monthKey = getMonthKey(effectiveReferenceDate);
  const shortMonthName = effectiveReferenceDate.toLocaleDateString('en-US', { month: 'short' });
  const dates = useMemo(() => buildDatesForMonth(effectiveReferenceDate), [effectiveReferenceDate]);

  const { requestMap, requestsByMemberMonth } = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    const byMember = new Map<string, Array<{ date: string; dayNum: number; code: string }>>();

    requests.forEach((req) => {
      const status = (req.status ?? '').toLowerCase();
      if (status && status !== 'active' && status !== 'submitted' && status !== 'approved') return;

      const nameKey = (req.name || '').trim().toLowerCase();
      const dateKey = toIsoDate(req.date);
      if (!nameKey || !dateKey) return;

      let userMap = map.get(nameKey);
      if (!userMap) {
        userMap = new Map<string, string>();
        map.set(nameKey, userMap);
      }
      userMap.set(dateKey, req.request);

      if (dateKey.startsWith(monthKey)) {
        const list = byMember.get(nameKey) ?? [];
        const dayNum = parseInt(dateKey.slice(8, 10), 10) || 1;
        list.push({ date: dateKey, dayNum, code: req.request });
        byMember.set(nameKey, list);
      }
    });

    for (const [k, list] of byMember.entries()) {
      list.sort((a, b) => a.dayNum - b.dayNum);
      byMember.set(k, list);
    }

    return { requestMap: map, requestsByMemberMonth: byMember };
  }, [requests, monthKey]);

  const monthLabel = effectiveReferenceDate.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const handlePrev = () => {
    if (onPrevMonth) onPrevMonth();
    else setMonthOffset((v) => v - 1);
  };

  const handleNext = () => {
    if (onNextMonth) onNextMonth();
    else setMonthOffset((v) => v + 1);
  };

  return (
    <section className="rounded-[24px] border border-[#E7E5E4] bg-white p-3.5 sm:p-4 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
      <header className="flex items-center justify-between gap-2 pb-2.5">
        <button
          type="button"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] bg-[#FAF8F5] text-sm font-extrabold text-[#1C1917] transition hover:bg-[#EFECE6] cursor-pointer active:scale-[0.92]"
          onClick={handlePrev}
          aria-label="Previous month"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onOpenMonthPicker?.()}
          title="Tap to pick month & year"
          className="cursor-pointer rounded-xl px-3 py-0.5 text-center transition hover:bg-[#FAF8F5]"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#78716C]">
            Roster Table View
          </p>
          <h2 className="text-[14px] sm:text-[15px] font-extrabold text-[#18181B]">
            {monthLabel} <span className="text-[11px] text-[#0F766E]">▾</span>
          </h2>
        </button>
        <button
          type="button"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] bg-[#FAF8F5] text-sm font-extrabold text-[#1C1917] transition hover:bg-[#EFECE6] cursor-pointer active:scale-[0.92]"
          onClick={handleNext}
          aria-label="Next month"
        >
          ›
        </button>
      </header>

      {isMobile ? (
        /* Mobile Per-MO Stacked Sub-Cards inside Month Card (Zero horizontal scroll!) */
        <div className="mt-2 space-y-2">
          {isLoadingNames ? (
            <div role="status" aria-live="polite" className="space-y-2">
              <span className="sr-only">Loading team members...</span>
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="rounded-[18px] border border-[#EFECE6] bg-[#FAF8F5] p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton rounded="full" className="h-3.5 w-24" />
                    <Skeleton rounded="full" className="h-5 w-14" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Skeleton rounded="full" className="h-6 w-20" />
                    <Skeleton rounded="full" className="h-6 w-16" />
                    <Skeleton rounded="full" className="h-6 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : !names.length ? (
            <div className="p-4 text-center text-xs text-[#78716C]">
              No active team members found.
            </div>
          ) : (
            names.map((name) => {
              const nameKey = name.trim().toLowerCase();
              const reqs = requestsByMemberMonth.get(nameKey) ?? [];
              return (
                <div key={name} className="rounded-[18px] border border-[#EFECE6] bg-[#FAF8F5] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-extrabold text-[#18181B]">{name}</span>
                    <span className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-0.5 text-[10px] font-extrabold text-[#57534E]">
                      {reqs.length} reqs
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {reqs.length > 0 ? (
                      reqs.map((r) => (
                        <button
                          key={`${name}-${r.date}-${r.code}`}
                          type="button"
                          onClick={() => onSelectDate?.(r.date)}
                          className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold cursor-pointer transition active:scale-[0.95] ${getShiftToneClasses(
                            r.code,
                          )}`}
                        >
                          {r.dayNum} {shortMonthName} · {r.code}
                        </button>
                      ))
                    ) : (
                      <span className="text-[11px] font-semibold text-[#A8A29E]">
                        No requests in {shortMonthName}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Desktop Interactive Matrix Table */
        <div className="mt-2 overflow-auto rounded-[16px] border border-[#EFECE6]">
          <table className="min-w-full border-separate border-spacing-0 text-[10px] sm:text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[#FAF8F5] px-2.5 py-2 text-left font-extrabold text-[#18181B] border-b border-r border-[#E7E5E4]">
                  Name
                </th>
                {dates.map((day) => (
                  <th
                    key={day.key}
                    className={`whitespace-nowrap border-b border-[#E7E5E4] px-2 py-1.5 text-center font-bold text-[#57534E] ${
                      isWeekend(day.raw) ? 'bg-[#FEF3C7]/70 text-[#B45309]' : 'bg-[#FAF8F5]'
                    }`}
                  >
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoadingNames ? (
                [0, 1, 2, 3, 4, 5].map((rowIdx) => (
                  <tr key={rowIdx}>
                    <td className="sticky left-0 z-10 border-b border-r border-[#E7E5E4] bg-white px-2.5 py-2">
                      <Skeleton rounded="full" className="h-3 w-20" />
                    </td>
                    {dates.map((day) => (
                      <td
                        key={day.key}
                        className="border-b border-r border-[#F4EFE6] px-1.5 py-2 text-center"
                      >
                        {day.raw.getDate() % 5 === rowIdx % 5 ? (
                          <Skeleton rounded="md" className="mx-auto h-4 w-7" />
                        ) : (
                          <span className="text-[10px] text-[#E7E5E4]">·</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : !names.length ? (
                <tr>
                  <td colSpan={dates.length + 1} className="p-4 text-center text-[#78716C]">
                    No active team members found.
                  </td>
                </tr>
              ) : (
                names.map((name) => {
                  const nameKey = name.trim().toLowerCase();
                  const userRow = requestMap.get(nameKey);

                  return (
                    <tr key={name}>
                      <th className="sticky left-0 z-10 bg-white px-2.5 py-1.5 text-left font-extrabold text-[#18181B] border-b border-r border-[#EFECE6]">
                        {name}
                      </th>
                      {dates.map((day) => {
                        const val = userRow?.get(day.key);
                        const variant = val ? getRequestVariant(val) : '';
                        return (
                          <td
                            key={day.key}
                            onClick={() => onSelectDate?.(day.key)}
                            className={`border-b border-[#EFECE6] px-1 py-1 text-center cursor-pointer transition hover:bg-[#F0FDFA] ${
                              isWeekend(day.raw) ? 'bg-[#FFFDF2]' : 'bg-white'
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
      )}
    </section>
  );
}
