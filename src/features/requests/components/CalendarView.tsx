import { useMemo, useState } from 'react';
import { toIsoDate, type RequestRecord } from '../domain/quota';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const REQUEST_CLASS_MAP: Record<string, string> = {
  am: 'req--am',
  pm: 'req--pm',
  night: 'req--night',
  on: 'req--night',
  on1: 'req--night',
  on2: 'req--night',
  course: 'req--course',
  off: 'req--off',
  leave: 'req--off',
  hka: 'req--hka',
  ghka: 'req--ghka',
  al: 'req--off',
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
    const cell = cells[i] ?? null;
    weeks[wi].push(cell);
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
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  publicHolidays?: Array<{ holiday_date: string; name: string }>;
  onMonthChange?: (date: Date) => void;
}

export function CalendarView({
  requests,
  selectedDate,
  onDateSelect,
  publicHolidays = [],
  onMonthChange,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    // Default to the upcoming month (1st of next month)
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  });

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
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setCurrentMonth(prev);
    onMonthChange?.(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    setCurrentMonth(next);
    onMonthChange?.(next);
  };

  const handleToday = () => {
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth(), 1);
    setCurrentMonth(target);
    onMonthChange?.(target);
  };

  return (
    <section
      className="calendar rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
      aria-label="Roster Request Calendar"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Roster Calendar
          </p>
          <h2 className="text-2xl font-bold text-slate-900">{monthTitle}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-300 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            onClick={handlePrevMonth}
            aria-label="Previous month"
          >
            ‹ Prev
          </button>
          <button
            type="button"
            className="rounded-full border border-indigo-300 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            onClick={handleToday}
          >
            Today
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-300 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            onClick={handleNextMonth}
            aria-label="Next month"
          >
            Next ›
          </button>
        </div>
      </header>

      <div className="calendar__frame mt-4">
        <div className="calendar__header">
          {DAY_LABELS.map((label) => (
            <div key={label} className="calendar__header-cell">
              {label}
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
                <div className="calendar__cell-header w-full flex-col items-start gap-0.5">
                  <div className="flex w-full items-start justify-between">
                    <span className={dateClasses}>{dayNumber}</span>
                  </div>
                  {holidayName && (
                    <span
                      className="mt-0.5 block max-w-full truncate rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-[8px] font-extrabold uppercase leading-none text-rose-600 sm:text-[9px]"
                      title={holidayName}
                    >
                      {holidayName}
                    </span>
                  )}
                </div>

                <div className="calendar__requests">
                  {dayRequests.map((entry) => {
                    const variantClass = getRequestVariant(entry.request);
                    const isSaving = entry.isOptimistic;
                    const chipClasses = [
                      'req',
                      variantClass,
                      isSaving ? 'animate-pulse opacity-60 ring-2 ring-indigo-400' : '',
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
                        {entry.name ? <span className="req__name">&bull; {entry.name}</span> : null}
                        {entry.comment ? (
                          <span className="req__comment" role="tooltip">
                            {entry.comment}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-slate-500">
        Tap any date to view or add a request
      </p>
    </section>
  );
}
