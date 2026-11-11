import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  FileEdit,
  History,
  Layers,
  Lock,
  ShieldAlert,
  Unlock,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
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
import { PublishModal } from '../components/PublishModal';
import { RosterCalendarView } from '../components/RosterCalendarView';
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
  useAmendmentEventsQuery,
  useBatchUpsertEpAssignmentsMutation,
  useDeleteDraftAssignmentMutation,
  useDraftAssignmentsQuery,
  usePlannedAssignmentsQuery,
  usePublicHolidaysQuery,
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
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
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

  const periodStatus = periodRow?.status ?? 'draft';
  const isDraft = periodStatus === 'draft';
  const isPublished = periodStatus === 'published' || periodStatus === 'amended';
  const isClosed = periodStatus === 'closed';

  // Grid cell interactability:
  // In draft mode: clicking cell opens ShiftPickerModal (for owner).
  // In published/amended mode (current view): clicking cell opens AmendRosterModal (for owner).
  // In planned view or closed status: strictly read-only.
  const isGridInteractive = isOwner && (isDraft || (isPublished && viewMode === 'current'));

  const handleCellSelect = (staff: StaffRosterIdentity, date: string, currentCode?: string) => {
    if (isDraft) {
      setSelectedCell({ staff, date, currentCode });
    } else if (isPublished && viewMode === 'current') {
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
          isDraft
            ? 'Interactive draft roster grid. Build and verify schedule assignments before official atomic publication.'
            : isClosed
              ? 'Closed operational period. Reconciled and sealed with immutable audit trail.'
              : 'Live operational schedule with active amendment overlay and GOFF compensatory rest tracking.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={periodStatus.toUpperCase()}
              tone={
                periodStatus === 'published' || periodStatus === 'amended'
                  ? 'success'
                  : periodStatus === 'closed'
                    ? 'neutral'
                    : 'brand'
              }
              icon={
                periodStatus === 'published' || periodStatus === 'amended'
                  ? CheckCircle2
                  : periodStatus === 'closed'
                    ? Lock
                    : CalendarRange
              }
            />

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

            {/* Owner Actions */}
            {isOwner && (
              <>
                {isDraft && (
                  <Button
                    variant="primary"
                    onClick={() => setIsPublishModalOpen(true)}
                    disabled={draftAssignments.length === 0}
                    className="gap-1.5"
                  >
                    <Lock className="h-4 w-4" />
                    Publish Roster
                  </Button>
                )}

                {isPublished && (
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

      {/* Roster Snapshot Archive & Telegram Dispatch */}
      {periodRow && !isDraft && (
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

      {/* Operational View Switcher (for Published/Amended/Closed periods) */}
      {!isDraft && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div className="inline-flex rounded-xl border border-border-default bg-surface-primary p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('current')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                viewMode === 'current'
                  ? 'bg-brand-primary text-text-inverse'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Live Schedule (Current)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('planned')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                viewMode === 'planned'
                  ? 'bg-brand-primary text-text-inverse'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              Original Planned
            </button>
            <button
              type="button"
              onClick={() => setViewMode('changes')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                viewMode === 'changes'
                  ? 'bg-brand-primary text-text-inverse'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Changes & Audit ({amendmentEvents.length})
            </button>
          </div>

          <div className="text-xs text-text-muted">
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-1 select-none">
          <div className="flex items-center gap-1">
            <button
              type="button"
              id="tab-btn-calendar"
              data-testid="tab-btn-calendar"
              onClick={() => setViewFormat('calendar')}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-bold transition -mb-px ${
                viewFormat === 'calendar'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-text-secondary hover:border-border-default hover:text-text-primary'
              }`}
            >
              <span>📅 Calendar View</span>
              <span className="text-[10px] font-normal text-text-muted hidden sm:inline">
                (Duty Timetable &amp; EP)
              </span>
            </button>
            <button
              type="button"
              id="tab-btn-table"
              data-testid="tab-btn-table"
              onClick={() => setViewFormat('table')}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-bold transition -mb-px ${
                viewFormat === 'table'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-text-secondary hover:border-border-default hover:text-text-primary'
              }`}
            >
              <span>📊 Table View</span>
              <span className="text-[10px] font-normal text-text-muted hidden sm:inline">
                (Spreadsheet &amp; Tallies)
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {viewFormat === 'table' && (
              <div className="inline-flex rounded-lg border border-border-default bg-surface-primary p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDensity('comfortable')}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    density === 'comfortable'
                      ? 'bg-brand-primary text-text-inverse'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Comfortable
                </button>
                <button
                  type="button"
                  onClick={() => setDensity('compact')}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    density === 'compact'
                      ? 'bg-brand-primary text-text-inverse'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Compact
                </button>
              </div>
            )}

            {rulesOutput && (
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="font-mono text-text-muted">
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
      {isPeriodLoading || isStaffLoading || (isPublished && isPlannedLoading) ? (
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

      {/* Shift Picker Modal (Draft Mode Only) */}
      {selectedCell && isDraft && (
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

      {/* Publish Modal */}
      {isPublishModalOpen && (
        <PublishModal
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          periodLabel={periodLabel}
          periodId={periodId}
          assignmentCount={draftAssignments.length}
          issueCount={rulesOutput?.issues.length ?? 0}
          ruleVersion={ruleVersionRow?.version ?? 1}
          onPublished={() => {
            setViewMode('current');
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
