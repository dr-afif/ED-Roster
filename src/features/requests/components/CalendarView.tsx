import { useMemo, useState } from 'react';
import { Skeleton } from '@/shared/ui';
import { toIsoDate, type RequestRecord } from '../domain/quota';

const DAY_LABELS = [
  { short: 'M', full: 'Mon' },
  { short: 'T', full: 'Tue' },
  { short: 'W', full: 'Wed' },
  { short: 'T', full: 'Thu' },
  { short: 'F', full: 'Fri' },
  { short: 'S', full: 'Sat' },
  { short: 'S', full: 'Sun' },
] as const;

const REQUEST_CLASS_MAP: Record<string, string> = {
  am: 'req--am',
  oh: 'req--am',
  pm: 'req--pm',
  on: 'req--night',
  on1: 'req--night',
  on2: 'req--night',
  nd: 'req--night',
  night: 'req--night',
  pn: 'req--night',
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

function buildCalendarMatrix(currentDate: Date): (Date | null)[][] {
  const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const daysInMonth = end.getDate();
  const firstWeekday = (start.getDay() + 6) % 7; // Monday = 0

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
  }
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailing; i += 1) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 1) {
    const wi = Math.floor(i / 7);
    if (!weeks[wi]) weeks[wi] = [];
    weeks[wi].push(cells[i] ?? null);
  }
  return weeks;
}

function getRequestVariant(value?: string | null): string {
  const token = (value ?? '').toString().trim().toLowerCase();
  if (!token) return 'req--default';
  if (REQUEST_CLASS_MAP[token]) return REQUEST_CLASS_MAP[token];
  if (token.includes('night')) return 'req--night';
  if (token.includes('course')) return 'req--course';
  if (token.includes('off') || token.includes('leave')) return 'req--off';
  return 'req--default';
}

export interface CalendarViewProps {
  requests: RequestRecord[];
  isLoading?: boolean;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  publicHolidays?: Array<{ holiday_date: string; name: string }>;
  selectedMonth?: Date;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onOpenMonthPicker?: () => void;
  onMonthChange?: (date: Date) => void;
}

export function CalendarView({
  requests,
  isLoading = false,
  selectedDate,
  onDateSelect,
  publicHolidays = [],
  selectedMonth,
  onPrevMonth,
  onNextMonth,
  onOpenMonthPicker,
  onMonthChange,
}: CalendarViewProps) {
  const [internalMonth, setInternalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  });

  const currentMonth = selectedMonth ?? internalMonth;

  const todayKey = useMemo(() => toIsoDate(new Date()), []);
  const selectedKey = selectedDate ? toIsoDate(selectedDate) : null;

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, string>();
    publicHolidays.forEach((h) => {
      map.set(toIsoDate(h.holiday_date), h.name);
    });
    return map;
  }, [publicHolidays]);

  const requestsByDate = useMemo(() => {
    return requests.reduce<Record<string, RequestRecord[]>>((acc, request) => {
      const status = (request.status ?? '').toLowerCase();
      if (status && status !== 'active' && status !== 'submitted' && status !== 'approved') {
        return acc;
      }
      const key = toIsoDate(request.date);
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(request);
      return acc;
    }, {});
  }, [requests]);

  const calendarWeeks = useMemo(() => buildCalendarMatrix(currentMonth), [currentMonth]);

  const monthTitle = currentMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const handlePrevMonth = () => {
    if (onPrevMonth) {
      onPrevMonth();
      return;
    }
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setInternalMonth(prev);
    onMonthChange?.(prev);
  };

  const handleNextMonth = () => {
    if (onNextMonth) {
      onNextMonth();
      return;
    }
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    setInternalMonth(next);
    onMonthChange?.(next);
  };

  return (
    <section
      className="calendar rounded-[24px] border border-[#E7E5E4] bg-white p-3 sm:p-4 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]"
      aria-label="Roster Request Calendar"
    >
      <header className="flex items-center justify-between gap-2 pb-2.5">
        <button
          type="button"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] bg-[#FAF8F5] text-sm font-extrabold text-[#1C1917] transition hover:bg-[#EFECE6] cursor-pointer active:scale-[0.92]"
          onClick={handlePrevMonth}
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
          <span className="sr-only">Roster Calendar</span>
          <div className="text-[14px] sm:text-[15px] font-extrabold text-[#18181B]">
            {monthTitle} <span className="text-[11px] text-[#0F766E]">▾</span>
          </div>
          <p className="text-[10.5px] font-semibold text-[#78716C]">
            Tap any date to view or add request
          </p>
        </button>

        <button
          type="button"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] bg-[#FAF8F5] text-sm font-extrabold text-[#1C1917] transition hover:bg-[#EFECE6] cursor-pointer active:scale-[0.92]"
          onClick={handleNextMonth}
          aria-label="Next month"
        >
          ›
        </button>
      </header>

      <div className="calendar__frame mt-1">
        <div className="calendar__header">
          {DAY_LABELS.map((label, idx) => (
            <div key={`${label.full}-${idx}`} className="calendar__header-cell">
              <span className="sm:hidden">{label.short}</span>
              <span className="hidden sm:inline">{label.full}</span>
            </div>
          ))}
        </div>

        <div className="calendar__grid">
          {calendarWeeks.flat().map((dateObj, index) => {
            if (!dateObj) {
              return (
                <div
                  key={`empty-${index}`}
                  className="calendar__cell calendar__cell--empty"
                  aria-hidden="true"
                />
              );
            }

            const dateKey = toIsoDate(dateObj);
            const dayRequests = requestsByDate[dateKey] ?? [];
            const dayNumber = dateObj.getDate();
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedKey;
            const holidayName = holidaysByDate.get(dateKey);
            const isHoliday = Boolean(holidayName);

            const cellClasses = [
              'calendar__cell',
              'calendar__cell--clickable',
              isToday ? 'calendar__cell--today' : '',
              isSelected ? 'calendar__cell--selected' : '',
              isHoliday ? 'calendar__cell--holiday' : '',
            ]
              .filter(Boolean)
              .join(' ');

            const dateClasses = [
              'calendar__date',
              isToday ? 'calendar__date--today' : '',
              isSelected ? 'calendar__date--selected' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={dateKey}
                type="button"
                className={cellClasses}
                onClick={() => onDateSelect(dateObj)}
                aria-pressed={isSelected}
                aria-label={`${dateObj.toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}${isHoliday ? ` - Public Holiday: ${holidayName}` : ''}`}
              >
                <div className="calendar__cell-header">
                  <span className={dateClasses}>{dayNumber}</span>
                  {holidayName ? (
                    <span
                      className="max-w-full truncate rounded-[4px] bg-[#FFE4E6] px-1 py-0.5 text-center text-[6.5px] sm:text-[8px] font-extrabold leading-[1.1] text-[#BE123C]"
                      title={holidayName}
                    >
                      {holidayName}
                    </span>
                  ) : null}
                </div>

                <div className="calendar__requests">
                  {isLoading && dayRequests.length === 0 ? (
                    <>
                      <Skeleton className="h-3.5 w-full" rounded="sm" />
                      {dayNumber % 2 === 0 ? (
                        <Skeleton className="h-3.5 w-3/4" rounded="sm" />
                      ) : null}
                    </>
                  ) : (
                    dayRequests.map((entry) => {
                      const variantClass = getRequestVariant(entry.request);
                      const isSaving = entry.isOptimistic;
                      const shortDoctor = (entry.name || '').replace(/^Dr\.?\s+/i, '');
                      const chipClasses = [
                        'req',
                        variantClass,
                        isSaving ? 'skeleton-shimmer opacity-80 ring-2 ring-[#0F766E]' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');

                      return (
                        <div
                          key={entry.id ?? `${entry.name}-${entry.date}-${entry.request}`}
                          className={chipClasses}
                          title={isSaving ? 'Saving...' : entry.comment || undefined}
                        >
                          <span className="req__tag">{entry.request}</span>
                          {shortDoctor ? <span className="req__name">{shortDoctor}</span> : null}
                          {entry.comment ? (
                            <span className="req__comment" role="tooltip">
                              {entry.comment}
                            </span>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
