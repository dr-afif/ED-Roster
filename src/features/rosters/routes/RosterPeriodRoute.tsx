import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarRange, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/platform/auth';
import {
  FIRST_NATIVE_ROSTER_PERIOD,
  formatRosterPeriodLabel,
  isValidRosterYearMonth,
} from '@/shared/dates';
import { PageHeader, SaveStatusBar, StatusBadge, SurfaceCard } from '@/shared/ui';
import { rosterRouteParamsSchema } from '@/shared/validation';
import { RosterGrid } from '../components/RosterGrid';
import { RosterIssuesPanel } from '../components/RosterIssuesPanel';
import { ShiftPickerModal } from '../components/ShiftPickerModal';
import {
  type DraftAssignmentRow,
  type ShiftSemanticRow,
  type StaffingThresholdRow,
  useDeleteDraftAssignmentMutation,
  useDraftAssignmentsQuery,
  usePublicHolidaysQuery,
  useRosterPeriodQuery,
  useRosterStaffQuery,
  useRuleVersionQuery,
  useShiftDefinitionsQuery,
  useShiftSemanticsQuery,
  useStaffingThresholdsQuery,
  useUpsertDraftAssignmentMutation,
} from '../data/rosterQueries';
import { evaluateRosterRules, getDatesInRange } from '../domain/rulesEngine';
import type {
  Assignment,
  PublicHolidayEntry,
  RosterIssue,
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
  const { data: publicHolidays = [] } = usePublicHolidaysQuery();

  // Mutations
  const periodId = periodRow?.id ?? 0;
  const upsertMutation = useUpsertDraftAssignmentMutation(periodId);
  const deleteMutation = useDeleteDraftAssignmentMutation(periodId);

  // Compute period dates
  const periodDates = useMemo(() => {
    const lastDayOfMonth = new Date(Date.UTC(parseInt(yyyy, 10), parseInt(mm, 10), 0)).getUTCDate();
    const startDate = `${yyyy}-${mm}-01`;
    const endDate = `${yyyy}-${mm}-${String(lastDayOfMonth).padStart(2, '0')}`;
    return getDatesInRange(startDate, endDate);
  }, [yyyy, mm]);

  // Construct domain assignments
  const domainAssignments: Assignment[] = useMemo(() => {
    return draftAssignmentRows.map((r: DraftAssignmentRow) => ({
      staffId: r.staff_id,
      dutyDate: r.duty_date,
      shiftCode: r.shift_code,
      note: r.cell_note ?? undefined,
    }));
  }, [draftAssignmentRows]);

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

  // Evaluate rules in real time
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
      assignments: domainAssignments,
      holidays: publicHolidays as PublicHolidayEntry[],
      configuration: ruleConfig,
    });
  }, [domainPeriod, staffList, domainAssignments, publicHolidays, ruleConfig]);

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

  const isEditable = isOwner && (periodRow?.status === 'draft' || !periodRow);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Roster Workspace · ${yyyy}-${mm}`}
        title={`${periodLabel} Roster`}
        description={
          isOwner
            ? 'Interactive draft roster grid. Click any cell to assign shifts with real-time rules verification and Policy-B weekly OFF enforcement.'
            : 'Viewing schedule. Only administrators can edit draft cell assignments.'
        }
        actions={
          <>
            <StatusBadge
              label={periodRow?.status ? periodRow.status.toUpperCase() : 'DRAFT'}
              tone={periodRow?.status === 'published' ? 'success' : 'brand'}
              icon={periodRow?.status === 'published' ? CheckCircle2 : CalendarRange}
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
          </>
        }
      />

      {/* Toolbar & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
        </div>

        {/* Status / Checksum badge */}
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

      {/* Loading state */}
      {isPeriodLoading || isStaffLoading ? (
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
      ) : (
        <>
          {/* Main 2D Matrix */}
          <RosterGrid
            periodDates={periodDates}
            staffList={staffList}
            assignments={domainAssignments}
            shiftDefinitions={shiftDefinitions}
            holidays={publicHolidays as PublicHolidayEntry[]}
            density={density}
            isEditable={isEditable}
            selectedCell={
              selectedCell ? { staffId: selectedCell.staff.id, date: selectedCell.date } : null
            }
            onSelectCell={(staff, date, currentCode) => {
              setSelectedCell({ staff, date, currentCode });
            }}
          />

          {/* Live Rules Guidance Panel */}
          {rulesOutput && (
            <RosterIssuesPanel
              issues={rulesOutput.issues}
              onSelectIssue={(issue: RosterIssue) => {
                if (issue.staffId && issue.date) {
                  const targetStaff = staffList.find((s) => s.id === issue.staffId);
                  if (targetStaff) {
                    setSelectedCell({
                      staff: targetStaff,
                      date: issue.date,
                      currentCode: domainAssignments.find(
                        (a) => a.staffId === issue.staffId && a.dutyDate === issue.date,
                      )?.shiftCode,
                    });
                  }
                }
              }}
            />
          )}

          {/* Shift Picker Modal */}
          {selectedCell && (
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
        </>
      )}
    </div>
  );
}
