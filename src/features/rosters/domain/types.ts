/**
 * Pure Roster Domain Model & Rules Engine Types (02_TARGET_ARCHITECTURE.md, 05_ROSTER_RULES_ENGINE.md).
 * Completely deterministic: zero network, database, clock, or browser dependencies.
 */

export type ShiftSemanticClass = 'worked' | 'transparent' | 'reset' | 'unknown';

export type ShiftBucket = 'am' | 'pm' | 'night' | 'total';

export type DayType = 'weekday' | 'weekend' | 'holiday';

export type WeeklyOffPolicy = 'policy_a' | 'policy_b';

export type ShiftSemanticDefinition = {
  readonly shiftCode: string;
  readonly semanticClass: ShiftSemanticClass;
  readonly providesCoverage: boolean;
  readonly nightPolicyBQualifying: boolean;
  readonly displacesOffEarnsGoff: boolean;
  readonly modifierInheritance?: 'inherit' | 'override' | 'ignore';
  readonly bucket?: ShiftBucket;
};

export type StaffingThreshold = {
  readonly dayType: DayType;
  readonly shiftBucket: ShiftBucket;
  readonly minStaff: number;
  readonly targetStaff: number;
};

export type VersionedRuleConfiguration = {
  readonly schemaVersion: number;
  readonly weeklyOffPolicy: WeeklyOffPolicy;
  readonly maxConsecutiveDays: number;
  readonly consecutiveWarningThreshold: number;
  readonly nightQualifyingCodes: readonly string[];
  readonly nightSequencePatterns: readonly (readonly string[])[];
  readonly requestDailyOffLimit: number;
  readonly requestMonthlyLimit: number;
  readonly requestWeekendLimit: number;
  readonly minRestHoursAfterNight: number;
  readonly staffingThresholds?: readonly StaffingThreshold[];
  readonly semantics?: readonly ShiftSemanticDefinition[];
};

export type StaffServicePeriodWindow = {
  readonly startDate: string; // YYYY-MM-DD
  readonly endDate: string | null; // YYYY-MM-DD | null
};

export type StaffRosterIdentity = {
  readonly id: number;
  readonly staffCode: string;
  readonly rosterName: string;
  readonly displayName: string;
  readonly staffGroup: string;
  readonly active: boolean;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly mobileNumber?: string | null;
  readonly servicePeriods?: readonly StaffServicePeriodWindow[];
};

/**
 * Returns true when the staff member is in service on `date` (YYYY-MM-DD).
 * If no startDate/endDate or servicePeriods are recorded, assumes in-service for backwards compatibility.
 */
export function isStaffInServiceOnDate(
  staff: Pick<StaffRosterIdentity, 'startDate' | 'endDate' | 'servicePeriods'>,
  date: string,
): boolean {
  if (staff.servicePeriods && staff.servicePeriods.length > 0) {
    return staff.servicePeriods.some(
      (sp) => date >= sp.startDate && (!sp.endDate || date <= sp.endDate),
    );
  }
  if (staff.startDate && date < staff.startDate) return false;
  if (staff.endDate && date > staff.endDate) return false;
  return true;
}

/**
 * Returns true when the staff member has at least one active service day within [periodStart, periodEnd].
 */
export function isStaffInServiceDuringPeriod(
  staff: Pick<StaffRosterIdentity, 'startDate' | 'endDate' | 'servicePeriods'>,
  periodStart: string,
  periodEnd: string,
): boolean {
  if (staff.servicePeriods && staff.servicePeriods.length > 0) {
    return staff.servicePeriods.some(
      (sp) => sp.startDate <= periodEnd && (!sp.endDate || sp.endDate >= periodStart),
    );
  }
  if (staff.startDate && staff.startDate > periodEnd) return false;
  if (staff.endDate && staff.endDate < periodStart) return false;
  return true;
}

export type MoWorkMode = 'shift' | 'oh_clinical' | 'oh_non_clinical';

export function getMoWorkMode(staffGroup?: string | null): MoWorkMode {
  const g = (staffGroup ?? '').toLowerCase();
  if (g.includes('non-clinical')) return 'oh_non_clinical';
  if (g.includes('office hour')) return 'oh_clinical';
  return 'shift';
}

export function sortStaffByWorkMode<T extends { staffGroup?: string | null }>(
  list: readonly T[],
): T[] {
  const rank = (m: MoWorkMode) => (m === 'shift' ? 0 : m === 'oh_clinical' ? 1 : 2);
  return [...list].sort(
    (a, b) => rank(getMoWorkMode(a.staffGroup)) - rank(getMoWorkMode(b.staffGroup)),
  );
}

export type Assignment = {
  readonly staffId: number;
  readonly dutyDate: string; // YYYY-MM-DD
  readonly shiftCode: string;
  readonly note?: string;
  readonly isProvisional?: boolean;
};

export type RosterPeriod = {
  readonly id: number;
  readonly periodStart: string; // YYYY-MM-01
  readonly periodEnd: string; // YYYY-MM-DD
  readonly status: 'draft' | 'published' | 'amended' | 'closed';
  readonly revision: number;
  readonly activeRuleVersionId?: number;
};

export type PublicHolidayEntry = {
  readonly date: string; // YYYY-MM-DD
  readonly name: string;
  readonly jurisdiction?: string;
};

export type GoffPosition = {
  readonly staffId: number;
  readonly openingBalance: number;
  readonly earned: number;
  readonly used: number;
  readonly activeReservations: number;
};

export type GoffProjection = {
  readonly staffId: number;
  readonly currentBalance: number;
  readonly availableBalance: number;
  readonly projectedBalance: number;
  readonly pendingEarns: number;
  readonly draftUses: number;
};

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'staffing_shortage'
  | 'missing_weekly_off'
  | 'compensated_weekly_off'
  | 'consecutive_work_exceeded'
  | 'broken_night_bundle'
  | 'insufficient_night_rest'
  | 'unknown_shift_code'
  | 'provisional_boundary_week'
  | 'goff_unavailable'
  | 'duplicate_assignment';

export type RosterIssue = {
  readonly id: string;
  readonly code: IssueCode;
  readonly severity: IssueSeverity;
  readonly staffId?: number;
  readonly staffName?: string;
  readonly date?: string;
  readonly weekStart?: string;
  readonly message: string;
  readonly suggestion?: string;
};

export type WeeklyOffEvaluationStatus = 'compliant' | 'short' | 'excess' | 'provisional';

export type WeeklyOffResult = {
  readonly staffId: number;
  readonly weekStart: string; // YYYY-MM-DD (Monday)
  readonly weekEnd: string; // YYYY-MM-DD (Sunday)
  readonly policy: WeeklyOffPolicy;
  readonly requiredOff: number;
  readonly actualOff: number;
  readonly status: WeeklyOffEvaluationStatus;
  readonly hasQualifyingNight: boolean;
  readonly isProvisional: boolean;
};

export type DailyStaffingCount = {
  readonly date: string;
  readonly dayType: DayType;
  readonly counts: Record<ShiftBucket, number>;
  readonly thresholds: Record<ShiftBucket, { min: number; target: number }>;
  readonly shortages: readonly ShiftBucket[];
};

export type StaffingResult = {
  readonly dailyCounts: readonly DailyStaffingCount[];
  readonly totalShortageDays: number;
};

export type SequenceResult = {
  readonly staffId: number;
  readonly maxWorkedSequence: number;
  readonly excessiveSequences: readonly {
    startDate: string;
    endDate: string;
    length: number;
  }[];
  readonly nightBundleIssues: readonly {
    date: string;
    pattern: string;
    issue: string;
  }[];
};

export type RulesInput = {
  readonly period: RosterPeriod;
  readonly people: readonly StaffRosterIdentity[];
  readonly assignments: readonly Assignment[];
  readonly adjacentAssignments?: readonly Assignment[];
  readonly holidays?: readonly PublicHolidayEntry[];
  readonly ledger?: readonly GoffPosition[];
  readonly configuration: VersionedRuleConfiguration;
};

export type RulesOutput = {
  readonly issues: readonly RosterIssue[];
  readonly weeklyOff: readonly WeeklyOffResult[];
  readonly staffing: StaffingResult;
  readonly sequences: readonly SequenceResult[];
  readonly goffProjections: readonly GoffProjection[];
  readonly checksum: string;
};

export type RosterPeriodShellDescriptor = {
  readonly year: string;
  readonly month: string;
  readonly lifecycleStatus: 'draft' | 'published' | 'amended' | 'closed';
};

export type AmendmentCategory =
  'absence_only' | 'absence_plus_replacement' | 'shift_swap' | 'admin_correction' | 'reversal';

export type AmendmentLineAction = 'absent' | 'replace' | 'swap' | 'modify' | 'compensate';

export type AmendmentLineItem = {
  readonly id?: number;
  readonly eventId?: number;
  readonly periodId?: number;
  readonly staffId: number;
  readonly dutyDate: string; // YYYY-MM-DD
  readonly lineAction: AmendmentLineAction;
  readonly fromShiftCode: string;
  readonly toShiftCode: string;
  readonly notes?: string | null;
};

export type AmendmentEvent = {
  readonly id: number;
  readonly periodId: number;
  readonly category: AmendmentCategory;
  readonly reason: string;
  readonly status: 'active' | 'reversed';
  readonly reversedByEventId?: number | null;
  readonly reversalReason?: string | null;
  readonly operationId?: string | null;
  readonly createdBy?: string | null;
  readonly createdAt: string;
  readonly lines: readonly AmendmentLineItem[];
};

export type GoffTransactionType = 'opening_balance' | 'earned' | 'used' | 'expired' | 'adjustment';

export type GoffLedgerEntry = {
  readonly id: number;
  readonly staffId: number;
  readonly periodId?: number | null;
  readonly transactionType: GoffTransactionType;
  readonly amount: number;
  readonly reason: string;
  readonly effectiveDate: string;
  readonly createdBy?: string | null;
  readonly createdAt: string;
};

export type RosterOperationalViewMode = 'current' | 'planned' | 'changes';
