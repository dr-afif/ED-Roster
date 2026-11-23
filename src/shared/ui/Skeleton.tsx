import type { HTMLAttributes } from 'react';

export type SkeletonRounded = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

const ROUNDED_CLASSES: Record<SkeletonRounded, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: SkeletonRounded;
}

/**
 * Base shimmering placeholder block using the warm editorial gradient surface.
 */
export function Skeleton({ className = '', rounded = 'lg', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer ${ROUNDED_CLASSES[rounded]} ${className}`.trim()}
      {...props}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

/**
 * Multi-line shimmering text stack.
 */
export function SkeletonText({
  lines = 3,
  className = '',
  lastLineWidth = 'w-2/3',
}: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={`space-y-2 ${className}`.trim()}>
      {Array.from({ length: Math.max(1, lines) }, (_, idx) => {
        const isLast = idx === lines - 1 && lines > 1;
        return (
          <Skeleton
            key={idx}
            rounded="full"
            className={`h-3 ${isLast ? lastLineWidth : 'w-full'}`}
          />
        );
      })}
    </div>
  );
}

export interface SkeletonPageFallbackProps {
  label?: string;
}

/**
 * Full-page Suspense fallback matching the warm editorial workspace layout.
 */
export function SkeletonPageFallback({
  label = 'Loading workspace view...',
}: SkeletonPageFallbackProps) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>

      {/* Header bar skeleton */}
      <div className="space-y-2 border-b border-[#E7E5E4] pb-3.5">
        <Skeleton rounded="full" className="h-2.5 w-32" />
        <Skeleton rounded="xl" className="h-7 w-56 max-w-full" />
        <Skeleton rounded="full" className="h-3 w-72 max-w-full" />
      </div>

      {/* 2-column KPI pill skeleton row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[20px] border border-[#E7E5E4] bg-white p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)] space-y-2">
          <Skeleton rounded="full" className="h-2.5 w-24" />
          <Skeleton rounded="xl" className="h-6 w-16" />
        </div>
        <div className="rounded-[20px] border border-[#E7E5E4] bg-white p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)] space-y-2">
          <Skeleton rounded="full" className="h-2.5 w-24" />
          <Skeleton rounded="xl" className="h-6 w-16" />
        </div>
      </div>

      {/* Main rounded content card skeleton */}
      <div className="rounded-[24px] border border-[#E7E5E4] bg-white p-5 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton rounded="full" className="h-4 w-44" />
          <Skeleton rounded="full" className="h-7 w-24" />
        </div>
        <SkeletonText lines={4} lastLineWidth="w-3/4" />
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <Skeleton rounded="2xl" className="h-14 w-full" />
          <Skeleton rounded="2xl" className="h-14 w-full" />
          <Skeleton rounded="2xl" className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}

export interface SkeletonCardListProps {
  count?: number;
  srLabel?: string;
  showHeader?: boolean;
  compact?: boolean;
}

/**
 * Stack of shimmering editorial cards for mobile lists, ledger entries, and batches.
 */
export function SkeletonCardList({
  count = 4,
  srLabel = 'Loading items...',
  showHeader = false,
  compact = false,
}: SkeletonCardListProps) {
  return (
    <div role="status" aria-live="polite" className="space-y-2.5">
      <span className="sr-only">{srLabel}</span>

      {showHeader ? (
        <div className="flex items-center justify-between px-1 pb-1">
          <Skeleton rounded="full" className="h-3.5 w-36" />
          <Skeleton rounded="full" className="h-5 w-16" />
        </div>
      ) : null}

      {Array.from({ length: Math.max(1, count) }, (_, idx) => (
        <div
          key={idx}
          className={`rounded-[20px] border border-[#E7E5E4] bg-white shadow-[0_2px_10px_rgba(28,25,23,0.03)] ${
            compact ? 'p-3' : 'p-4'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton rounded="full" className={`h-3.5 ${idx % 2 === 0 ? 'w-3/5' : 'w-1/2'}`} />
              <Skeleton rounded="full" className="h-2.5 w-4/5" />
            </div>
            <Skeleton rounded="full" className="h-6 w-16 shrink-0" />
          </div>
          {!compact ? (
            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-[#EFECE6]">
              <Skeleton rounded="full" className="h-5 w-16" />
              <Skeleton rounded="full" className="h-5 w-20" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export interface SkeletonTableCardProps {
  rows?: number;
  cols?: number;
  hasHeaderBar?: boolean;
  srLabel?: string;
}

/**
 * Editorial table card skeleton with shimmering header bar, column titles, and row cells.
 */
export function SkeletonTableCard({
  rows = 5,
  cols = 5,
  hasHeaderBar = true,
  srLabel = 'Loading table...',
}: SkeletonTableCardProps) {
  const safeRows = Math.max(1, rows);
  const safeCols = Math.max(1, cols);

  return (
    <div
      role={srLabel ? 'status' : undefined}
      aria-live={srLabel ? 'polite' : undefined}
      className="rounded-[24px] border border-[#E7E5E4] bg-white shadow-[0_2px_10px_rgba(28,25,23,0.03)] overflow-hidden"
    >
      {srLabel ? <span className="sr-only">{srLabel}</span> : null}

      {hasHeaderBar ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFECE6] bg-[#FAF8F5] px-4 py-3">
          <Skeleton rounded="full" className="h-3.5 w-44" />
          <Skeleton rounded="full" className="h-6 w-24" />
        </div>
      ) : null}

      <div className="overflow-x-auto no-scrollbar">
        <div className="min-w-full divide-y divide-[#EFECE6]">
          {/* Table column header skeleton */}
          <div
            className="grid gap-3 border-b border-[#EFECE6] bg-[#FAF8F5] px-4 py-2.5"
            style={{ gridTemplateColumns: `repeat(${safeCols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: safeCols }, (_, colIdx) => (
              <Skeleton
                key={colIdx}
                rounded="full"
                className={`h-2.5 ${colIdx === 0 ? 'w-20' : 'w-14'}`}
              />
            ))}
          </div>

          {/* Table rows skeleton */}
          {Array.from({ length: safeRows }, (_, rowIdx) => (
            <div
              key={rowIdx}
              className="grid items-center gap-3 px-4 py-3"
              style={{ gridTemplateColumns: `repeat(${safeCols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: safeCols }, (_, colIdx) => (
                <Skeleton
                  key={colIdx}
                  rounded={colIdx === safeCols - 1 ? 'full' : 'lg'}
                  className={
                    colIdx === 0
                      ? 'h-3.5 w-4/5'
                      : colIdx === safeCols - 1
                        ? 'h-5 w-16'
                        : 'h-3 w-3/4'
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface SkeletonRosterWorkspaceProps {
  label?: string;
}

/**
 * Matches RosterPeriodRoute: toolbar shimmer pills + sticky left Staff column + 10 visible day columns.
 */
export function SkeletonRosterWorkspace({
  label = 'Loading roster workspace...',
}: SkeletonRosterWorkspaceProps) {
  const dayCols = 10;
  const staffRows = 8;

  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>

      {/* Toolbar shimmer pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-[#E7E5E4] bg-white px-3.5 py-2.5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
        <div className="flex items-center gap-2">
          <Skeleton rounded="full" className="h-7 w-24" />
          <Skeleton rounded="full" className="h-7 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton rounded="full" className="h-7 w-20" />
          <Skeleton rounded="full" className="h-7 w-24" />
        </div>
      </div>

      {/* Prototype Matrix Card skeleton */}
      <div className="rounded-[20px] border border-[#E7E5E4] bg-white shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)] overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="border-b border-[#E7E5E4] bg-[#FAF8F5]">
                <th className="sticky left-0 z-10 w-[108px] min-w-[96px] border-r border-[#E7E5E4] bg-[#FAF8F5] px-2.5 py-2.5 text-left">
                  <Skeleton rounded="full" className="h-2.5 w-16" />
                </th>
                {Array.from({ length: dayCols }, (_, colIdx) => (
                  <th key={colIdx} className="min-w-[44px] border-r border-[#F4EFE6] px-1.5 py-2">
                    <div className="flex flex-col items-center gap-1">
                      <Skeleton rounded="full" className="h-2.5 w-4" />
                      <Skeleton rounded="full" className="h-2 w-6" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4EFE6]">
              {Array.from({ length: staffRows }, (_, rowIdx) => (
                <tr key={rowIdx}>
                  <th className="sticky left-0 z-10 w-[108px] min-w-[96px] border-r border-[#E7E5E4] bg-white px-2.5 py-2 text-left">
                    <Skeleton rounded="full" className="h-3 w-16" />
                  </th>
                  {Array.from({ length: dayCols }, (_, colIdx) => (
                    <td key={colIdx} className="border-r border-[#F4EFE6] p-[2px]">
                      <Skeleton rounded="md" className="mx-auto h-6 w-full min-w-[36px]" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export interface SkeletonPhTrackerViewProps {
  embedded?: boolean;
}

/**
 * Matches PublicHolidayTrackerRoute: compact pill toolbar + 2-column KPI cards + Holiday matrix card.
 */
export function SkeletonPhTrackerView({ embedded = false }: SkeletonPhTrackerViewProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={embedded ? 'space-y-4' : 'mx-auto px-4 py-6 md:px-8 max-w-7xl space-y-5'}
    >
      <span className="sr-only">Loading Public Holiday &amp; GHKA Tracker...</span>

      {/* Compact pill toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-[20px] border border-[#E7E5E4] bg-white px-3.5 py-2.5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
        <div className="flex items-center gap-2">
          <Skeleton rounded="full" className="h-7 w-36" />
          <Skeleton rounded="full" className="h-7 w-20" />
        </div>
        <Skeleton rounded="full" className="h-7 w-28" />
      </div>

      {/* 2-column top-accented KPI cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="flex items-center justify-between gap-3 rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#D97706] bg-white p-3.5 sm:p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
          <div className="space-y-1.5">
            <Skeleton rounded="full" className="h-3 w-20" />
            <Skeleton rounded="full" className="h-3 w-14" />
          </div>
          <Skeleton rounded="full" className="h-8 w-10 shrink-0" />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#0F766E] bg-white p-3.5 sm:p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
          <div className="space-y-1.5">
            <Skeleton rounded="full" className="h-3 w-20" />
            <Skeleton rounded="full" className="h-3 w-14" />
          </div>
          <Skeleton rounded="full" className="h-8 w-10 shrink-0" />
        </div>
      </div>

      {/* Holiday x Doctor matrix card skeleton */}
      <SkeletonTableCard rows={6} cols={4} hasHeaderBar srLabel="" />
    </div>
  );
}

/**
 * Matches MyProfileRoute: hero identity card + 2-column operational fields & contact form skeleton.
 */
export function SkeletonProfileView() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Fetching profile from database...</span>

      {/* Hero identity card */}
      <div className="rounded-[24px] border border-[#E7E5E4] bg-white p-5 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton rounded="full" className="h-14 w-14 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton rounded="full" className="h-4 w-44 max-w-full" />
            <Skeleton rounded="full" className="h-3 w-56 max-w-full" />
            <div className="flex gap-2 pt-0.5">
              <Skeleton rounded="full" className="h-5 w-16" />
              <Skeleton rounded="full" className="h-5 w-24" />
            </div>
          </div>
        </div>
      </div>

      {/* 2-column bento grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[24px] border border-[#E7E5E4] bg-white p-5 shadow-[0_2px_10px_rgba(28,25,23,0.03)] space-y-3.5">
          <Skeleton rounded="full" className="h-3.5 w-36" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, idx) => (
              <div
                key={idx}
                className="space-y-1.5 rounded-xl border border-[#EFECE6] bg-[#FAF8F5] p-3"
              >
                <Skeleton rounded="full" className="h-2.5 w-16" />
                <Skeleton rounded="full" className="h-3.5 w-24" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-[#E7E5E4] bg-white p-5 shadow-[0_2px_10px_rgba(28,25,23,0.03)] space-y-3.5">
          <Skeleton rounded="full" className="h-3.5 w-40" />
          {Array.from({ length: 3 }, (_, idx) => (
            <div key={idx} className="space-y-1.5">
              <Skeleton rounded="full" className="h-2.5 w-24" />
              <Skeleton rounded="xl" className="h-10 w-full" />
            </div>
          ))}
          <Skeleton rounded="full" className="h-10 w-40" />
        </div>
      </div>
    </div>
  );
}
