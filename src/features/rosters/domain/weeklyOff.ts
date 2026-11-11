import { isQualifyingNightShift, normalizeShiftCode } from './semantics';
import type {
  ShiftSemanticDefinition,
  WeeklyOffEvaluationStatus,
  WeeklyOffPolicy,
  WeeklyOffResult,
} from './types';

/**
 * Returns the Monday date string (YYYY-MM-DD) for any given ISO date string.
 */
export function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0 is Sunday, 1 is Monday, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the Sunday date string (YYYY-MM-DD) for any given ISO date string.
 */
export function getWeekSunday(dateStr: string): string {
  const mondayStr = getWeekMonday(dateStr);
  const d = new Date(mondayStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Generates all 7 ISO date strings (Monday to Sunday) for a week starting on weekStart Monday.
 */
export function getDatesForWeek(weekStartMonday: string): string[] {
  const dates: string[] = [];
  const d = new Date(weekStartMonday + 'T00:00:00Z');
  for (let i = 0; i < 7; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

export type RosterWeekSpan = {
  readonly weekStart: string; // YYYY-MM-DD (Monday)
  readonly weekEnd: string; // YYYY-MM-DD (Sunday)
  readonly daysInPeriod: number;
  readonly isBoundaryWeek: boolean;
  readonly dates: readonly string[];
};

/**
 * Computes all full Monday–Sunday weeks that intersect the given period.
 */
export function getRosterWeeks(periodStart: string, periodEnd: string): readonly RosterWeekSpan[] {
  const weeks: RosterWeekSpan[] = [];
  let curMonday = getWeekMonday(periodStart);
  const lastSunday = getWeekSunday(periodEnd);

  while (curMonday <= lastSunday) {
    const dates = getDatesForWeek(curMonday);
    const weekEnd = dates[6] ?? getWeekSunday(curMonday);
    const daysInPeriod = dates.filter((d) => d >= periodStart && d <= periodEnd).length;
    const isBoundaryWeek = daysInPeriod < 7;

    weeks.push({
      weekStart: curMonday,
      weekEnd,
      daysInPeriod,
      isBoundaryWeek,
      dates,
    });

    // Advance 7 days to next Monday
    const nextMon = new Date(curMonday + 'T00:00:00Z');
    nextMon.setUTCDate(nextMon.getUTCDate() + 7);
    curMonday = nextMon.toISOString().slice(0, 10);
  }

  return weeks;
}

/**
 * Evaluates weekly OFF compliance for one staff member for one Monday–Sunday week.
 * Invariant: Only base code 'OFF' satisfies entitlement. GOFF, leave, etc. do NOT count.
 */
export function evaluateWeeklyOffForStaff(
  staffId: number,
  week: RosterWeekSpan,
  assignmentsByDate: Map<string, string>,
  policy: WeeklyOffPolicy,
  nightQualifyingCodes?: readonly string[],
  customSemantics?: readonly ShiftSemanticDefinition[],
  hasAdjacentData = true,
): WeeklyOffResult {
  let actualOff = 0;
  let hasQualifyingNight = false;
  let hasMissingDate = false;

  for (const date of week.dates) {
    const shiftCode = assignmentsByDate.get(date);
    if (!shiftCode) {
      hasMissingDate = true;
      continue;
    }

    const { base } = normalizeShiftCode(shiftCode);
    if (base === 'OFF') {
      actualOff += 1;
    }

    if (isQualifyingNightShift(shiftCode, nightQualifyingCodes, customSemantics)) {
      hasQualifyingNight = true;
    }
  }

  // Determine required OFF based on policy:
  // Policy A: exactly 1 OFF
  // Policy B: 1 OFF if qualifying night present, otherwise 2 OFFs
  const requiredOff = policy === 'policy_a' ? 1 : hasQualifyingNight ? 1 : 2;

  const isProvisional = week.isBoundaryWeek && (!hasAdjacentData || hasMissingDate);

  let status: WeeklyOffEvaluationStatus;
  if (isProvisional) {
    status = 'provisional';
  } else if (actualOff === requiredOff) {
    status = 'compliant';
  } else if (actualOff < requiredOff) {
    status = 'short';
  } else {
    status = 'excess';
  }

  return {
    staffId,
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    policy,
    requiredOff,
    actualOff,
    status,
    hasQualifyingNight,
    isProvisional,
  };
}
