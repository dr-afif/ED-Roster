import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileEdit,
  History,
  Layers,
  Lock,
  Printer,
  ShieldAlert,
  Table,
  Unlock,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/platform/auth';
import {
  FIRST_NATIVE_ROSTER_PERIOD,
  formatRosterPeriodLabel,
  isValidRosterYearMonth,
} from '@/shared/dates';
import { Button, PageHeader, SaveStatusBar, StatusBadge, SurfaceCard } from '@/shared/ui';
import { rosterRouteParamsSchema } from '@/shared/validation';
import { AmendmentHistoryList } from '../components/AmendmentHistoryList';
import { AmendRosterModal } from '../components/AmendRosterModal';
import { CloseReconcileModal } from '../components/CloseReconcileModal';
import { RosterCalendarView } from '../components/RosterCalendarView';
import { RosterExportModal } from '../components/RosterExportModal';
import { RosterGrid } from '../components/RosterGrid';
import { RosterIssuesPanel } from '../components/RosterIssuesPanel';
import { RosterSnapshotBar } from '../components/RosterSnapshotBar';
import { RosterTallyTables } from '../components/RosterTallyTables';
import { ShiftPickerModal } from '../components/ShiftPickerModal';
import {
  type DraftAssignmentRow,
  type PlannedAssignmentRow,
  type ShiftSemanticRow,
  type StaffingThresholdRow,
  useAllRosterPeriodsQuery,
  useAmendmentEventsQuery,
  useBatchUpsertEpAssignmentsMutation,
  useDeleteDraftAssignmentMutation,
  useDraftAssignmentsQuery,
  usePlannedAssignmentsQuery,
  usePublicHolidaysQuery,
  usePublishRosterMutation,
  useRosterEpAssignmentsQuery,
  useRosterPeriodQuery,
  useRosterStaffQuery,
  useRuleVersionQuery,
  useShiftDefinitionsQuery,
  useShiftSemanticsQuery,
  useStaffingThresholdsQuery,
  useUpsertDraftAssignmentMutation,
  useUpsertEpAssignmentMutation,
} from '../data/rosterQueries';
import { computeCurrentAssignments } from '../domain/amendments';
import { detectOffDisplacementGoffAccruals } from '../domain/goff';
import { evaluateRosterRules, getDatesInRange } from '../domain/rulesEngine';
import type {
  Assignment,
  PublicHolidayEntry,
  RosterIssue,
  RosterOperationalViewMode,
  RosterPeriod,
  StaffRosterIdentity,
  VersionedRuleConfiguration,
} from '../domain/types';

export function RosterPeriodRoute() {
  const navigate = useNavigate();
  const params = useParams();
  const parsed = rosterRouteParamsSchema.safeParse(params);
  const isPeriodValid = parsed.success && isValidRosterYearMonth(parsed.data.yyyy, parsed.data.mm);
  const yyyy = parsed.success ? parsed.data.yyyy : FIRST_NATIVE_ROSTER_PERIOD.year;
  const mm = parsed.success ? parsed.data.mm : FIRST_NATIVE_ROSTER_PERIOD.month;
  const periodLabel = formatRosterPeriodLabel(yyyy, mm);

  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [viewMode, setViewMode] = useState<RosterOperationalViewMode>('current');
  const [viewFormat, setViewFormat] = useState<'calendar' | 'table'>('table');

  // Modal control states
  const [isPdfExportModalOpen, setIsPdfExportModalOpen] = useState(false);
  const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [amendModalPrefill, setAmendModalPrefill] = useState<{
    staffId?: number;
    date?: string;
    shiftCode?: string;
  } | null>(null);

  // Selected cell for draft editing
  const [selectedCell, setSelectedCell] = useState<{
    staff: StaffRosterIdentity;
    date: string;
    currentCode?: string;
  } | null>(null);

  // Queries
  const { data: periodRow, isLoading: isPeriodLoading } = useRosterPeriodQuery(yyyy, mm);
  const { data: allPeriods = [] } = useAllRosterPeriodsQuery();
  const { data: staffList = [], isLoading: isStaffLoading } = useRosterStaffQuery();
  const { data: shiftDefinitions = [] } = useShiftDefinitionsQuery();
  const { data: shiftSemanticsRows = [] } = useShiftSemanticsQuery();
  const { data: ruleVersionRow } = useRuleVersionQuery(periodRow?.active_rule_version_id);
  const { data: thresholdsRows = [] } = useStaffingThresholdsQuery(ruleVersionRow?.id);
  const { data: draftAssignmentRows = [], isFetching: isDraftFetching } = useDraftAssignmentsQuery(
    periodRow?.id,
  );
  const { data: plannedAssignmentRows = [], isLoading: isPlannedLoading } =
    usePlannedAssignmentsQuery(periodRow?.id);
  const { data: amendmentEvents = [], isLoading: isAmendmentsLoading } = useAmendmentEventsQuery(
    periodRow?.id,
  );
  const { data: publicHolidays = [] } = usePublicHolidaysQuery();
  const { data: epAssignments = [] } = useRosterEpAssignmentsQuery(periodRow?.id);

  // Mutations
  const periodId = periodRow?.id ?? 0;
  const upsertMutation = useUpsertDraftAssignmentMutation(periodId);
  const deleteMutation = useDeleteDraftAssignmentMutation(periodId);
  const upsertEpMutation = useUpsertEpAssignmentMutation(periodId);
  const batchUpsertEpMutation = useBatchUpsertEpAssignmentsMutation(periodId);
  const publishMutation = usePublishRosterMutation(periodId);

  const handleMonthChange = (newYyyy: string, newMm: string) => {
    navigate(`/rosters/${newYyyy}/${newMm}`);
  };

  const handlePrevMonth = () => {
    const curDate = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, 1);
    curDate.setMonth(curDate.getMonth() - 1);
    const prevY = String(curDate.getFullYear());
    const prevM = String(curDate.getMonth() + 1).padStart(2, '0');
    handleMonthChange(prevY, prevM);
  };

  const handleNextMonth = () => {
    const curDate = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, 1);
    curDate.setMonth(curDate.getMonth() + 1);
    const nextY = String(curDate.getFullYear());
    const nextM = String(curDate.getMonth() + 1).padStart(2, '0');
    handleMonthChange(nextY, nextM);
  };

  // Compute period dates
  const periodDates = useMemo(() => {
    const lastDayOfMonth = new Date(Date.UTC(parseInt(yyyy, 10), parseInt(mm, 10), 0)).getUTCDate();
    const startDate = `${yyyy}-${mm}-01`;
    const endDate = `${yyyy}-${mm}-${String(lastDayOfMonth).padStart(2, '0')}`;
    return getDatesInRange(startDate, endDate);
  }, [yyyy, mm]);

  // Construct draft assignments
  const draftAssignments: Assignment[] = useMemo(() => {
    return draftAssignmentRows.map((r: DraftAssignmentRow) => ({
      staffId: r.staff_id,
      dutyDate: r.duty_date,
      shiftCode: r.shift_code,
      note: r.cell_note ?? undefined,
    }));
  }, [draftAssignmentRows]);

  // Construct planned assignments (frozen at publication)
  const plannedAssignments: Assignment[] = useMemo(() => {
    return plannedAssignmentRows.map((r: PlannedAssignmentRow) => ({
      staffId: r.staff_id,
      dutyDate: r.duty_date,
      shiftCode: r.shift_code,
      note: r.cell_note ?? undefined,
    }));
  }, [plannedAssignmentRows]);

  // Construct current assignments (planned + active amendments)
  const currentAssignments: Assignment[] = useMemo(() => {
    if (periodRow?.status === 'draft' || !periodRow) {
      return draftAssignments;
    }
    return computeCurrentAssignments(plannedAssignments, amendmentEvents);
  }, [periodRow, draftAssignments, plannedAssignments, amendmentEvents]);

  // Determine active assignments based on operational view mode
  const activeAssignments: Assignment[] = useMemo(() => {
    if (periodRow?.status === 'draft' || !periodRow) {
      return draftAssignments;
    }
    if (viewMode === 'planned') {
      return plannedAssignments;
    }
    return currentAssignments;
  }, [periodRow, draftAssignments, plannedAssignments, currentAssignments, viewMode]);

  // Construct rule configuration
  const ruleConfig: VersionedRuleConfiguration = useMemo(() => {
    const rawConfig = (ruleVersionRow?.config as Record<string, unknown>) ?? {};
    return {
      schemaVersion: Number(rawConfig.schema_version ?? 1),
      weeklyOffPolicy: (rawConfig.weekly_off_policy as 'policy_a' | 'policy_b') ?? 'policy_b',
      maxConsecutiveDays: Number(rawConfig.max_consecutive_days ?? 6),
      consecutiveWarningThreshold: Number(rawConfig.consecutive_warning_threshold ?? 7),
      nightQualifyingCodes: (rawConfig.night_qualifying_codes as string[]) ?? [
        'ON',
        'ON1',
        'ON2',
        'PN',
        'NIGHT',
      ],
      nightSequencePatterns: (rawConfig.night_sequence_patterns as string[][]) ?? [
        ['ON1', 'ON2', 'PN'],
        ['ON1', 'PN'],
        ['ON', 'PN'],
        ['NIGHT', 'PN'],
      ],
      requestDailyOffLimit: Number(rawConfig.request_daily_off_limit ?? 3),
      requestMonthlyLimit: Number(rawConfig.request_monthly_limit ?? 10),
      requestWeekendLimit: Number(rawConfig.request_weekend_limit ?? 4),
      minRestHoursAfterNight: Number(rawConfig.min_rest_hours_after_night ?? 24),
      staffingThresholds: thresholdsRows.map((t: StaffingThresholdRow) => ({
        dayType: t.day_type as 'weekday' | 'weekend' | 'holiday',
        shiftBucket: t.shift_bucket as 'am' | 'pm' | 'night' | 'total',
        minStaff: t.min_staff,
        targetStaff: t.target_staff,
      })),
      semantics: shiftSemanticsRows.map((s: ShiftSemanticRow) => ({
        shiftCode: s.shift_code,
        semanticClass: s.semantic_class as 'worked' | 'transparent' | 'reset' | 'unknown',
        providesCoverage: s.provides_coverage,
        nightPolicyBQualifying: s.night_policy_b_qualifying,
        displacesOffEarnsGoff: s.displaces_off_earns_goff,
      })),
    };
  }, [ruleVersionRow, thresholdsRows, shiftSemanticsRows]);

  // Evaluate rules on active assignments
  const domainPeriod: RosterPeriod = useMemo(() => {
    return {
      id: periodRow?.id ?? 1,
      periodStart: `${yyyy}-${mm}-01`,
      periodEnd: periodDates[periodDates.length - 1] ?? `${yyyy}-${mm}-31`,
      status: (periodRow?.status as 'draft' | 'published' | 'amended' | 'closed') ?? 'draft',
      revision: periodRow?.revision ?? 0,
      activeRuleVersionId: ruleVersionRow?.id,
    };
  }, [periodRow, yyyy, mm, periodDates, ruleVersionRow]);

  const rulesOutput = useMemo(() => {
    if (staffList.length === 0) return null;
    return evaluateRosterRules({
      period: domainPeriod,
      people: staffList,
      assignments: activeAssignments,
      holidays: publicHolidays as PublicHolidayEntry[],
      configuration: ruleConfig,
    });
  }, [domainPeriod, staffList, activeAssignments, publicHolidays, ruleConfig]);

  // Detect compensatory rest (GOFF) accrual candidates
  const accruedGoffCandidates = useMemo(() => {
    return detectOffDisplacementGoffAccruals(
      plannedAssignments,
      currentAssignments,
      ruleConfig.semantics ?? [],
    );
  }, [plannedAssignments, currentAssignments, ruleConfig.semantics]);

  const handleUpdateEpAssignment = (
    dutyDate: string,
    slotType: 'EP_OFFICE_HOUR' | 'EP_ONCALL',
    names: string,
  ) => {
    if (!isOwner) return;
    upsertEpMutation.mutate({
      dutyDate,
      slotType,
      physicianNames: names,
    });
  };

  const handleBatchUpdateEpAssignments = (
    payloads: Array<{
      dutyDate: string;
      slotType: 'EP_OFFICE_HOUR' | 'EP_ONCALL';
      physicianNames: string;
    }>,
  ) => {
    if (!isOwner) return;
    batchUpsertEpMutation.mutate(payloads);
  };

  const periodStartDate = `${yyyy}-${mm}-01`;
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isMonthArrived = todayStr >= periodStartDate;

  // Background auto-enforce effect:
  // Once the target month arrives, if the roster is still marked 'draft' with assignments,
  // promote it to published without requiring manual button clicks.
  const autoPublishAttemptedRef = useRef(false);
  useEffect(() => {
    if (
      isOwner &&
      isMonthArrived &&
      periodRow?.status === 'draft' &&
      periodRow?.id &&
      draftAssignments.length > 0 &&
      !publishMutation.isPending &&
      !autoPublishAttemptedRef.current
    ) {
      autoPublishAttemptedRef.current = true;
      publishMutation.mutate({ notes: 'Auto-enforced at month arrival' });
    }
  }, [isOwner, isMonthArrived, periodRow, draftAssignments.length, publishMutation]);

  if (!isPeriodValid) {
    const fallbackHref = `/rosters/${FIRST_NATIVE_ROSTER_PERIOD.year}/${FIRST_NATIVE_ROSTER_PERIOD.month}`;
    return (
      <SurfaceCard variant="solid" className="space-y-4">
        <div className="flex items-center gap-2 text-warning">
          <AlertTriangle className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          <h1 className="text-lg font-semibold text-text-primary">Invalid Roster Period URL</h1>
        </div>
        <p className="text-sm text-text-secondary">
          Roster URLs must specify a valid four-digit year and two-digit month (for example,{' '}
          <code className="font-mono text-text-primary">/rosters/2027/01</code>).
        </p>
        <Link
          to={fallbackHref}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover"
        >
          Go to January 2027 Roster
        </Link>
      </SurfaceCard>
    );
  }

  const isLegacyReadOnly = Boolean(periodRow?.legacy_read_only);
  const isClosed = !isLegacyReadOnly && periodRow?.status === 'closed';

  // Lifecycle state:
  // - Legacy read-only: historical ingested roster (locked)
  // - Closed: reconciled, completed period
  // - Enforced (active/amended): target month has arrived (today >= periodStartDate) or explicitly finalized
  // - Planning: pre-month drafting period where changes are direct shifts and not formal amendments
  const isEnforced =
    !isLegacyReadOnly &&
    !isClosed &&
    (isMonthArrived || periodRow?.status === 'published' || periodRow?.status === 'amended');
  const isPlanning = !isLegacyReadOnly && !isClosed && !isEnforced;

  const periodStatus = isLegacyReadOnly
    ? 'legacy (read-only)'
    : isClosed
      ? 'closed'
      : periodRow?.status === 'published' || periodRow?.status === 'amended'
        ? periodRow.status
        : isMonthArrived
          ? 'active'
          : 'planning';

  // Grid cell interactability:
  // In planning mode: clicking cell opens ShiftPickerModal (for owner direct draft editing).
  // In enforced mode (month arrived, current view): clicking cell opens AmendRosterModal (for owner).
  // In planned view, closed status, or legacy read-only mode: strictly read-only.
  const isGridInteractive =
    !isLegacyReadOnly && isOwner && !isClosed && (isPlanning || viewMode === 'current');

  const handleCellSelect = (staff: StaffRosterIdentity, date: string, currentCode?: string) => {
    if (isLegacyReadOnly || isClosed) return;
    if (isPlanning) {
      setSelectedCell({ staff, date, currentCode });
    } else if (isEnforced && viewMode === 'current') {
      setAmendModalPrefill({
        staffId: staff.id,
        date,
        shiftCode: currentCode,
      });
      setIsAmendModalOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Roster Workspace · ${yyyy}-${mm}`}
        title={`${periodLabel} Roster`}
        description={
          isLegacyReadOnly
            ? `Historical legacy schedule ingested from Google Sheets (Batch: ${periodRow?.import_batch_id ?? 'Rehearsal'}). Locked for auditing.`
            : isPlanning
              ? 'Pre-month planning schedule. Direct roster drafting without amendment overhead until the month arrives.'
              : isClosed
                ? 'Closed operational period. Reconciled and sealed with immutable audit trail.'
                : 'Live operational schedule with active amendment overlay and GOFF compensatory rest tracking.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={periodStatus.toUpperCase()}
              tone={
                isLegacyReadOnly
                  ? 'warning'
                  : isEnforced
                    ? 'success'
                    : isClosed
                      ? 'neutral'
                      : 'brand'
              }
              icon={
                isLegacyReadOnly
                  ? ShieldAlert
                  : isEnforced
                    ? CheckCircle2
                    : isClosed
                      ? Lock
                      : CalendarRange
              }
            />

            {!isLegacyReadOnly && (
              <SaveStatusBar
                state={
                  isDraftFetching || upsertMutation.isPending || deleteMutation.isPending
                    ? 'saving'
                    : 'saved'
                }
                label={
                  rulesOutput
                    ? `Checksum ${rulesOutput.checksum.slice(0, 8)} · Rule v${ruleVersionRow?.version ?? 1}`
                    : 'Ready'
                }
                revision={periodRow?.revision ?? 0}
              />
            )}

            {/* Live-Aligned Top Toolbar PDF Export */}
            <Button
              variant="secondary"
              onClick={() => setIsPdfExportModalOpen(true)}
              className="gap-1.5 shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer"
              aria-label="PDF Export"
              title="PDF Export & Print (Live App Format)"
            >
              <Printer className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span>PDF Export</span>
            </Button>

            {/* Owner Actions */}
            {isOwner && !isLegacyReadOnly && (
              <>
                {isEnforced && (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setAmendModalPrefill(null);
                        setIsAmendModalOpen(true);
                      }}
                      className="gap-1.5"
                    >
                      <FileEdit className="h-4 w-4" />
                      Amend Roster
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setIsCloseModalOpen(true)}
                      className="gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Close Period
                    </Button>
                  </>
                )}

                {isClosed && (
                  <Button
                    variant="secondary"
                    onClick={() => setIsCloseModalOpen(true)}
                    className="gap-1.5"
                  >
                    <Unlock className="h-4 w-4" />
                    Reopen Period
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* Month Navigator Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border-default bg-surface-primary p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-surface-secondary/70 text-text-primary hover:bg-surface-secondary transition"
            title="Previous Month"
            aria-label="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-secondary/40 px-3 py-1">
            <CalendarDays className="h-4 w-4 text-brand-primary shrink-0" />
            <input
              type="month"
              value={`${yyyy}-${mm}`}
              onChange={(e) => {
                if (!e.target.value) return;
                const [targetYear, targetMonth] = e.target.value.split('-');
                if (targetYear && targetMonth) {
                  handleMonthChange(targetYear, targetMonth);
                }
              }}
              className="bg-transparent font-semibold text-xs text-text-primary focus:outline-none cursor-pointer"
              title="Select Roster Month"
            />
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-surface-secondary/70 text-text-primary hover:bg-surface-secondary transition"
            title="Next Month"
            aria-label="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Existing Roster Periods Shortcut Chips */}
        {allPeriods.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1 scrollbar-none max-w-full">
            <span className="text-[11px] font-bold text-stone-400 shrink-0 uppercase tracking-wider">
              Periods:
            </span>
            {allPeriods.map((p) => {
              const [pYear, pMonth] = p.period_start.split('-');
              if (!pYear || !pMonth) return null;
              const isSelected = pYear === yyyy && pMonth === mm;
              return (
                <button
                  key={p.period_start}
                  type="button"
                  onClick={() => handleMonthChange(pYear, pMonth)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                  }`}
                >
                  <span>{formatRosterPeriodLabel(pYear, pMonth)}</span>
                  {p.legacy_read_only && (
                    <span className="rounded-full bg-amber-500/20 px-1.5 text-[9px] font-bold text-amber-900">
                      Legacy
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legacy Read-Only Historical Banner */}
      {isLegacyReadOnly && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-900 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="font-bold">Historical Google Sheets Roster (Read-Only Audit Archive)</p>
            <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-400">
              This schedule was ingested from legacy Google Sheets workbook (
              {periodRow?.import_batch_id ?? 'Rehearsal'}). It is preserved in read-only mode to
              safeguard historical audit evidence (ADR-002).
            </p>
          </div>
        </div>
      )}

      {/* Roster Document Archive & Telegram Dispatch */}
      {periodRow && (
        <RosterSnapshotBar
          periodId={periodRow.id}
          periodYear={yyyy}
          periodMonth={mm}
          periodStart={`${yyyy}-${mm}-01`}
          periodRevision={periodRow.revision}
          staffList={staffList}
          assignments={activeAssignments}
          shiftDefinitions={shiftDefinitions}
          epAssignments={epAssignments}
          holidays={publicHolidays as PublicHolidayEntry[]}
          isOwner={isOwner}
        />
      )}

      {/* Operational View Switcher (for Enforced / Active / Amended / Closed periods) */}
      {isEnforced && (
        <div className="flex flex-col gap-2 border-b border-border-subtle pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex overflow-x-auto scrollbar-none rounded-2xl border border-stone-200/80 bg-stone-100/80 p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('current')}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all ${
                viewMode === 'current'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Live Schedule (Current)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('planned')}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all ${
                viewMode === 'planned'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              Original Planned
            </button>
            <button
              type="button"
              onClick={() => setViewMode('changes')}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all ${
                viewMode === 'changes'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Changes &amp; Audit ({amendmentEvents.length})
            </button>
          </div>

          <div className="text-xs text-stone-500 hidden sm:block">
            {viewMode === 'current' &&
              (isOwner
                ? 'Showing live duty truth with active amendments. Click any cell to submit an amendment.'
                : 'Showing live operational duty truth.')}
            {viewMode === 'planned' &&
              'Showing immutable baseline frozen at publication time (Read-Only).'}
            {viewMode === 'changes' &&
              'Showing append-only audit trail of operational adjustments.'}
          </div>
        </div>
      )}

      {/* View Format Switcher: Calendar View vs Table View */}
      {viewMode !== 'changes' && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border-subtle pb-2 select-none">
          <div className="flex items-center gap-1">
            <button
              type="button"
              id="tab-btn-calendar"
              data-testid="tab-btn-calendar"
              onClick={() => setViewFormat('calendar')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewFormat === 'calendar'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>Calendar View</span>
              <span className="text-[10px] font-normal text-stone-300 hidden sm:inline">
                (Duty Timetable)
              </span>
            </button>
            <button
              type="button"
              id="tab-btn-table"
              data-testid="tab-btn-table"
              onClick={() => setViewFormat('table')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewFormat === 'table'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
              }`}
            >
              <Table className="h-3.5 w-3.5 shrink-0" />
              <span>Table View</span>
              <span className="text-[10px] font-normal text-stone-300 hidden sm:inline">
                (Spreadsheet)
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {viewFormat === 'table' && (
              <div className="inline-flex rounded-full border border-stone-200 bg-white p-0.5 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDensity('comfortable')}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                    density === 'comfortable'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  Comfortable
                </button>
                <button
                  type="button"
                  onClick={() => setDensity('compact')}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                    density === 'compact'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  Compact
                </button>
              </div>
            )}

            {rulesOutput && (
              <div className="flex items-center gap-2 text-xs text-stone-500 hidden md:flex">
                <span className="font-mono text-stone-400">
                  Policy:{' '}
                  {ruleConfig.weeklyOffPolicy === 'policy_b'
                    ? 'Policy B (Nights: 1 OFF / No Nights: 2 OFFs)'
                    : 'Policy A (1 OFF)'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isPeriodLoading || isStaffLoading || (isEnforced && isPlannedLoading) ? (
        <SurfaceCard variant="solid" className="p-8 text-center text-sm text-text-muted">
          Loading roster workspace for {periodLabel}...
        </SurfaceCard>
      ) : staffList.length === 0 ? (
        <SurfaceCard variant="solid" className="p-8 text-center space-y-3">
          <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
          <h2 className="text-base font-semibold text-text-primary">
            No Active Staff in Directory
          </h2>
          <p className="text-xs text-text-secondary">
            Add staff members in the Staff Directory before generating or editing the draft roster.
          </p>
          <Link
            to="/admin/staff"
            className="inline-flex items-center rounded-xl bg-brand-primary px-4 py-2 text-xs font-medium text-text-inverse hover:bg-brand-primary-hover"
          >
            Go to Staff Directory
          </Link>
        </SurfaceCard>
      ) : viewMode === 'changes' ? (
        /* Changes / Audit View */
        <AmendmentHistoryList
          periodId={periodId}
          isOwner={isOwner}
          staffList={staffList}
          events={amendmentEvents}
          isLoading={isAmendmentsLoading}
        />
      ) : viewFormat === 'calendar' ? (
        /* Calendar View (Duty Timetable & EP Coverage) */
        <RosterCalendarView
          periodDates={periodDates}
          staffList={staffList}
          assignments={activeAssignments}
          epAssignments={epAssignments}
          holidays={publicHolidays as PublicHolidayEntry[]}
          isEditable={isOwner}
          onUpdateEpAssignment={handleUpdateEpAssignment}
          onBatchUpdateEpAssignments={handleBatchUpdateEpAssignments}
        />
      ) : (
        /* Table Grid View & Tallies */
        <>
          <RosterGrid
            periodDates={periodDates}
            staffList={staffList}
            assignments={activeAssignments}
            shiftDefinitions={shiftDefinitions}
            holidays={publicHolidays as PublicHolidayEntry[]}
            density={density}
            isEditable={isGridInteractive}
            selectedCell={
              selectedCell ? { staffId: selectedCell.staff.id, date: selectedCell.date } : null
            }
            onSelectCell={handleCellSelect}
          />

          {/* Shift Distribution Tally & Individual Member Shift Tally */}
          <RosterTallyTables
            periodDates={periodDates}
            staffList={staffList}
            assignments={activeAssignments}
          />

          {/* Live Rules Guidance Panel */}
          {rulesOutput && (
            <RosterIssuesPanel
              issues={rulesOutput.issues}
              onSelectIssue={(issue: RosterIssue) => {
                if (issue.staffId && issue.date) {
                  const targetStaff = staffList.find((s) => s.id === issue.staffId);
                  if (targetStaff) {
                    const currentCode = activeAssignments.find(
                      (a) => a.staffId === issue.staffId && a.dutyDate === issue.date,
                    )?.shiftCode;
                    handleCellSelect(targetStaff, issue.date, currentCode);
                  }
                }
              }}
            />
          )}
        </>
      )}

      {/* Shift Picker Modal (Pre-Month Planning Mode Only) */}
      {selectedCell && isPlanning && (
        <ShiftPickerModal
          isOpen={Boolean(selectedCell)}
          staff={selectedCell.staff}
          date={selectedCell.date}
          currentCode={selectedCell.currentCode}
          shiftDefinitions={shiftDefinitions}
          onClose={() => setSelectedCell(null)}
          onSelectShift={(code) => {
            if (!periodId) return;
            upsertMutation.mutate({
              staffId: selectedCell.staff.id,
              dutyDate: selectedCell.date,
              shiftCode: code,
            });
          }}
          onClearShift={() => {
            if (!periodId) return;
            deleteMutation.mutate({
              staffId: selectedCell.staff.id,
              dutyDate: selectedCell.date,
            });
          }}
        />
      )}

      {/* Amend Roster Modal */}
      {isAmendModalOpen && (
        <AmendRosterModal
          isOpen={isAmendModalOpen}
          onClose={() => {
            setIsAmendModalOpen(false);
            setAmendModalPrefill(null);
          }}
          periodId={periodId}
          periodDates={periodDates}
          staffList={staffList}
          shiftDefinitions={shiftDefinitions}
          currentAssignments={currentAssignments}
          shiftSemantics={ruleConfig.semantics ?? []}
          initialStaffId={amendModalPrefill?.staffId}
          initialDate={amendModalPrefill?.date}
          initialShiftCode={amendModalPrefill?.shiftCode}
        />
      )}

      {/* Roster PDF Export Modal */}
      {isPdfExportModalOpen && periodRow && (
        <RosterExportModal
          isOpen={isPdfExportModalOpen}
          onClose={() => setIsPdfExportModalOpen(false)}
          periodYear={yyyy}
          periodMonth={mm}
          periodStart={periodRow.period_start}
          periodRevision={periodRow.revision ?? 0}
          staffList={staffList}
          assignments={activeAssignments}
          shiftDefinitions={shiftDefinitions}
          epAssignments={epAssignments}
          holidays={publicHolidays as PublicHolidayEntry[]}
        />
      )}

      {/* Close / Reconcile Modal */}
      {isCloseModalOpen && (
        <CloseReconcileModal
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          periodId={periodId}
          periodLabel={periodLabel}
          isClosed={isClosed}
          plannedCount={plannedAssignments.length}
          amendmentCount={amendmentEvents.length}
          accruedGoffCandidates={accruedGoffCandidates}
          staffList={staffList}
        />
      )}
    </div>
  );
}
