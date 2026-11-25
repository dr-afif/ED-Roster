import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Unlock,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { isAdminPtpoUser, isEpUser, useAuth } from '@/platform/auth';
import {
  FIRST_NATIVE_ROSTER_PERIOD,
  formatRosterPeriodLabel,
  getMalaysiaYearMonth,
  isValidRosterYearMonth,
  writeSessionRosterPeriod,
} from '@/shared/dates';
import {
  getShiftToneClasses,
  MonthYearWheelModal,
  SkeletonRosterWorkspace,
  SurfaceCard,
  useIsMobileViewport,
  useToast,
} from '@/shared/ui';
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
  useAmendmentEventsQuery,
  useBatchSaveDraftAssignmentsMutation,
  useBatchUpsertEpAssignmentsMutation,
  useDeleteDraftAssignmentMutation,
  useDraftAssignmentsQuery,
  usePeriodShiftRequestsQuery,
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
import { enrichSparseRosterForDisplay } from '../domain/prototypeFallback';
import { evaluateRosterRules, getDatesInRange } from '../domain/rulesEngine';
import {
  sortStaffByWorkMode,
  type Assignment,
  type PublicHolidayEntry,
  type RosterIssue,
  type RosterOperationalViewMode,
  type RosterPeriod,
  type StaffRosterIdentity,
  type VersionedRuleConfiguration,
} from '../domain/types';

const PALETTE_CODES = [
  'AM',
  'PM',
  'ON1',
  'ON2',
  'PN',
  'OFF',
  'GOFF',
  'AL',
  'MC',
  'EL',
  'HKA',
  'GHKA',
  'COURSE',
  'MEDSB',
  'OH',
  'COURT',
] as const;

type PaintHistoryEntry = {
  staffId: number;
  dutyDate: string;
  prevCode?: string;
  nextCode?: string;
};

export function RosterPeriodRoute() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const parsed = rosterRouteParamsSchema.safeParse(params);
  const isPeriodValid = parsed.success && isValidRosterYearMonth(parsed.data.yyyy, parsed.data.mm);
  const yyyy = isPeriodValid && parsed.success ? parsed.data.yyyy : FIRST_NATIVE_ROSTER_PERIOD.year;
  const mm = isPeriodValid && parsed.success ? parsed.data.mm : FIRST_NATIVE_ROSTER_PERIOD.month;
  const periodLabel = formatRosterPeriodLabel(yyyy, mm);

  const { user } = useAuth();
  const showToast = useToast();
  const isMobileViewport = useIsMobileViewport(1023);
  const isOwner = user?.role === 'owner';
  const isPtpoAdmin = isAdminPtpoUser(user);
  const isEp = isEpUser(user);
  const isRestrictedToCurrentAndPast = !isOwner && (isPtpoAdmin || isEp);
  const canExportRoster = isOwner || isPtpoAdmin;
  const currentMalaysiaPeriod = getMalaysiaYearMonth(new Date());
  const isFuturePeriod =
    Number(yyyy) > Number(currentMalaysiaPeriod.year) ||
    (Number(yyyy) === Number(currentMalaysiaPeriod.year) &&
      Number(mm) > Number(currentMalaysiaPeriod.month));
  const isAtMaxAllowedMonth =
    isRestrictedToCurrentAndPast &&
    (Number(yyyy) > Number(currentMalaysiaPeriod.year) ||
      (Number(yyyy) === Number(currentMalaysiaPeriod.year) &&
        Number(mm) >= Number(currentMalaysiaPeriod.month)));

  useEffect(() => {
    if (isRestrictedToCurrentAndPast && isFuturePeriod) {
      writeSessionRosterPeriod(currentMalaysiaPeriod.year, currentMalaysiaPeriod.month);
      navigate(`/rosters/${currentMalaysiaPeriod.year}/${currentMalaysiaPeriod.month}`, {
        replace: true,
      });
    }
  }, [
    isRestrictedToCurrentAndPast,
    isFuturePeriod,
    currentMalaysiaPeriod.year,
    currentMalaysiaPeriod.month,
    navigate,
  ]);

  const [viewMode, setViewMode] = useState<RosterOperationalViewMode>('current');
  const [viewFormatOverride, setViewFormatOverride] = useState<'calendar' | 'table' | null>(null);
  const viewFormat: 'calendar' | 'table' =
    viewFormatOverride ?? (isPtpoAdmin || isEp ? 'calendar' : 'table');
  const setViewFormat = setViewFormatOverride;
  const [isTableEditEnabled, setIsTableEditEnabled] = useState(false);
  const [rosterEditMode, setRosterEditMode] = useState<'normal' | 'fast' | 'standby' | 'extended'>(
    'normal',
  );
  const [quickPaintCode, setQuickPaintCode] = useState<string | null>(null);
  const [fastAnchor, setFastAnchor] = useState<{ staffIdx: number; dateIdx: number } | null>(null);
  const [fastFocus, setFastFocus] = useState<{ staffIdx: number; dateIdx: number } | null>(null);
  const [pendingFastEdits, setPendingFastEdits] = useState<Record<string, string>>({});
  const [isFastPaletteModalOpen, setIsFastPaletteModalOpen] = useState(false);
  const [paintUndoStack, setPaintUndoStack] = useState<PaintHistoryEntry[]>([]);
  const [paintRedoStack, setPaintRedoStack] = useState<PaintHistoryEntry[]>([]);
  const [isMonthWheelOpen, setIsMonthWheelOpen] = useState(false);
  const [isRotatedOverlayOpen, setIsRotatedOverlayOpen] = useState(false);

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
    initialNote?: string;
  } | null>(null);

  // Listen for Mobile App Header PDF Export Icon trigger & URL query actions
  useEffect(() => {
    const onOpenPdf = () => setIsPdfExportModalOpen(true);
    window.addEventListener('resq:open-roster-pdf', onOpenPdf);
    return () => window.removeEventListener('resq:open-roster-pdf', onOpenPdf);
  }, []);

  useEffect(() => {
    const action = searchParams.get('action');
    if (!action) return;
    queueMicrotask(() => {
      if (action === 'export') {
        setIsPdfExportModalOpen(true);
      } else if (action === 'close' && isOwner) {
        setIsCloseModalOpen(true);
      }
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    });
  }, [searchParams, setSearchParams, isOwner]);

  // Queries
  const { data: periodRow, isLoading: isPeriodLoading } = useRosterPeriodQuery(yyyy, mm);
  const { data: staffList = [], isLoading: isStaffLoading } = useRosterStaffQuery();
  const { data: rawShiftDefinitions = [] } = useShiftDefinitionsQuery();
  const shiftDefinitions = useMemo(() => {
    if (rawShiftDefinitions.some((s) => s.code.toUpperCase() === 'MEDSB')) {
      return rawShiftDefinitions;
    }
    return [
      ...rawShiftDefinitions,
      {
        code: 'MEDSB',
        label: 'Medical Standby',
        short_label: 'MEDSB',
        color_token: 'amber',
        duration_hours: 12,
        start_time: null,
        end_time: null,
        is_active: true,
        sort_order: 55,
        created_at: '',
        updated_at: '',
      },
    ];
  }, [rawShiftDefinitions]);
  const { data: shiftSemanticsRows = [] } = useShiftSemanticsQuery();
  const { data: ruleVersionRow } = useRuleVersionQuery(periodRow?.active_rule_version_id);
  const { data: thresholdsRows = [] } = useStaffingThresholdsQuery(ruleVersionRow?.id);
  const { data: draftAssignmentRows = [] } = useDraftAssignmentsQuery(periodRow?.id);
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
  const batchSaveDraftMutation = useBatchSaveDraftAssignmentsMutation(periodId);
  const upsertEpMutation = useUpsertEpAssignmentMutation(periodId);
  const batchUpsertEpMutation = useBatchUpsertEpAssignmentsMutation(periodId);
  const publishMutation = usePublishRosterMutation(periodId);

  const handleMonthChange = (newYyyy: string, newMm: string) => {
    writeSessionRosterPeriod(newYyyy, newMm);
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
    if (isAtMaxAllowedMonth) {
      return;
    }
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

  const { data: periodShiftRequests = [] } = usePeriodShiftRequestsQuery(
    periodDates[0],
    periodDates[periodDates.length - 1],
  );

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

  const moStaffList = useMemo(
    () =>
      sortStaffByWorkMode(
        staffList.filter(
          (s) =>
            !/^(EP|PTPO)-/i.test(s.staffCode) &&
            !/\bADMIN-PTPO\b/i.test(s.staffGroup ?? '') &&
            !(s.staffGroup ?? '').toLowerCase().startsWith('ep |'),
        ),
      ),
    [staffList],
  );

  const epStaffList = useMemo(
    () =>
      staffList.filter(
        (s) =>
          /^EP-/i.test(s.staffCode) || (s.staffGroup ?? '').toLowerCase().includes('physician'),
      ),
    [staffList],
  );

  const calendarStaffList = useMemo(
    () => [...moStaffList, ...epStaffList.filter((ep) => !moStaffList.some((m) => m.id === ep.id))],
    [moStaffList, epStaffList],
  );

  const enrichedDisplay = useMemo(
    () =>
      enrichSparseRosterForDisplay(
        moStaffList,
        activeAssignments,
        periodDates,
        periodShiftRequests,
      ),
    [moStaffList, activeAssignments, periodDates, periodShiftRequests],
  );

  const amendedCellKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const ev of amendmentEvents) {
      if (ev.status !== 'active') continue;
      for (const line of ev.lines) {
        keys.add(`${line.staffId}:${line.dutyDate}`);
      }
    }
    return keys;
  }, [amendmentEvents]);

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
    if (moStaffList.length === 0) return null;
    return evaluateRosterRules({
      period: domainPeriod,
      people: moStaffList,
      assignments: activeAssignments,
      holidays: publicHolidays as PublicHolidayEntry[],
      configuration: ruleConfig,
    });
  }, [domainPeriod, moStaffList, activeAssignments, publicHolidays, ruleConfig]);

  const accruedGoffCandidates = useMemo(() => {
    return detectOffDisplacementGoffAccruals(
      plannedAssignments,
      currentAssignments,
      ruleConfig.semantics ?? [],
    );
  }, [plannedAssignments, currentAssignments, ruleConfig.semantics]);

  const handleSaveError = useCallback(
    (err: unknown) => {
      const errObj =
        typeof err === 'object' && err !== null
          ? (err as { message?: string; code?: string })
          : null;
      const rawMsg =
        err instanceof Error ? err.message : errObj?.message || 'Failed to save roster change';
      const code = errObj?.code ? ` (${errObj.code})` : '';
      const isRls = /row-level security|permission denied|42501|unauthorized/i.test(
        `${rawMsg} ${errObj?.code ?? ''}`,
      );
      showToast(
        isRls
          ? `Save blocked by permissions (${user?.email ?? 'no owner session'}): ${rawMsg}`
          : `Save failed${code}: ${rawMsg}`,
      );
    },
    [showToast, user?.email],
  );

  useEffect(() => {
    const err =
      upsertMutation.error ??
      deleteMutation.error ??
      batchSaveDraftMutation.error ??
      upsertEpMutation.error ??
      batchUpsertEpMutation.error;
    if (err) {
      handleSaveError(err);
    }
  }, [
    upsertMutation.error,
    deleteMutation.error,
    batchSaveDraftMutation.error,
    upsertEpMutation.error,
    batchUpsertEpMutation.error,
    handleSaveError,
  ]);

  const handleUpdateEpAssignment = (
    dutyDate: string,
    slotType: 'EP_OFFICE_HOUR' | 'EP_ONCALL' | 'EP_PASSIVE',
    names: string,
  ) => {
    if (!isOwner) return;
    if (!periodId) {
      showToast('No roster period record found for this month');
      return;
    }
    upsertEpMutation.mutate({
      dutyDate,
      slotType,
      physicianNames: names,
    });
  };

  const handleBatchUpdateEpAssignments = (
    payloads: Array<{
      dutyDate: string;
      slotType: 'EP_OFFICE_HOUR' | 'EP_ONCALL' | 'EP_PASSIVE';
      physicianNames: string;
    }>,
  ) => {
    if (!isOwner) return;
    if (!periodId) {
      showToast('No roster period record found for this month');
      return;
    }
    batchUpsertEpMutation.mutate(payloads);
  };

  const periodStartDate = `${yyyy}-${mm}-01`;
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isMonthArrived = todayStr >= periodStartDate;

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

  const isLegacyReadOnly = Boolean(periodRow?.legacy_read_only);
  const isClosed = !isLegacyReadOnly && periodRow?.status === 'closed';
  const isEnforced =
    !isLegacyReadOnly &&
    !isClosed &&
    (isMonthArrived || periodRow?.status === 'published' || periodRow?.status === 'amended');
  const isPlanning = !isLegacyReadOnly && !isClosed && !isEnforced;

  const periodStatusLabel = isLegacyReadOnly
    ? 'Legacy (Read-Only)'
    : isClosed
      ? 'Closed'
      : isEnforced
        ? 'Published'
        : 'Planning';

  const isGridInteractive =
    !isLegacyReadOnly && isOwner && !isClosed && (isPlanning || viewMode === 'current');

  const recordPaintAction = (entry: PaintHistoryEntry) => {
    setPaintUndoStack((prev) => [...prev, entry]);
    setPaintRedoStack([]);
  };

  const handleUndoPaint = () => {
    const last = paintUndoStack[paintUndoStack.length - 1];
    if (!last) return;
    setPaintUndoStack((prev) => prev.slice(0, -1));
    setPaintRedoStack((prev) => [...prev, last]);
    if (last.prevCode) {
      upsertMutation.mutate({
        staffId: last.staffId,
        dutyDate: last.dutyDate,
        shiftCode: last.prevCode,
      });
    } else {
      deleteMutation.mutate({ staffId: last.staffId, dutyDate: last.dutyDate });
    }
    showToast('Undid shift change');
  };

  const handleRedoPaint = () => {
    const last = paintRedoStack[paintRedoStack.length - 1];
    if (!last) return;
    setPaintRedoStack((prev) => prev.slice(0, -1));
    setPaintUndoStack((prev) => [...prev, last]);
    if (last.nextCode) {
      upsertMutation.mutate({
        staffId: last.staffId,
        dutyDate: last.dutyDate,
        shiftCode: last.nextCode,
      });
    } else {
      deleteMutation.mutate({ staffId: last.staffId, dutyDate: last.dutyDate });
    }
    showToast('Redid shift change');
  };

  const fastSelectedRangeKeys = useMemo(() => {
    const keys = new Set<string>();
    if (rosterEditMode !== 'fast' || !fastFocus) return keys;
    const anchor = fastAnchor ?? fastFocus;
    const minRow = Math.min(anchor.staffIdx, fastFocus.staffIdx);
    const maxRow = Math.max(anchor.staffIdx, fastFocus.staffIdx);
    const minCol = Math.min(anchor.dateIdx, fastFocus.dateIdx);
    const maxCol = Math.max(anchor.dateIdx, fastFocus.dateIdx);
    for (let r = minRow; r <= maxRow; r += 1) {
      const s = enrichedDisplay.staffList[r];
      if (!s || s.id < 0) continue;
      for (let c = minCol; c <= maxCol; c += 1) {
        const d = periodDates[c];
        if (!d) continue;
        keys.add(`${s.id}:${d}`);
      }
    }
    return keys;
  }, [rosterEditMode, fastAnchor, fastFocus, enrichedDisplay.staffList, periodDates]);

  const dirtyCellKeys = useMemo(() => new Set(Object.keys(pendingFastEdits)), [pendingFastEdits]);

  const tableAssignments = useMemo(() => {
    if (Object.keys(pendingFastEdits).length === 0) return enrichedDisplay.assignments;
    const map = new Map<string, Assignment>();
    for (const a of enrichedDisplay.assignments) {
      map.set(`${a.staffId}:${a.dutyDate}`, a);
    }
    for (const [key, code] of Object.entries(pendingFastEdits)) {
      if (code === '') {
        map.delete(key);
      } else {
        const [sidStr, dStr] = key.split(':');
        const staffId = Number(sidStr);
        const existing = map.get(key);
        map.set(key, {
          staffId,
          dutyDate: dStr ?? '',
          shiftCode: code,
          note: existing?.note,
        });
      }
    }
    return Array.from(map.values());
  }, [enrichedDisplay.assignments, pendingFastEdits]);

  const stageFastEditForKeys = useCallback((keys: Iterable<string>, shiftCode: string) => {
    setPendingFastEdits((prev) => {
      const next = { ...prev };
      for (const k of keys) {
        next[k] = shiftCode;
      }
      return next;
    });
  }, []);

  const handleSaveFastEdits = useCallback(() => {
    const entries = Object.entries(pendingFastEdits);
    if (entries.length === 0 || !periodId) return;
    const upserts: Array<{ staffId: number; dutyDate: string; shiftCode: string }> = [];
    const deletes: Array<{ staffId: number; dutyDate: string }> = [];
    for (const [key, code] of entries) {
      const [sidStr, dutyDate] = key.split(':');
      const staffId = Number(sidStr);
      if (!Number.isFinite(staffId) || !dutyDate) continue;
      if (code === '') {
        deletes.push({ staffId, dutyDate });
      } else {
        upserts.push({ staffId, dutyDate, shiftCode: code });
      }
    }
    batchSaveDraftMutation.mutate(
      { upserts, deletes },
      {
        onSuccess: () => {
          setPendingFastEdits({});
          showToast(`Saved ${entries.length} roster change${entries.length === 1 ? '' : 's'}`);
        },
      },
    );
  }, [pendingFastEdits, periodId, batchSaveDraftMutation, showToast]);

  useEffect(() => {
    if (
      !isTableEditEnabled ||
      rosterEditMode !== 'fast' ||
      !isPlanning ||
      viewFormat !== 'table' ||
      isFastPaletteModalOpen ||
      selectedCell ||
      isAmendModalOpen ||
      isCloseModalOpen ||
      isPdfExportModalOpen
    ) {
      return;
    }

    const KEY_TO_SHIFT: Record<string, string> = {
      a: 'AM',
      p: 'PM',
      o: 'OFF',
      '1': 'ON1',
      '2': 'ON2',
      n: 'PN',
      h: 'HKA',
      g: 'GOFF',
      m: 'MEDSB',
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        setFastAnchor(null);
        setFastFocus(null);
        return;
      }

      if (!fastFocus) return;

      const maxRow = enrichedDisplay.staffList.length - 1;
      const maxCol = periodDates.length - 1;
      if (maxRow < 0 || maxCol < 0) return;

      if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
      ) {
        e.preventDefault();
        const dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        const dc = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        const nextFocus = {
          staffIdx: Math.max(0, Math.min(maxRow, fastFocus.staffIdx + dr)),
          dateIdx: Math.max(0, Math.min(maxCol, fastFocus.dateIdx + dc)),
        };
        setFastFocus(nextFocus);
        if (!e.shiftKey) {
          setFastAnchor(nextFocus);
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        setIsFastPaletteModalOpen(true);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (fastSelectedRangeKeys.size > 0) {
          stageFastEditForKeys(fastSelectedRangeKeys, '');
        }
        return;
      }

      const mapped = KEY_TO_SHIFT[e.key.toLowerCase()];
      if (mapped && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (fastSelectedRangeKeys.size > 0) {
          stageFastEditForKeys(fastSelectedRangeKeys, mapped);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isTableEditEnabled,
    rosterEditMode,
    isPlanning,
    viewFormat,
    isFastPaletteModalOpen,
    selectedCell,
    isAmendModalOpen,
    isCloseModalOpen,
    isPdfExportModalOpen,
    fastFocus,
    enrichedDisplay.staffList.length,
    periodDates.length,
    fastSelectedRangeKeys,
    stageFastEditForKeys,
  ]);

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

  const handleCellSelect = (
    staff: StaffRosterIdentity,
    date: string,
    currentCode?: string,
    shiftKey?: boolean,
  ) => {
    if (isLegacyReadOnly || isClosed || staff.id < 0 || !isOwner) return;
    if (!isTableEditEnabled) {
      showToast('Tap "Edit Roster" to edit');
      return;
    }

    if (isEnforced && viewMode === 'current') {
      setAmendModalPrefill({
        staffId: staff.id,
        date,
        shiftCode: currentCode,
      });
      setIsAmendModalOpen(true);
      return;
    }

    if (rosterEditMode === 'fast' && isPlanning) {
      const staffIdx = enrichedDisplay.staffList.findIndex((s) => s.id === staff.id);
      const dateIdx = periodDates.indexOf(date);
      if (staffIdx >= 0 && dateIdx >= 0) {
        const nextFocus = { staffIdx, dateIdx };
        setFastFocus(nextFocus);
        const anchor = shiftKey && fastAnchor ? fastAnchor : nextFocus;
        if (!shiftKey || !fastAnchor) {
          setFastAnchor(nextFocus);
        }
        if (quickPaintCode !== null) {
          const minRow = Math.min(anchor.staffIdx, nextFocus.staffIdx);
          const maxRow = Math.max(anchor.staffIdx, nextFocus.staffIdx);
          const minCol = Math.min(anchor.dateIdx, nextFocus.dateIdx);
          const maxCol = Math.max(anchor.dateIdx, nextFocus.dateIdx);
          const keys: string[] = [];
          for (let r = minRow; r <= maxRow; r += 1) {
            const s = enrichedDisplay.staffList[r];
            if (!s || s.id < 0) continue;
            for (let c = minCol; c <= maxCol; c += 1) {
              const d = periodDates[c];
              if (d) keys.push(`${s.id}:${d}`);
            }
          }
          stageFastEditForKeys(keys, quickPaintCode);
        }
      }
      return;
    }

    const WORKING = new Set(['AM', 'PM', 'ON1', 'ON2', 'PN', 'MEDSB']);
    const raw = (currentCode || '').trim().toUpperCase();
    const isS = raw.includes('(S)') || raw.endsWith('-S');
    const isX = raw.includes('(X)') || raw.endsWith('-X');
    const clean = raw.replace(/\(S\)|-S|\(X\)|-X/g, '').trim();

    if (rosterEditMode === 'standby') {
      if (!clean || WORKING.has(clean)) return;
      const nextVal = `${clean}${!isS ? ' (S)' : ''}${isX ? ' (X)' : ''}`;
      recordPaintAction({
        staffId: staff.id,
        dutyDate: date,
        prevCode: currentCode,
        nextCode: nextVal,
      });
      upsertMutation.mutate({ staffId: staff.id, dutyDate: date, shiftCode: nextVal });
      return;
    }

    if (rosterEditMode === 'extended') {
      if (!WORKING.has(clean)) return;
      const nextVal = `${clean}${isS ? ' (S)' : ''}${!isX ? ' (X)' : ''}`;
      recordPaintAction({
        staffId: staff.id,
        dutyDate: date,
        prevCode: currentCode,
        nextCode: nextVal,
      });
      upsertMutation.mutate({ staffId: staff.id, dutyDate: date, shiftCode: nextVal });
      return;
    }

    if (quickPaintCode !== null) {
      recordPaintAction({
        staffId: staff.id,
        dutyDate: date,
        prevCode: currentCode,
        nextCode: quickPaintCode || undefined,
      });
      if (quickPaintCode === '') {
        deleteMutation.mutate({ staffId: staff.id, dutyDate: date });
      } else {
        upsertMutation.mutate({ staffId: staff.id, dutyDate: date, shiftCode: quickPaintCode });
      }
      return;
    }

    if (isPlanning) {
      const existingNote = activeAssignments.find(
        (a) => a.staffId === staff.id && a.dutyDate === date,
      )?.note;
      setSelectedCell({ staff, date, currentCode, initialNote: existingNote });
    }
  };

  return (
    <div className="space-y-3">
      {/* Desktop Top Header Row (Hidden on Mobile — Mobile app bar already shows "Roster" + PDF icon) */}
      <div className="sr-only lg:not-sr-only lg:flex flex-wrap items-center justify-between gap-4 border-b border-[#E7E5E4] pb-3.5">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#0F766E]">
            Emergency Department Workforce
          </div>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#18181B]">
            {periodLabel} Roster
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[#57534E]">
            {isLegacyReadOnly
              ? `Historical legacy schedule ingested from Google Sheets (Batch: ${periodRow?.import_batch_id ?? 'Rehearsal'}). Locked for auditing.`
              : 'Duty timetable, EP specialist coverage, lifecycle snapshots & shift matrix'}
          </p>
        </div>

        {/* Center Lifecycle Pill Capsule (Owner + Published / Enforced only) */}
        {!isMobileViewport && isOwner && isEnforced ? (
          <div className="flex flex-col items-center gap-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-[#EFEAE1] p-1">
              <button
                type="button"
                aria-label="Live Schedule (Current)"
                onClick={() => setViewMode('current')}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  viewMode === 'current'
                    ? 'bg-[#18181B] text-white shadow-xs'
                    : 'text-[#57534E] hover:text-[#18181B]'
                }`}
              >
                ⚡ Current Active
              </button>
              <button
                type="button"
                aria-label="Original Planned"
                onClick={() => setViewMode('planned')}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  viewMode === 'planned'
                    ? 'bg-[#18181B] text-white shadow-xs'
                    : 'text-[#57534E] hover:text-[#18181B]'
                }`}
              >
                🔒 Original Planned
              </button>
              <button
                type="button"
                aria-label={`Changes & Audit (${amendmentEvents.length})`}
                onClick={() => setViewMode('changes')}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  viewMode === 'changes'
                    ? 'bg-[#18181B] text-white shadow-xs'
                    : 'text-[#57534E] hover:text-[#18181B]'
                }`}
              >
                📜 Changes &amp; Audit ({amendmentEvents.length})
              </button>
            </div>
            <span className="text-[10.5px] font-semibold text-[#78716C]">
              {viewMode === 'planned'
                ? 'Immutable baseline frozen at publication (Read-Only)'
                : viewMode === 'changes'
                  ? 'Append-only operational amendments'
                  : 'Live duty truth with active amendments'}
            </span>
          </div>
        ) : null}

        {/* Right Toolbar Actions (Prototype: Export PDF + Close/Reopen when applicable) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isOwner && !isLegacyReadOnly && isEnforced ? (
            <button
              type="button"
              onClick={() => setIsCloseModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E5E4] bg-white px-3 py-1.5 text-xs font-bold text-[#57534E] hover:bg-[#FAF8F5] transition cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-[#0F766E]" />
              <span>Close Period</span>
            </button>
          ) : null}

          {isOwner && !isLegacyReadOnly && isClosed ? (
            <button
              type="button"
              onClick={() => setIsCloseModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E5E4] bg-white px-3 py-1.5 text-xs font-bold text-[#57534E] hover:bg-[#FAF8F5] transition cursor-pointer"
            >
              <Unlock className="h-3.5 w-3.5 text-[#0F766E]" />
              <span>Reopen Period</span>
            </button>
          ) : null}

          {canExportRoster ? (
            <button
              type="button"
              onClick={() => setIsPdfExportModalOpen(true)}
              aria-label="PDF Export"
              title="PDF Export & Print"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E5E4] bg-white px-3.5 py-1.5 text-xs font-extrabold text-[#18181B] shadow-2xs hover:bg-[#FAF8F5] transition cursor-pointer"
            >
              <span>📄</span>
              <span>Export PDF</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Legacy Read-Only Historical Banner */}
      {isLegacyReadOnly ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-900 shadow-2xs">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-bold">Historical Google Sheets Roster (Read-Only Audit Archive)</p>
            <p className="mt-0.5 text-[11px] text-amber-800">
              This schedule was ingested from legacy Google Sheets workbook (
              {periodRow?.import_batch_id ?? 'Rehearsal'}). It is preserved in read-only mode to
              safeguard historical audit evidence.
            </p>
          </div>
        </div>
      ) : null}

      {/* Mobile Owner Lifecycle Bar */}
      {isMobileViewport && isOwner && isEnforced ? (
        <div className="lg:hidden space-y-1">
          <div className="no-scrollbar flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setViewMode('current')}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                viewMode === 'current'
                  ? 'border-[#18181B] bg-[#18181B] text-white'
                  : 'border-[#E7E5E4] bg-white text-[#57534E]'
              }`}
            >
              ⚡ Current Active
            </button>
            <button
              type="button"
              onClick={() => setViewMode('planned')}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                viewMode === 'planned'
                  ? 'border-[#18181B] bg-[#18181B] text-white'
                  : 'border-[#E7E5E4] bg-white text-[#57534E]'
              }`}
            >
              🔒 Original Planned
            </button>
            <button
              type="button"
              onClick={() => setViewMode('changes')}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                viewMode === 'changes'
                  ? 'border-[#18181B] bg-[#18181B] text-white'
                  : 'border-[#E7E5E4] bg-white text-[#57534E]'
              }`}
            >
              📜 Changes &amp; Audit ({amendmentEvents.length})
            </button>
          </div>
        </div>
      ) : null}

      {viewMode !== 'changes' ? (
        <>
          {/* Sticky Month Picker + View Switcher Bar */}
          <div className="sticky top-[55px] lg:top-0 z-20 -mx-1 px-1 py-1.5 bg-[#FAF8F5]/95 backdrop-blur-xs space-y-2">
            {/* Centered Month Navigator Bar (Clickable Wheel Picker) */}
            <div className="flex items-center justify-center gap-5 rounded-[16px] border border-[#E7E5E4] bg-white px-4 py-1.5 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                title="Previous Month"
                className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[#E7E5E4] bg-[#FAF8F5] text-[#18181B] hover:bg-stone-100 transition cursor-pointer active:scale-[0.92]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsMonthWheelOpen(true)}
                title="Click to pick month"
                className="cursor-pointer rounded-xl px-3 py-0.5 text-center transition hover:bg-[#FAF8F5]"
              >
                <div className="text-[13.5px] font-extrabold text-[#18181B]">
                  {periodLabel} <span className="text-[10px] text-[#0F766E]">▾</span>
                </div>
                <div className="text-[9.5px] font-semibold text-[#78716C]">
                  {periodDates.length} Days · {periodStatusLabel}
                </div>
              </button>

              <button
                type="button"
                disabled={isAtMaxAllowedMonth}
                onClick={handleNextMonth}
                aria-label="Next Month"
                title={
                  isAtMaxAllowedMonth ? 'Upcoming draft months are not available' : 'Next Month'
                }
                className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[#E7E5E4] bg-[#FAF8F5] text-[#18181B] hover:bg-stone-100 transition cursor-pointer active:scale-[0.92] disabled:opacity-35 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Full-Width 2-Tab Sliding Switch: Table View | Month */}
            <div className="relative grid grid-cols-2 rounded-full bg-[#EAE4DA] p-[3px] select-none">
              <div
                className={`absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-[#18181B] shadow-[0_3px_10px_rgba(0,0,0,0.16)] transition-transform duration-200 ${
                  viewFormat === 'calendar' ? 'translate-x-full' : 'translate-x-0'
                }`}
              />
              <button
                type="button"
                id="tab-btn-table"
                data-testid="tab-btn-table"
                onClick={() => setViewFormat('table')}
                className={`relative z-10 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                  viewFormat === 'table' ? 'text-white' : 'text-[#57534E]'
                }`}
              >
                Table View
              </button>
              <button
                type="button"
                id="tab-btn-calendar"
                data-testid="tab-btn-calendar"
                onClick={() => setViewFormat('calendar')}
                className={`relative z-10 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
                  viewFormat === 'calendar' ? 'text-white' : 'text-[#57534E]'
                }`}
              >
                Month<span className="sr-only"> (Calendar View)</span>
              </button>
            </div>
          </div>

          {/* Owner-Only Read-Only Protection & Quick Shift Palette Bar (Table View) */}
          {isOwner && !isLegacyReadOnly && !isClosed && viewFormat === 'table' ? (
            isTableEditEnabled ? (
              <div className="sticky top-2 z-30 rounded-[16px] border border-[#E7E5E4] bg-[#FAF8F5]/95 backdrop-blur-xs p-3 space-y-2.5 shadow-[0_8px_22px_-8px_rgba(24,24,27,0.16)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="no-scrollbar flex flex-nowrap items-center gap-1.5 overflow-x-auto">
                    <span className="shrink-0 text-[10px] font-extrabold uppercase text-[#57534E] mr-1">
                      Edit Mode:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRosterEditMode('normal');
                        setQuickPaintCode(null);
                      }}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold cursor-pointer ${
                        rosterEditMode === 'normal'
                          ? 'bg-[#18181B] text-white border-[#18181B]'
                          : 'bg-white text-[#57534E] border-[#E7E5E4]'
                      }`}
                    >
                      📋 Normal Roster
                    </button>
                    {isPlanning ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRosterEditMode('fast');
                          setQuickPaintCode(null);
                        }}
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold cursor-pointer ${
                          rosterEditMode === 'fast'
                            ? 'bg-[#0F766E] text-white border-[#0F766E]'
                            : 'bg-white text-[#0F766E] border-[#99F6E4]'
                        }`}
                      >
                        ⚡ Fast Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setRosterEditMode('standby');
                        setQuickPaintCode(null);
                      }}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold cursor-pointer ${
                        rosterEditMode === 'standby'
                          ? 'bg-[#B45309] text-white border-[#B45309]'
                          : 'bg-white text-[#57534E] border-[#E7E5E4]'
                      }`}
                    >
                      🟡 Standby Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRosterEditMode('extended');
                        setQuickPaintCode(null);
                      }}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold cursor-pointer ${
                        rosterEditMode === 'extended'
                          ? 'bg-[#0F766E] text-white border-[#0F766E]'
                          : 'bg-white text-[#57534E] border-[#E7E5E4]'
                      }`}
                    >
                      🔵 Extended Edit
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-[#57534E]">
                      {rosterEditMode === 'fast'
                        ? fastSelectedRangeKeys.size > 1
                          ? `${fastSelectedRangeKeys.size} cells selected`
                          : fastFocus
                            ? 'Press A/P/O/1/2/N/H/Del or Enter'
                            : 'Click any cell to start'
                        : rosterEditMode === 'standby'
                          ? 'Tap off/leave cell to toggle (S)'
                          : rosterEditMode === 'extended'
                            ? 'Tap working cell to toggle (X)'
                            : quickPaintCode !== null
                              ? `Painting: ${quickPaintCode || 'Clear'}`
                              : 'Pick stamp or tap cell'}
                    </span>
                    {quickPaintCode !== null &&
                    (rosterEditMode === 'normal' || rosterEditMode === 'fast') ? (
                      <button
                        type="button"
                        onClick={() => setQuickPaintCode(null)}
                        className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-1 text-[10px] font-bold text-[#57534E] cursor-pointer"
                      >
                        Exit Paint
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setIsTableEditEnabled(false);
                        setQuickPaintCode(null);
                        setRosterEditMode('normal');
                        setFastAnchor(null);
                        setFastFocus(null);
                      }}
                      className="rounded-full bg-[#18181B] px-3 py-1 text-[10.5px] font-extrabold text-white cursor-pointer"
                    >
                      ✓ Done Editing
                    </button>
                  </div>
                </div>

                {rosterEditMode === 'fast' ? (
                  <div className="space-y-2">
                    <div className="rounded-xl border border-[#99F6E4] bg-[#F0FDFA] px-3 py-2 text-[11px] font-bold text-[#0F766E]">
                      Fast Editing Mode Active (Table): Click any cell and press A (AM), P (PM), O
                      (OFF), 1/2 (ON1/ON2), N (PN), H (HKA), Del (Clear), or Enter to open the Quick
                      Shift Palette. Hold Shift + Arrow Keys (or Shift + Click) to fill a multi-cell
                      range at once. Nothing is sent over the network until you click Save Changes.
                    </div>
                    <div className="no-scrollbar flex flex-nowrap items-center gap-1.5 overflow-x-auto py-0.5 px-0.5">
                      <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-[#57534E] mr-0.5">
                        Fast Palette:
                      </span>
                      {PALETTE_CODES.map((c) => {
                        const isActive = quickPaintCode === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              if (fastSelectedRangeKeys.size > 0) {
                                stageFastEditForKeys(fastSelectedRangeKeys, c);
                              } else {
                                setQuickPaintCode((prev) => (prev === c ? null : c));
                              }
                            }}
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold cursor-pointer transition ${getShiftToneClasses(
                              c,
                            )} ${
                              isActive
                                ? 'ring-2 ring-[#18181B] ring-offset-1 scale-[1.05] shadow-xs'
                                : 'opacity-85 hover:opacity-100'
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          if (fastSelectedRangeKeys.size > 0) {
                            stageFastEditForKeys(fastSelectedRangeKeys, '');
                          } else {
                            setQuickPaintCode((prev) => (prev === '' ? null : ''));
                          }
                        }}
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold cursor-pointer transition ${
                          quickPaintCode === ''
                            ? 'bg-[#B91C1C] text-white border-[#B91C1C] ring-2 ring-[#18181B] ring-offset-1'
                            : 'bg-white text-[#B91C1C] border-[#FECACA] hover:bg-rose-50'
                        }`}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : rosterEditMode === 'normal' ? (
                  <div className="no-scrollbar flex flex-nowrap items-center gap-1.5 overflow-x-auto py-0.5 px-0.5">
                    <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-[#57534E] mr-0.5">
                      Fast Palette:
                    </span>
                    {PALETTE_CODES.map((c) => {
                      const isActive = quickPaintCode === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setQuickPaintCode((prev) => (prev === c ? null : c))}
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold cursor-pointer transition ${getShiftToneClasses(
                            c,
                          )} ${
                            isActive
                              ? 'ring-2 ring-[#18181B] ring-offset-1 scale-[1.05] shadow-xs'
                              : 'opacity-85 hover:opacity-100'
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setQuickPaintCode((prev) => (prev === '' ? null : ''))}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold cursor-pointer transition ${
                        quickPaintCode === ''
                          ? 'bg-[#B91C1C] text-white border-[#B91C1C] ring-2 ring-[#18181B] ring-offset-1'
                          : 'bg-white text-[#B91C1C] border-[#FECACA] hover:bg-rose-50'
                      }`}
                    >
                      Clear
                    </button>
                  </div>
                ) : rosterEditMode === 'standby' ? (
                  <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[11px] font-bold text-[#92400E]">
                    Standby Edit Mode: Click any off/leave cell to toggle Standby (S). Working
                    shifts are dimmed.
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#99F6E4] bg-[#F0FDFA] px-3 py-2 text-[11px] font-bold text-[#0F766E]">
                    Extended Edit Mode: Click any working shift cell to toggle Extended (EX).
                    Non-working shifts are dimmed.
                  </div>
                )}

                {/* Undo / Redo / Sync Status Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EFECE6] pt-2">
                  {Object.keys(pendingFastEdits).length > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-extrabold text-[#B45309]">
                        {Object.keys(pendingFastEdits).length} unsaved change
                        {Object.keys(pendingFastEdits).length === 1 ? '' : 's'}
                      </span>
                      <button
                        type="button"
                        disabled={batchSaveDraftMutation.isPending}
                        onClick={handleSaveFastEdits}
                        className="rounded-full bg-[#0F766E] px-3 py-1 text-[10.5px] font-extrabold text-white hover:bg-[#0D9488] disabled:opacity-50 cursor-pointer"
                      >
                        {batchSaveDraftMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        disabled={batchSaveDraftMutation.isPending}
                        onClick={() => {
                          setPendingFastEdits({});
                          showToast('Discarded unsaved edits');
                        }}
                        className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-1 text-[10px] font-bold text-[#57534E] hover:bg-stone-100 cursor-pointer"
                      >
                        Discard
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10.5px] font-bold text-[#047857]">
                      {upsertMutation.isPending ||
                      deleteMutation.isPending ||
                      batchSaveDraftMutation.isPending
                        ? 'Saving change...'
                        : 'All changes saved ✓'}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={paintUndoStack.length === 0}
                      onClick={handleUndoPaint}
                      className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#57534E] disabled:opacity-40 cursor-pointer"
                    >
                      ↩ {paintUndoStack.length}
                    </button>
                    <button
                      type="button"
                      disabled={paintRedoStack.length === 0}
                      onClick={handleRedoPaint}
                      className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#57534E] disabled:opacity-40 cursor-pointer"
                    >
                      ↪ {paintRedoStack.length}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[#E7E5E4] bg-[#FAF8F5] px-3.5 py-2">
                <span className="text-[11px] font-bold text-[#57534E]">
                  🔒 Read-Only Protection Active ({periodStatusLabel})
                </span>
                <button
                  type="button"
                  onClick={() => setIsTableEditEnabled(true)}
                  className="rounded-full bg-[#0F766E] px-3.5 py-1 text-[11px] font-extrabold text-white shadow-2xs hover:bg-[#115E59] transition cursor-pointer"
                >
                  ✏️ Edit Roster
                </button>
              </div>
            )
          ) : null}
        </>
      ) : null}

      {/* Main Content Area */}
      {isPeriodLoading || isStaffLoading || (isEnforced && isPlannedLoading) ? (
        <SkeletonRosterWorkspace label={`Loading roster workspace for ${periodLabel}...`} />
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
        <AmendmentHistoryList
          periodId={periodId}
          isOwner={isOwner}
          staffList={staffList}
          events={amendmentEvents}
          isLoading={isAmendmentsLoading}
          onOpenAmend={() => {
            setAmendModalPrefill(null);
            setIsAmendModalOpen(true);
          }}
        />
      ) : viewFormat === 'calendar' ? (
        <RosterCalendarView
          periodDates={periodDates}
          staffList={calendarStaffList}
          assignments={enrichedDisplay.assignments}
          epAssignments={epAssignments}
          holidays={publicHolidays as PublicHolidayEntry[]}
          isEditable={isOwner}
          periodLabel={periodLabel}
          isPublished={isEnforced || isClosed}
          statusLabel={periodStatusLabel}
          currentUserName={user?.rosterName || user?.displayName}
          currentUserId={user?.staffId}
          onOpenPdfExport={() => setIsPdfExportModalOpen(true)}
          onUpdateEpAssignment={handleUpdateEpAssignment}
          onBatchUpdateEpAssignments={handleBatchUpdateEpAssignments}
        />
      ) : (
        <>
          {/* Mobile Full View / Rotate Pill */}
          <div className="flex justify-center pb-0.5 lg:hidden">
            <button
              type="button"
              onClick={() => setIsRotatedOverlayOpen(true)}
              className="rounded-full border border-[#E7E5E4] bg-white px-4 py-1.5 text-[11.5px] font-bold text-[#57534E] shadow-2xs hover:border-stone-400 hover:text-[#18181B] cursor-pointer"
            >
              🔄 Full View / Rotate
            </button>
          </div>

          <RosterGrid
            periodDates={periodDates}
            staffList={enrichedDisplay.staffList}
            assignments={tableAssignments}
            shiftDefinitions={shiftDefinitions}
            holidays={publicHolidays as PublicHolidayEntry[]}
            isEditable={isGridInteractive}
            isTableEditEnabled={isTableEditEnabled}
            rosterEditMode={rosterEditMode}
            selectedCell={
              selectedCell ? { staffId: selectedCell.staff.id, date: selectedCell.date } : null
            }
            selectedRangeKeys={fastSelectedRangeKeys}
            dirtyCellKeys={dirtyCellKeys}
            requests={enrichedDisplay.requests}
            amendedCellKeys={amendedCellKeys}
            onSelectCell={handleCellSelect}
            onBlockedEditTap={() => showToast('Tap "Edit Roster" to edit')}
          />

          {/* Owner-Only Tallies, Rules Engine & Snapshot Archive */}
          {isOwner ? (
            <>
              <RosterTallyTables
                periodDates={periodDates}
                staffList={enrichedDisplay.staffList}
                assignments={enrichedDisplay.assignments}
                requests={enrichedDisplay.requests}
              />

              {rulesOutput ? (
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
                    } else if (issue.date) {
                      showToast(`Focused ${issue.date}`);
                    }
                  }}
                />
              ) : null}

              {periodRow ? (
                <RosterSnapshotBar
                  periodId={periodRow.id}
                  periodYear={yyyy}
                  periodMonth={mm}
                  periodStart={`${yyyy}-${mm}-01`}
                  periodRevision={periodRow.revision}
                  staffList={moStaffList}
                  assignments={activeAssignments}
                  shiftDefinitions={shiftDefinitions}
                  epAssignments={epAssignments}
                  holidays={publicHolidays as PublicHolidayEntry[]}
                  isOwner={isOwner}
                />
              ) : null}
            </>
          ) : null}
        </>
      )}

      {/* Mobile Rotated Landscape Roster Overlay — Fits full rotated screen width with zero horizontal scroll */}
      {isRotatedOverlayOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rotated Full Roster Landscape View"
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-[#FAF8F5] lg:hidden"
        >
          <div className="flex h-[calc(100dvw-12px)] w-[calc(100dvh-12px)] shrink-0 rotate-90 flex-col rounded-2xl border border-[#E7E5E4] bg-white p-2 shadow-2xl">
            <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
              <span className="truncate text-[11px] font-extrabold text-[#18181B]">
                {periodLabel} · Full Roster (Landscape)
              </span>
              <button
                type="button"
                onClick={() => setIsRotatedOverlayOpen(false)}
                className="shrink-0 rounded-full bg-[#18181B] px-2.5 py-0.5 text-[10px] font-extrabold text-white cursor-pointer"
              >
                ✕ Exit Rotate
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-[10px] border border-[#F4EFE6]">
              <table className="w-full table-fixed border-collapse text-center">
                <thead>
                  <tr className="border-b border-[#E7E5E4] bg-[#FAF8F5]">
                    <th className="sticky top-0 z-10 w-[52px] border-r border-[#E7E5E4] bg-[#FAF8F5] px-1 py-1 text-left text-[8px] font-extrabold text-[#57534E]">
                      Staff
                    </th>
                    {periodDates.map((d) => {
                      const utcDay = new Date(`${d}T00:00:00Z`).getUTCDay();
                      const isWeekend = utcDay === 0 || utcDay === 6;
                      const isHoliday = publicHolidays.some((h) => h.date === d);
                      return (
                        <th
                          key={d}
                          className={`sticky top-0 border-r border-[#F4EFE6] py-1 text-[7.5px] font-extrabold leading-none ${
                            isHoliday
                              ? 'bg-[#FFE4E6] text-[#BE123C]'
                              : isWeekend
                                ? 'bg-[#FEF3C7] text-[#B45309]'
                                : 'bg-[#FAF8F5] text-[#57534E]'
                          }`}
                        >
                          {parseInt(d.slice(8, 10), 10)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {enrichedDisplay.staffList.map((s) => (
                    <tr key={s.id} className="border-b border-[#F4EFE6]">
                      <td className="truncate border-r border-[#E7E5E4] bg-white px-1 py-0.5 text-left text-[8px] font-extrabold text-[#18181B]">
                        {s.rosterName.replace(/^Dr\.?\s+/i, '')}
                      </td>
                      {periodDates.map((d) => {
                        const code =
                          enrichedDisplay.assignments.find(
                            (a) => a.staffId === s.id && a.dutyDate === d,
                          )?.shiftCode ?? '';
                        return (
                          <td key={d} className="border-r border-[#FAF8F5] p-[0.5px]">
                            <span
                              className={`block w-full truncate rounded-[3px] py-[2px] text-[6.5px] font-extrabold leading-none tracking-tighter ${getShiftToneClasses(
                                code,
                              )}`}
                            >
                              {code || '·'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Month / Year Wheel Picker Modal */}
      {(() => {
        return (
          <MonthYearWheelModal
            isOpen={isMonthWheelOpen}
            onClose={() => setIsMonthWheelOpen(false)}
            title="Select Roster Month"
            subtitle={
              isRestrictedToCurrentAndPast
                ? 'Current & previous months only'
                : 'Current/previous = Published · Upcoming = Draft'
            }
            selectedYear={parseInt(yyyy, 10)}
            selectedMonth={parseInt(mm, 10)}
            shortcutLabel="Current"
            shortcutYear={Number(currentMalaysiaPeriod.year)}
            shortcutMonth={Number(currentMalaysiaPeriod.month)}
            maxYear={isRestrictedToCurrentAndPast ? Number(currentMalaysiaPeriod.year) : undefined}
            maxMonth={
              isRestrictedToCurrentAndPast ? Number(currentMalaysiaPeriod.month) : undefined
            }
            onSelect={(yr, mo) => handleMonthChange(String(yr), String(mo).padStart(2, '0'))}
          />
        );
      })()}

      {/* Fast Edit Quick Shift Palette Modal (Enter key in Fast Edit Mode) */}
      {(() => {
        const fastStaff = fastFocus ? enrichedDisplay.staffList[fastFocus.staffIdx] : undefined;
        const fastDate = fastFocus ? periodDates[fastFocus.dateIdx] : undefined;
        if (!isFastPaletteModalOpen || !isPlanning || !fastStaff || !fastDate) return null;
        return (
          <ShiftPickerModal
            isOpen={isFastPaletteModalOpen}
            staff={fastStaff}
            date={fastDate}
            currentCode={
              tableAssignments.find((a) => a.staffId === fastStaff.id && a.dutyDate === fastDate)
                ?.shiftCode
            }
            shiftDefinitions={shiftDefinitions}
            onClose={() => setIsFastPaletteModalOpen(false)}
            onSelectShift={(code) => {
              if (fastSelectedRangeKeys.size > 0) {
                stageFastEditForKeys(fastSelectedRangeKeys, code);
              }
            }}
            onClearShift={() => {
              if (fastSelectedRangeKeys.size > 0) {
                stageFastEditForKeys(fastSelectedRangeKeys, '');
              }
            }}
          />
        );
      })()}

      {/* Shift Picker Modal (Pre-Month Planning Mode Only) */}
      {selectedCell && isPlanning ? (
        <ShiftPickerModal
          isOpen={Boolean(selectedCell)}
          staff={selectedCell.staff}
          date={selectedCell.date}
          currentCode={selectedCell.currentCode}
          initialNote={selectedCell.initialNote}
          shiftDefinitions={shiftDefinitions}
          onClose={() => setSelectedCell(null)}
          onSelectShift={(code, note) => {
            if (!periodId) return;
            recordPaintAction({
              staffId: selectedCell.staff.id,
              dutyDate: selectedCell.date,
              prevCode: selectedCell.currentCode,
              nextCode: code,
            });
            upsertMutation.mutate({
              staffId: selectedCell.staff.id,
              dutyDate: selectedCell.date,
              shiftCode: code,
              cellNote: note,
            });
          }}
          onClearShift={() => {
            if (!periodId) return;
            recordPaintAction({
              staffId: selectedCell.staff.id,
              dutyDate: selectedCell.date,
              prevCode: selectedCell.currentCode,
              nextCode: undefined,
            });
            deleteMutation.mutate({
              staffId: selectedCell.staff.id,
              dutyDate: selectedCell.date,
            });
          }}
        />
      ) : null}

      {/* Amend Roster Modal */}
      {isAmendModalOpen ? (
        <AmendRosterModal
          isOpen={isAmendModalOpen}
          onClose={() => {
            setIsAmendModalOpen(false);
            setAmendModalPrefill(null);
          }}
          periodId={periodId}
          periodDates={periodDates}
          staffList={moStaffList}
          shiftDefinitions={shiftDefinitions}
          currentAssignments={currentAssignments}
          shiftSemantics={ruleConfig.semantics ?? []}
          initialStaffId={amendModalPrefill?.staffId}
          initialDate={amendModalPrefill?.date}
          initialShiftCode={amendModalPrefill?.shiftCode}
        />
      ) : null}

      {/* Roster PDF Export Modal */}
      {isPdfExportModalOpen && periodRow ? (
        <RosterExportModal
          isOpen={isPdfExportModalOpen}
          onClose={() => setIsPdfExportModalOpen(false)}
          periodYear={yyyy}
          periodMonth={mm}
          periodStart={periodRow.period_start}
          periodRevision={periodRow.revision ?? 0}
          staffList={moStaffList}
          allStaffList={staffList}
          assignments={activeAssignments}
          shiftDefinitions={shiftDefinitions}
          epAssignments={epAssignments}
          holidays={publicHolidays as PublicHolidayEntry[]}
        />
      ) : null}

      {/* Close / Reconcile Modal */}
      {isCloseModalOpen ? (
        <CloseReconcileModal
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          periodId={periodId}
          periodLabel={periodLabel}
          isClosed={isClosed}
          plannedCount={plannedAssignments.length}
          amendmentCount={amendmentEvents.length}
          accruedGoffCandidates={accruedGoffCandidates}
          staffList={moStaffList}
        />
      ) : null}
    </div>
  );
}
