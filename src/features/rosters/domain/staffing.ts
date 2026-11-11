import { getShiftBucket } from './semantics';
import type {
  Assignment,
  DailyStaffingCount,
  DayType,
  PublicHolidayEntry,
  RosterIssue,
  ShiftBucket,
  ShiftSemanticDefinition,
  StaffingResult,
  StaffingThreshold,
} from './types';

export const DEFAULT_STAFFING_THRESHOLDS: readonly StaffingThreshold[] = [
  { dayType: 'weekday', shiftBucket: 'am', minStaff: 6, targetStaff: 8 },
  { dayType: 'weekday', shiftBucket: 'pm', minStaff: 6, targetStaff: 8 },
  { dayType: 'weekday', shiftBucket: 'night', minStaff: 4, targetStaff: 5 },
  { dayType: 'weekday', shiftBucket: 'total', minStaff: 16, targetStaff: 21 },

  { dayType: 'weekend', shiftBucket: 'am', minStaff: 5, targetStaff: 7 },
  { dayType: 'weekend', shiftBucket: 'pm', minStaff: 5, targetStaff: 7 },
  { dayType: 'weekend', shiftBucket: 'night', minStaff: 4, targetStaff: 4 },
  { dayType: 'weekend', shiftBucket: 'total', minStaff: 14, targetStaff: 18 },

  { dayType: 'holiday', shiftBucket: 'am', minStaff: 5, targetStaff: 7 },
  { dayType: 'holiday', shiftBucket: 'pm', minStaff: 5, targetStaff: 7 },
  { dayType: 'holiday', shiftBucket: 'night', minStaff: 4, targetStaff: 4 },
  { dayType: 'holiday', shiftBucket: 'total', minStaff: 14, targetStaff: 18 },
];

/**
 * Determines day type (weekday, weekend, holiday) for any given ISO date string.
 */
export function getDayType(dateStr: string, holidays?: readonly PublicHolidayEntry[]): DayType {
  if (holidays && holidays.some((h) => h.date === dateStr)) {
    return 'holiday';
  }
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  // 0 is Sunday, 6 is Saturday
  if (day === 0 || day === 6) {
    return 'weekend';
  }
  return 'weekday';
}

/**
 * Aggregates daily staffing counts across all active assignments and evaluates against thresholds.
 */
export function evaluateStaffing(
  periodDates: readonly string[],
  assignments: readonly Assignment[],
  thresholds?: readonly StaffingThreshold[],
  holidays?: readonly PublicHolidayEntry[],
  customSemantics?: readonly ShiftSemanticDefinition[],
): {
  staffing: StaffingResult;
  issues: RosterIssue[];
} {
  const activeThresholds =
    thresholds && thresholds.length > 0 ? thresholds : DEFAULT_STAFFING_THRESHOLDS;

  const thresholdMap = new Map<string, { min: number; target: number }>();
  for (const t of activeThresholds) {
    thresholdMap.set(`${t.dayType}-${t.shiftBucket}`, {
      min: t.minStaff,
      target: t.targetStaff,
    });
  }

  // Group assignments by date
  const assignmentsByDate = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const list = assignmentsByDate.get(a.dutyDate) ?? [];
    list.push(a);
    assignmentsByDate.set(a.dutyDate, list);
  }

  const dailyCounts: DailyStaffingCount[] = [];
  const issues: RosterIssue[] = [];
  let totalShortageDays = 0;

  for (const date of periodDates) {
    const dayType = getDayType(date, holidays);
    const dayAssignments = assignmentsByDate.get(date) ?? [];

    const counts: Record<ShiftBucket, number> = {
      am: 0,
      pm: 0,
      night: 0,
      total: 0,
    };

    for (const a of dayAssignments) {
      const bucket = getShiftBucket(a.shiftCode, customSemantics);
      if (bucket) {
        counts[bucket] += 1;
        counts.total += 1;
      }
    }

    const dayThresholds: Record<ShiftBucket, { min: number; target: number }> = {
      am: thresholdMap.get(`${dayType}-am`) ?? { min: 0, target: 0 },
      pm: thresholdMap.get(`${dayType}-pm`) ?? { min: 0, target: 0 },
      night: thresholdMap.get(`${dayType}-night`) ?? { min: 0, target: 0 },
      total: thresholdMap.get(`${dayType}-total`) ?? { min: 0, target: 0 },
    };

    const shortages: ShiftBucket[] = [];
    const bucketsToCheck: ShiftBucket[] = ['am', 'pm', 'night', 'total'];

    for (const b of bucketsToCheck) {
      const min = dayThresholds[b].min;
      if (min > 0 && counts[b] < min) {
        shortages.push(b);
        issues.push({
          id: `staffing-${date}-${b}`,
          code: 'staffing_shortage',
          severity: 'error',
          date,
          message: `${date} (${dayType}): ${b.toUpperCase()} shift is short staffed (${counts[b]}/${min} required).`,
          suggestion: `Assign ${min - counts[b]} additional staff to ${b.toUpperCase()} shift on ${date}.`,
        });
      }
    }

    if (shortages.length > 0) {
      totalShortageDays += 1;
    }

    dailyCounts.push({
      date,
      dayType,
      counts,
      thresholds: dayThresholds,
      shortages,
    });
  }

  return {
    staffing: {
      dailyCounts,
      totalShortageDays,
    },
    issues,
  };
}
