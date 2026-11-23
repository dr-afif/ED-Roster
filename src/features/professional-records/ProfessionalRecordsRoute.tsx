import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Award, ChevronRight } from 'lucide-react';
import { useAuthBoundary } from '@/platform/auth';
import { calculateStaffGoffBalance } from '@/features/rosters';
import {
  useDraftAssignmentsQuery,
  useGoffLedgerQuery,
  usePlannedAssignmentsQuery,
  useRosterPeriodQuery,
} from '@/features/rosters/data/rosterQueries';
import { Modal, Skeleton, SkeletonCardList, stripShiftModifiers } from '@/shared/ui';
import { PublicHolidayTrackerRoute } from '../public-holidays/PublicHolidayTrackerRoute';
import { usePublicHolidayTracker } from '../public-holidays/usePublicHolidayTracker';

export function ProfessionalRecordsRoute() {
  const { user } = useAuthBoundary();
  const [searchParams, setSearchParams] = useSearchParams();
  const activePane: 'ph' | 'tally' = searchParams.get('pane') === 'tally' ? 'tally' : 'ph';

  const [isGoffLedgerOpen, setIsGoffLedgerOpen] = useState(false);

  const setActivePane = (pane: 'ph' | 'tally') => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('pane', pane);
        return next;
      },
      { replace: true },
    );
  };

  const userStaffId = user?.staffId;

  // Live PH & GHKA unclaimed credits for tab badge & My Tally card
  const { matched } = usePublicHolidayTracker('2027');
  const unclaimedGhkaCount = useMemo(() => {
    if (!userStaffId) return 0;
    return matched.filter((m) => m.staffId === userStaffId && m.status !== 'USED').length;
  }, [matched, userStaffId]);

  // Live January 2027 duty summary for My Tally
  const { data: periodRow, isLoading: isPeriodLoading } = useRosterPeriodQuery('2027', '01');
  const { data: draftAssignments = [], isLoading: isDraftLoading } = useDraftAssignmentsQuery(
    periodRow?.id,
  );
  const { data: plannedAssignments = [], isLoading: isPlannedLoading } = usePlannedAssignmentsQuery(
    periodRow?.id,
  );

  const periodStatus = periodRow?.status;
  const isPublished = periodStatus === 'published' || periodStatus === 'amended';
  const isTallyLoading = isPeriodLoading || (isPublished ? isPlannedLoading : isDraftLoading);

  const tallyStats = useMemo(() => {
    const published = periodStatus === 'published' || periodStatus === 'amended';
    const rows = published ? plannedAssignments : draftAssignments;
    const myRows = userStaffId ? rows.filter((r) => r.staff_id === userStaffId) : [];

    let am = 0;
    let pm = 0;
    let night = 0;
    let off = 0;
    let otherWorked = 0;

    for (const row of myRows) {
      const { cleanShift: code } = stripShiftModifiers(row.shift_code);
      if (code === 'AM') {
        am += 1;
      } else if (code === 'PM') {
        pm += 1;
      } else if (code === 'ON1' || code === 'ON2' || code === 'ON' || code === 'ND') {
        night += 1;
      } else if (code === 'OFF' || code === 'GOFF') {
        off += 1;
      } else if (code === 'OH' || code === 'MEDSB' || code === 'COURT') {
        otherWorked += 1;
      }
    }

    const totalHours = am * 8 + pm * 7 + night * 9 + otherWorked * 8;
    return { am, pm, night, off, totalHours };
  }, [periodStatus, plannedAssignments, draftAssignments, userStaffId]);

  // Live GOFF ledger & net balance
  const { data: goffEntries = [], isLoading: isGoffLoading } = useGoffLedgerQuery(
    userStaffId ?? undefined,
  );
  const goffSummary = useMemo(() => {
    if (!userStaffId) {
      return { opening: 0, earned: 0, used: 0, adjustments: 0, netBalance: 0 };
    }
    return calculateStaffGoffBalance(goffEntries, userStaffId);
  }, [goffEntries, userStaffId]);

  return (
    <div className="space-y-4">
      {/* Desktop Top Header */}
      <div className="hidden lg:flex flex-wrap items-center justify-between gap-4 border-b border-[#E7E5E4] pb-3.5">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#0F766E]">
            Emergency Department Workforce
          </div>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#18181B]">
            Records, Public Holidays &amp; GHKA
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[#57534E]">
            Monthly duty tallies, GHKA credits, and GOFF accrual balances
          </p>
        </div>
        <Link
          to="/rosters/2027/01"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#18181B] px-4 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-stone-800 transition"
        >
          <span>Enter Timetable</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* 2-Tab Sticky Sliding Pill Switch: PH & GHKA | My Tally */}
      <div className="sticky-subbar">
        <div
          role="tablist"
          aria-label="Records sections"
          className="relative grid grid-cols-2 rounded-full bg-[#EAE4DA] p-[3px] select-none"
        >
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-[#18181B] shadow-[0_3px_10px_rgba(0,0,0,0.16)] transition-transform duration-200 ${
              activePane === 'tally' ? 'translate-x-full' : 'translate-x-0'
            }`}
          />
          <button
            type="button"
            role="tab"
            aria-selected={activePane === 'ph'}
            onClick={() => setActivePane('ph')}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
              activePane === 'ph' ? 'text-white' : 'text-[#57534E]'
            }`}
          >
            <span>PH &amp; GHKA</span>
            {unclaimedGhkaCount > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none ${
                  activePane === 'ph' ? 'bg-[#E06D53] text-white' : 'bg-[#FDE68A] text-[#92400E]'
                }`}
              >
                {unclaimedGhkaCount}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePane === 'tally'}
            onClick={() => setActivePane('tally')}
            className={`relative z-10 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
              activePane === 'tally' ? 'text-white' : 'text-[#57534E]'
            }`}
          >
            My Tally
          </button>
        </div>
      </div>

      {/* TAB 1: PH & GHKA */}
      {activePane === 'ph' && <PublicHolidayTrackerRoute embedded />}

      {/* TAB 2: MY TALLY & BALANCES */}
      {activePane === 'tally' && (
        <div className="space-y-4">
          <div className="rounded-[26px] border border-[#E7E5E4] bg-white p-4 sm:p-5 shadow-[0_6px_22px_-6px_rgba(28,25,23,0.07)]">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#78716C]">
              Jan 2027 · Duty Summary
            </div>
            <div className="mt-1 mb-3 text-2xl font-extrabold text-[#18181B] tabular-nums">
              {isTallyLoading ? (
                <Skeleton rounded="xl" className="h-8 w-40" />
              ) : (
                `${tallyStats.totalHours} Duty Hours`
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-[14px] border border-[#C6D8B6] bg-[#E5EED8] py-2.5 px-1.5 text-[#2D4A22]">
                {isTallyLoading ? (
                  <Skeleton rounded="md" className="mx-auto mb-1 h-6 w-8" />
                ) : (
                  <div className="text-lg font-extrabold tabular-nums">{tallyStats.am}</div>
                )}
                <div className="text-[10px] font-bold">AM</div>
              </div>
              <div className="rounded-[14px] border border-[#B8CEF2] bg-[#DCE7F9] py-2.5 px-1.5 text-[#1E3A8A]">
                {isTallyLoading ? (
                  <Skeleton rounded="md" className="mx-auto mb-1 h-6 w-8" />
                ) : (
                  <div className="text-lg font-extrabold tabular-nums">{tallyStats.pm}</div>
                )}
                <div className="text-[10px] font-bold">PM</div>
              </div>
              <div className="rounded-[14px] border border-[#F8B9D4] bg-[#FCE7F1] py-2.5 px-1.5 text-[#9D174D]">
                {isTallyLoading ? (
                  <Skeleton rounded="md" className="mx-auto mb-1 h-6 w-8" />
                ) : (
                  <div className="text-lg font-extrabold tabular-nums">{tallyStats.night}</div>
                )}
                <div className="text-[10px] font-bold">ON1/2</div>
              </div>
              <div className="rounded-[14px] border border-[#E7E5E4] bg-[#F5F5F4] py-2.5 px-1.5 text-[#57534E]">
                {isTallyLoading ? (
                  <Skeleton rounded="md" className="mx-auto mb-1 h-6 w-8" />
                ) : (
                  <div className="text-lg font-extrabold tabular-nums">{tallyStats.off}</div>
                )}
                <div className="text-[10px] font-bold">OFF</div>
              </div>
            </div>
          </div>

          <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#A8A29E] px-0.5">
            Leave &amp; Replacement Balances
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => setIsGoffLedgerOpen(true)}
              className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-[#E7E5E4] bg-white px-4 py-3.5 text-left shadow-2xs hover:border-[#0F766E] transition cursor-pointer"
            >
              <div>
                <div className="text-[13.5px] font-extrabold text-[#18181B]">
                  GOFF Accrual Balance
                </div>
                <div className="text-xs font-semibold text-[#78716C]">
                  Protected weekly off displacements · Tap for ledger
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-full border border-[#FDE047] bg-[#FEF3C7] px-3 py-1 text-xs font-extrabold text-[#854D0E] tabular-nums">
                  {goffSummary.netBalance} {Math.abs(goffSummary.netBalance) === 1 ? 'Day' : 'Days'}
                </span>
                <ChevronRight className="h-4 w-4 text-[#78716C]" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActivePane('ph')}
              className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-[#E7E5E4] bg-white px-4 py-3.5 text-left shadow-2xs hover:border-[#0F766E] transition cursor-pointer"
            >
              <div>
                <div className="text-[13.5px] font-extrabold text-[#18181B]">
                  GHKA Replacement Credits
                </div>
                <div className="text-xs font-semibold text-[#78716C]">
                  {unclaimedGhkaCount > 0
                    ? `${unclaimedGhkaCount} unclaimed Public Holiday credit${unclaimedGhkaCount === 1 ? '' : 's'} ready`
                    : 'View Public Holiday credits & replacement claims'}
                </div>
              </div>
              <span className="rounded-full border border-[#A7F3D0] bg-[#D1FAE5] px-3 py-1 text-xs font-extrabold text-[#065F46] shrink-0">
                View PH &amp; GHKA →
              </span>
            </button>
          </div>
        </div>
      )}

      {/* GOFF Accrual Ledger Modal */}
      <Modal
        isOpen={isGoffLedgerOpen}
        onClose={() => setIsGoffLedgerOpen(false)}
        title="GOFF Accrual Ledger"
        description="Earned, used, and adjusted compensatory off-day credits"
        presentation="drawer"
        maxWidth="md"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsGoffLedgerOpen(false)}
              className="rounded-full bg-[#18181B] px-4 py-2 text-xs font-extrabold text-white hover:bg-stone-800 cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-2.5">
              <div className="text-[10px] font-extrabold uppercase text-[#78716C]">Opening</div>
              <div className="mt-0.5 text-base font-extrabold text-[#18181B] tabular-nums">
                {goffSummary.opening}
              </div>
            </div>
            <div className="rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] p-2.5">
              <div className="text-[10px] font-extrabold uppercase text-[#065F46]">Earned</div>
              <div className="mt-0.5 text-base font-extrabold text-[#0F766E] tabular-nums">
                +{goffSummary.earned}
              </div>
            </div>
            <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-2.5">
              <div className="text-[10px] font-extrabold uppercase text-[#92400E]">Used</div>
              <div className="mt-0.5 text-base font-extrabold text-[#B45309] tabular-nums">
                -{goffSummary.used}
              </div>
            </div>
            <div className="rounded-2xl border border-[#99F6E4] bg-[#F0FDFA] p-2.5">
              <div className="text-[10px] font-extrabold uppercase text-[#0F766E]">Balance</div>
              <div className="mt-0.5 text-base font-extrabold text-[#0F766E] tabular-nums">
                {goffSummary.netBalance}
              </div>
            </div>
          </div>

          {isGoffLoading ? (
            <SkeletonCardList count={3} compact srLabel="Loading GOFF transactions..." />
          ) : goffEntries.length === 0 ? (
            <div className="rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-6 text-center space-y-1.5">
              <Award className="mx-auto h-6 w-6 text-[#0F766E] opacity-70" />
              <div className="text-xs font-extrabold text-[#18181B]">
                No GOFF displacement entries yet
              </div>
              <p className="text-[11px] font-medium text-[#78716C]">
                Accruals are recorded automatically when a scheduled weekly OFF is displaced for ED
                coverage.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EFECE6] rounded-2xl border border-[#E7E5E4] bg-white overflow-hidden">
              {goffEntries.map((entry) => {
                const isCredit =
                  entry.transactionType === 'earned' ||
                  entry.transactionType === 'opening_balance' ||
                  (entry.transactionType === 'adjustment' && entry.amount >= 0);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-[#18181B] truncate">
                        {entry.reason}
                      </div>
                      <div className="text-[10.5px] font-semibold text-[#78716C]">
                        {entry.effectiveDate} · {entry.transactionType.replace('_', ' ')}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums ${
                        isCredit ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEF3C7] text-[#92400E]'
                      }`}
                    >
                      {entry.transactionType === 'used' || entry.transactionType === 'expired'
                        ? `-${entry.amount}`
                        : `+${entry.amount}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
