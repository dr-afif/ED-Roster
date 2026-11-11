/**
 * Pure Compensatory Rest (GOFF) Domain Module (02_TARGET_ARCHITECTURE.md, TASK-005).
 * Deterministic balance calculation and accrual detection for Emergency Department doctors.
 */

import type { Assignment, GoffLedgerEntry, ShiftSemanticDefinition } from './types';

export type GoffBalanceSummary = {
  opening: number;
  earned: number;
  used: number;
  adjustments: number;
  netBalance: number;
};

export type GoffDisplacementCandidate = {
  staffId: number;
  dutyDate: string;
  originalShiftCode: string;
  newShiftCode: string;
  reason: string;
};

/**
 * Calculates current GOFF balance metrics for a specific staff member.
 */
export function calculateStaffGoffBalance(
  entries: readonly GoffLedgerEntry[],
  staffId: number,
): GoffBalanceSummary {
  const staffEntries = entries.filter((e) => e.staffId === staffId);

  let opening = 0;
  let earned = 0;
  let used = 0;
  let adjustments = 0;

  for (const entry of staffEntries) {
    switch (entry.transactionType) {
      case 'opening_balance':
        opening += entry.amount;
        break;
      case 'earned':
        earned += entry.amount;
        break;
      case 'used':
        used += entry.amount;
        break;
      case 'adjustment':
        adjustments += entry.amount;
        break;
      case 'expired':
        adjustments -= entry.amount;
        break;
    }
  }

  const netBalance = opening + earned - used + adjustments;

  return {
    opening,
    earned,
    used,
    adjustments,
    netBalance,
  };
}

/**
 * Summarizes GOFF balance metrics for all staff members across the ledger.
 */
export function summarizeAllStaffGoffBalances(
  entries: readonly GoffLedgerEntry[],
): Map<number, GoffBalanceSummary> {
  const resultMap = new Map<number, GoffBalanceSummary>();

  const staffIds = Array.from(new Set(entries.map((e) => e.staffId)));

  for (const staffId of staffIds) {
    resultMap.set(staffId, calculateStaffGoffBalance(entries, staffId));
  }

  return resultMap;
}

/**
 * Detects whether operational schedule changes displaced a planned normal OFF or GOFF
 * with a duty shift providing emergency coverage, qualifying the doctor for +1 GOFF accrual.
 */
export function detectOffDisplacementGoffAccruals(
  plannedAssignments: readonly Assignment[],
  currentAssignments: readonly Assignment[],
  shiftSemantics: readonly ShiftSemanticDefinition[],
): GoffDisplacementCandidate[] {
  const coverageCodes = new Set(
    shiftSemantics.filter((s) => s.providesCoverage).map((s) => s.shiftCode.toUpperCase()),
  );

  const offCodes = new Set(
    shiftSemantics
      .filter((s) => s.semanticClass === 'reset' && !s.providesCoverage)
      .map((s) => s.shiftCode.toUpperCase()),
  );
  // Guarantee common rest codes
  offCodes.add('OFF');
  offCodes.add('GOFF');

  const plannedMap = new Map<string, Assignment>();
  for (const p of plannedAssignments) {
    plannedMap.set(`${p.staffId}_${p.dutyDate}`, p);
  }

  const candidates: GoffDisplacementCandidate[] = [];

  for (const cur of currentAssignments) {
    const key = `${cur.staffId}_${cur.dutyDate}`;
    const orig = plannedMap.get(key);

    if (!orig) continue;

    const origCode = orig.shiftCode.toUpperCase();
    const curCode = cur.shiftCode.toUpperCase();

    // If planned was OFF or GOFF, and live duty became a coverage-providing shift
    if (offCodes.has(origCode) && coverageCodes.has(curCode)) {
      candidates.push({
        staffId: cur.staffId,
        dutyDate: cur.dutyDate,
        originalShiftCode: orig.shiftCode,
        newShiftCode: cur.shiftCode,
        reason: `Displaced planned ${orig.shiftCode} with coverage shift ${cur.shiftCode} on ${cur.dutyDate}`,
      });
    }
  }

  return candidates;
}
