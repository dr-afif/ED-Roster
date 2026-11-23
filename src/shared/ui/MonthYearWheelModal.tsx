import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from './Modal';

const WHEEL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const WHEEL_YEARS = [2025, 2026, 2027, 2028, 2029] as const;
const ITEM_HEIGHT = 38;

export interface MonthYearWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  selectedYear: number;
  selectedMonth: number; // 1-12
  shortcutLabel?: string;
  shortcutYear?: number;
  shortcutMonth?: number; // 1-12
  onSelect: (year: number, month: number) => void;
}

export function MonthYearWheelModal({
  isOpen,
  onClose,
  title,
  subtitle = 'Scroll or tap month & year',
  selectedYear,
  selectedMonth,
  shortcutLabel = 'Upcoming',
  shortcutYear = 2027,
  shortcutMonth = 2,
  onSelect,
}: MonthYearWheelModalProps) {
  const [wheelMonthIdx, setWheelMonthIdx] = useState(Math.max(0, Math.min(11, selectedMonth - 1)));
  const [wheelYearIdx, setWheelYearIdx] = useState(() => {
    const found = WHEEL_YEARS.indexOf(selectedYear as (typeof WHEEL_YEARS)[number]);
    return found >= 0 ? found : 2;
  });

  const monthWheelRef = useRef<HTMLDivElement | null>(null);
  const yearWheelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const mIdx = Math.max(0, Math.min(11, selectedMonth - 1));
    const yIdxFound = WHEEL_YEARS.indexOf(selectedYear as (typeof WHEEL_YEARS)[number]);
    const yIdx = yIdxFound >= 0 ? yIdxFound : 2;

    const frameId = requestAnimationFrame(() => {
      setWheelMonthIdx(mIdx);
      setWheelYearIdx(yIdx);
      if (monthWheelRef.current) {
        monthWheelRef.current.scrollTop = mIdx * ITEM_HEIGHT;
      }
      if (yearWheelRef.current) {
        yearWheelRef.current.scrollTop = yIdx * ITEM_HEIGHT;
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [isOpen, selectedYear, selectedMonth]);

  const spinTo = (type: 'month' | 'year', idx: number) => {
    if (type === 'month') {
      const clamped = Math.max(0, Math.min(WHEEL_MONTHS.length - 1, idx));
      setWheelMonthIdx(clamped);
      if (monthWheelRef.current) {
        if (typeof monthWheelRef.current.scrollTo === 'function') {
          monthWheelRef.current.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' });
        } else {
          monthWheelRef.current.scrollTop = clamped * ITEM_HEIGHT;
        }
      }
    } else {
      const clamped = Math.max(0, Math.min(WHEEL_YEARS.length - 1, idx));
      setWheelYearIdx(clamped);
      if (yearWheelRef.current) {
        if (typeof yearWheelRef.current.scrollTo === 'function') {
          yearWheelRef.current.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' });
        } else {
          yearWheelRef.current.scrollTop = clamped * ITEM_HEIGHT;
        }
      }
    }
  };

  const handleShortcut = () => {
    const sMonthIdx = Math.max(0, Math.min(11, shortcutMonth - 1));
    const sYearIdx = WHEEL_YEARS.indexOf(shortcutYear as (typeof WHEEL_YEARS)[number]);
    spinTo('month', sMonthIdx);
    if (sYearIdx >= 0) {
      spinTo('year', sYearIdx);
    }
  };

  const handleConfirm = () => {
    const chosenYear = WHEEL_YEARS[wheelYearIdx] ?? 2027;
    const chosenMonth = wheelMonthIdx + 1;
    onSelect(chosenYear, chosenMonth);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={subtitle}
      maxWidth="sm"
      presentation="drawer"
      headerExtra={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShortcut}
            className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-1 text-[10.5px] font-bold text-[#57534E] hover:border-stone-400 hover:text-[#18181B] cursor-pointer"
          >
            {shortcutLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close month picker"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#E7E5E4] bg-white text-[#1C1917] hover:bg-[#FAF8F5] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full inline-flex items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#14867D,#0F766E)] px-4 py-3 text-[13px] font-extrabold text-white shadow-[0_8px_18px_rgba(15,118,110,0.28)] active:scale-[0.98] cursor-pointer"
        >
          Select Month
        </button>
      }
    >
      <div className="relative h-[190px] overflow-hidden rounded-[18px] border border-[#EFECE6] bg-[#FAF8F5]">
        {/* Center Active Selection Highlight Band */}
        <div className="pointer-events-none absolute left-2.5 right-2.5 top-[76px] z-1 h-[38px] rounded-[10px] border-y-[1.5px] border-[#0F766E] bg-[#0F766E]/[0.07]" />
        {/* Top & Bottom Fade Masks */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-2 h-16 bg-gradient-to-b from-[#FAF8F5] via-[#FAF8F5]/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-2 h-16 bg-gradient-to-t from-[#FAF8F5] via-[#FAF8F5]/80 to-transparent" />

        <div className="relative z-3 grid h-full grid-cols-[1.35fr_0.85fr]">
          {/* Month Column */}
          <div
            ref={monthWheelRef}
            onScroll={(e) => {
              const idx = Math.max(
                0,
                Math.min(11, Math.round(e.currentTarget.scrollTop / ITEM_HEIGHT)),
              );
              if (idx !== wheelMonthIdx) setWheelMonthIdx(idx);
            }}
            className="no-scrollbar h-full overflow-y-auto snap-y snap-mandatory py-[76px] box-border"
          >
            {WHEEL_MONTHS.map((mName, idx) => {
              const active = idx === wheelMonthIdx;
              return (
                <button
                  key={mName}
                  type="button"
                  onClick={() => spinTo('month', idx)}
                  className={`flex h-[38px] w-full items-center justify-center snap-center transition-all duration-150 cursor-pointer ${
                    active
                      ? 'text-[15.5px] font-extrabold text-[#0F766E] scale-[1.04]'
                      : 'text-[13px] font-semibold text-[#78716C] opacity-55 scale-[0.96]'
                  }`}
                >
                  {mName}
                </button>
              );
            })}
          </div>

          {/* Year Column */}
          <div
            ref={yearWheelRef}
            onScroll={(e) => {
              const idx = Math.max(
                0,
                Math.min(
                  WHEEL_YEARS.length - 1,
                  Math.round(e.currentTarget.scrollTop / ITEM_HEIGHT),
                ),
              );
              if (idx !== wheelYearIdx) setWheelYearIdx(idx);
            }}
            className="no-scrollbar h-full overflow-y-auto snap-y snap-mandatory border-l border-[#EFECE6] py-[76px] box-border"
          >
            {WHEEL_YEARS.map((yr, idx) => {
              const active = idx === wheelYearIdx;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => spinTo('year', idx)}
                  className={`flex h-[38px] w-full items-center justify-center snap-center transition-all duration-150 cursor-pointer ${
                    active
                      ? 'text-[15.5px] font-extrabold text-[#0F766E] scale-[1.04]'
                      : 'text-[13px] font-semibold text-[#78716C] opacity-55 scale-[0.96]'
                  }`}
                >
                  {yr}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
