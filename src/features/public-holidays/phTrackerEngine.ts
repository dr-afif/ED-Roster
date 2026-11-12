import { classifyPublicHolidayShift } from './constants';
import type {
  GhkaUsage,
  OpeningBalanceEntry,
  PhCredit,
  PhWarning,
  StaffPhSummary,
  TrackerMatrixRow,
} from './types';

export interface RosterAssignmentEntry {
  staffId: number;
  staffName: string;
  staffCode?: string;
  assignmentDate: string; // YYYY-MM-DD
  shiftCode: string;
}

/**
 * 1. Calculate Public Holiday Credits earned from active shifts worked on gazetted public holidays.
 */
export function getPublicHolidayCredits(
  assignments: RosterAssignmentEntry[],
  holidays: Record<string, string>,
  activeStaffIds?: Set<number>,
): PhCredit[] {
  const credits: PhCredit[] = [];

  assignments.forEach((entry) => {
    if (activeStaffIds && !activeStaffIds.has(entry.staffId)) return;

    const holidayName = holidays[entry.assignmentDate];
    if (!holidayName) return;

    const classification = classifyPublicHolidayShift(entry.shiftCode);
    if (classification.earnsCredit) {
      credits.push({
        staffId: entry.staffId,
        staffName: entry.staffName,
        staffCode: entry.staffCode,
        holidayDate: entry.assignmentDate,
        holidayName: holidayName,
        workedShift: classification.normalizedShift,
        originalShift: entry.shiftCode,
        creditEarned: true,
        status: 'PENDING',
        matchedGhkaDate: null,
        source: 'auto',
      });
    }
  });

  return credits.sort((a, b) => (a.holidayDate || '').localeCompare(b.holidayDate || ''));
}

/**
 * 2. Calculate GHKA Replacement days taken.
 */
export function getGhkaUsages(
  assignments: RosterAssignmentEntry[],
  activeStaffIds?: Set<number>,
): GhkaUsage[] {
  const usages: GhkaUsage[] = [];

  assignments.forEach((entry) => {
    if (activeStaffIds && !activeStaffIds.has(entry.staffId)) return;

    const clean = entry.shiftCode
      .replace(/\(s\)/i, '')
      .replace(/-s/i, '')
      .replace(/\(x\)/i, '')
      .replace(/-x/i, '')
      .trim()
      .toUpperCase();

    if (clean === 'GHKA') {
      usages.push({
        staffId: entry.staffId,
        staffName: entry.staffName,
        staffCode: entry.staffCode,
        ghkaDate: entry.assignmentDate,
      });
    }
  });

  return usages.sort((a, b) => a.ghkaDate.localeCompare(b.ghkaDate));
}

/**
 * 3. Match earned credits and opening balances to GHKA usages using chronological FIFO.
 */
export function matchGhkaToCredits(
  credits: PhCredit[],
  usages: GhkaUsage[],
  openingBalances: OpeningBalanceEntry[] = [],
  staffList: Array<{ id: number; name: string; staffCode?: string }> = [],
): {
  matchedRecords: PhCredit[];
  unmatchedUsages: GhkaUsage[];
} {
  const syntheticCredits: PhCredit[] = [];

  openingBalances.forEach((ob) => {
    if (ob.openingBalance > 0) {
      const staff = staffList.find((s) => s.id === ob.staffId);
      const name = staff?.name || `Staff #${ob.staffId}`;
      for (let i = 0; i < ob.openingBalance; i++) {
        syntheticCredits.push({
          staffId: ob.staffId,
          staffName: name,
          staffCode: staff?.staffCode,
          holidayDate: null,
          holidayName: ob.note ? `Carry-forward (${ob.note})` : 'Carry-forward GHKA credit',
          workedShift: 'CARRY_FORWARD',
          creditEarned: true,
          status: 'PENDING',
          matchedGhkaDate: null,
          source: 'opening_balance',
        });
      }
    }
  });

  const creditsByStaff: Record<number, PhCredit[]> = {};
  const usagesByStaff: Record<number, GhkaUsage[]> = {};

  const allCredits = [...syntheticCredits, ...credits];

  allCredits.forEach((c) => {
    const list = creditsByStaff[c.staffId] || [];
    list.push({ ...c });
    creditsByStaff[c.staffId] = list;
  });

  usages.forEach((u) => {
    const list = usagesByStaff[u.staffId] || [];
    list.push({ ...u });
    usagesByStaff[u.staffId] = list;
  });

  const matchedRecords: PhCredit[] = [];
  const unmatchedUsages: GhkaUsage[] = [];

  const allStaffIds = new Set<number>([
    ...Object.keys(creditsByStaff).map(Number),
    ...Object.keys(usagesByStaff).map(Number),
    ...staffList.map((s) => s.id),
  ]);

  allStaffIds.forEach((staffId) => {
    const docCredits = creditsByStaff[staffId] || [];
    const docUsages = usagesByStaff[staffId] || [];

    let usageIdx = 0;

    docCredits.forEach((credit) => {
      let matchedGhkaDate: string | null = null;
      let status: 'USED' | 'PENDING' = 'PENDING';

      const usage = docUsages[usageIdx];
      if (usage) {
        matchedGhkaDate = usage.ghkaDate;
        status = 'USED';
        usageIdx++;
      }

      matchedRecords.push({
        ...credit,
        matchedGhkaDate,
        status,
      });
    });

    while (usageIdx < docUsages.length) {
      const leftover = docUsages[usageIdx];
      if (leftover) {
        unmatchedUsages.push(leftover);
      }
      usageIdx++;
    }
  });

  return { matchedRecords, unmatchedUsages };
}

/**
 * 4. Build staff summaries with balance metrics.
 */
export function buildStaffSummaries(
  matchedRecords: PhCredit[],
  unmatchedUsages: GhkaUsage[],
  staffList: Array<{ id: number; name: string; staffCode?: string }>,
  openingBalances: OpeningBalanceEntry[] = [],
): StaffPhSummary[] {
  const summaries: StaffPhSummary[] = staffList.map((staff) => {
    const ob = openingBalances.find((b) => b.staffId === staff.id);
    return {
      staffId: staff.id,
      staffName: staff.name,
      staffCode: staff.staffCode,
      openingBalance: ob?.openingBalance || 0,
      phWorked: 0,
      ghkaUsed: 0,
      usedFromOpeningBalance: 0,
      usedFromCurrentYearCredit: 0,
      outstanding: 0,
      oldOutstanding: 0,
      excessGhkaUsed: 0,
    };
  });

  const sumMap = new Map<number, StaffPhSummary>();
  summaries.forEach((s) => sumMap.set(s.staffId, s));

  matchedRecords.forEach((record) => {
    const s = sumMap.get(record.staffId);
    if (!s) return;

    if (record.source === 'auto') {
      s.phWorked++;
    }

    if (record.status === 'USED') {
      s.ghkaUsed++;
      if (record.source === 'opening_balance') {
        s.usedFromOpeningBalance++;
      } else {
        s.usedFromCurrentYearCredit++;
      }
    } else if (record.status === 'PENDING') {
      if (record.source === 'opening_balance') {
        s.oldOutstanding++;
      } else if (record.holidayDate) {
        const d = new Date(record.holidayDate);
        const now = new Date();
        const monthDiff =
          (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (monthDiff > 3) {
          s.oldOutstanding++;
        }
      }
    }
  });

  unmatchedUsages.forEach((u) => {
    const s = sumMap.get(u.staffId);
    if (s) {
      s.ghkaUsed++;
    }
  });

  summaries.forEach((s) => {
    const totalAvailable = s.openingBalance + s.phWorked;
    s.outstanding = Math.max(0, totalAvailable - s.ghkaUsed);
    s.excessGhkaUsed = Math.max(0, s.ghkaUsed - totalAvailable);
  });

  return summaries.sort(
    (a, b) =>
      b.outstanding - a.outstanding ||
      b.phWorked - a.phWorked ||
      a.staffName.localeCompare(b.staffName),
  );
}

/**
 * 5. Build warnings for outstanding replacements and excess GHKA taken.
 */
export function buildTrackerWarnings(summaries: StaffPhSummary[]): PhWarning[] {
  const warnings: PhWarning[] = [];

  summaries.forEach((s) => {
    if (s.oldOutstanding > 0) {
      warnings.push({
        staffId: s.staffId,
        staffName: s.staffName,
        type: 'OLD_OUTSTANDING_GHKA',
        message: `${s.staffName} has ${s.oldOutstanding} outstanding GHKA replacement(s) older than 3 months.`,
        severity: 'medium',
        count: s.oldOutstanding,
      });
    }

    if (s.excessGhkaUsed > 0) {
      warnings.push({
        staffId: s.staffId,
        staffName: s.staffName,
        type: 'EXCESS_GHKA',
        message: `${s.staffName} has taken ${s.excessGhkaUsed} GHKA shift(s) exceeding available credits.`,
        severity: 'high',
        count: s.excessGhkaUsed,
      });
    }
  });

  return warnings.sort((a, b) => {
    if (a.severity === 'high' && b.severity !== 'high') return -1;
    if (a.severity !== 'high' && b.severity === 'high') return 1;
    return b.count - a.count;
  });
}

/**
 * 6. Build Month/Year tracker matrix.
 */
export function buildTrackerMatrix(
  matchedRecords: PhCredit[],
  assignments: RosterAssignmentEntry[],
  holidays: Record<string, string>,
  yearFilter?: string,
): TrackerMatrixRow[] {
  const activeYear = yearFilter || String(new Date().getFullYear());

  const holidaysInYear = Object.entries(holidays)
    .filter(([date]) => date.startsWith(activeYear))
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB));

  const rows: TrackerMatrixRow[] = holidaysInYear.map(([date, name]) => {
    const doctors: TrackerMatrixRow['doctors'] = {};

    assignments
      .filter((a) => a.assignmentDate === date)
      .forEach((a) => {
        const classification = classifyPublicHolidayShift(a.shiftCode);
        const matched =
          matchedRecords.find((m) => m.staffId === a.staffId && m.holidayDate === date) || null;

        doctors[a.staffId] = {
          classification,
          originalShift: a.shiftCode,
          matchedRecord: matched,
        };
      });

    return {
      date,
      name,
      doctors,
    };
  });

  return rows;
}
