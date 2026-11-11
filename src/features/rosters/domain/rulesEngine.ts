import { getShiftSemantic, normalizeShiftCode } from './semantics';
import { evaluateStaffSequences } from './sequences';
import { evaluateStaffing } from './staffing';
import type {
  Assignment,
  GoffPosition,
  GoffProjection,
  RosterIssue,
  RulesInput,
  RulesOutput,
  SequenceResult,
  WeeklyOffResult,
} from './types';
import { evaluateWeeklyOffForStaff, getRosterWeeks } from './weeklyOff';

/**
 * Fast deterministic string hash for reproducible checksums in pure environments.
 */
function computeDeterministicChecksum(data: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Generates all consecutive date strings (YYYY-MM-DD) between startDate and endDate inclusive.
 */
export function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Pure Roster Rules Engine Master Function.
 * Completely deterministic: given identical input, produces identical output and checksum.
 */
export function evaluateRosterRules(input: RulesInput): RulesOutput {
  const {
    period,
    people,
    assignments,
    adjacentAssignments = [],
    holidays = [],
    ledger = [],
    configuration,
  } = input;

  const issues: RosterIssue[] = [];
  const weeklyOffResults: WeeklyOffResult[] = [];
  const sequenceResults: SequenceResult[] = [];
  const goffProjections: GoffProjection[] = [];

  const periodDates = getDatesInRange(period.periodStart, period.periodEnd);
  const weeks = getRosterWeeks(period.periodStart, period.periodEnd);

  // Index people for quick lookup
  const peopleMap = new Map(people.map((p) => [p.id, p]));

  // Index all assignments by staffId and date
  const assignmentsByStaff = new Map<number, Map<string, Assignment>>();
  const allAssignments = [...assignments, ...adjacentAssignments];

  for (const a of allAssignments) {
    let staffMap = assignmentsByStaff.get(a.staffId);
    if (!staffMap) {
      staffMap = new Map<string, Assignment>();
      assignmentsByStaff.set(a.staffId, staffMap);
    }
    staffMap.set(a.dutyDate, a);

    // 1. Check for unknown shift codes
    const semantic = getShiftSemantic(a.shiftCode, configuration.semantics);
    if (semantic.semanticClass === 'unknown') {
      const staffName = peopleMap.get(a.staffId)?.rosterName ?? `Staff ${a.staffId}`;
      issues.push({
        id: `unknown-code-${a.staffId}-${a.dutyDate}`,
        code: 'unknown_shift_code',
        severity: 'error',
        staffId: a.staffId,
        staffName,
        date: a.dutyDate,
        message: `${staffName} assigned unmapped shift code "${a.shiftCode}" on ${a.dutyDate}.`,
        suggestion: 'Map this shift code in Shift Definitions or replace with a recognized code.',
      });
    }
  }

  // 2. Evaluate Weekly OFF and Sequences per person
  for (const person of people) {
    const staffAssignmentsMap = assignmentsByStaff.get(person.id) ?? new Map<string, Assignment>();

    // A: Weekly OFF evaluation across all roster weeks
    for (const week of weeks) {
      const shiftMap = new Map<string, string>();
      for (const d of week.dates) {
        const a = staffAssignmentsMap.get(d);
        if (a) {
          shiftMap.set(d, a.shiftCode);
        }
      }

      const hasAdjacent = adjacentAssignments.length > 0;
      const offResult = evaluateWeeklyOffForStaff(
        person.id,
        week,
        shiftMap,
        configuration.weeklyOffPolicy,
        configuration.nightQualifyingCodes,
        configuration.semantics,
        hasAdjacent,
      );

      weeklyOffResults.push(offResult);

      if (offResult.status === 'short') {
        const reqStr = offResult.requiredOff === 1 ? '1 OFF' : '2 OFFs';
        const nightNote = offResult.hasQualifyingNight
          ? ' (Night duty worked requires 1 OFF)'
          : ' (No night duty worked requires 2 OFFs)';
        issues.push({
          id: `missing-off-${person.id}-${week.weekStart}`,
          code: 'missing_weekly_off',
          severity: 'error',
          staffId: person.id,
          staffName: person.rosterName,
          weekStart: week.weekStart,
          message: `${person.rosterName}: Missing weekly OFF for week ${week.weekStart} to ${week.weekEnd}. Entitled to ${reqStr}${nightNote}, but has ${offResult.actualOff}.`,
          suggestion: `Assign ${offResult.requiredOff - offResult.actualOff} additional normal OFF(s) during this week.`,
        });
      } else if (offResult.status === 'provisional') {
        issues.push({
          id: `provisional-week-${person.id}-${week.weekStart}`,
          code: 'provisional_boundary_week',
          severity: 'info',
          staffId: person.id,
          staffName: person.rosterName,
          weekStart: week.weekStart,
          message: `${person.rosterName}: Week ${week.weekStart} overlaps adjacent month boundary and is provisional.`,
          suggestion:
            'Ensure adjacent month roster assignments are loaded for full compliance verification.',
        });
      }
    }

    // B: Consecutive sequence & night bundle evaluation
    const sortedDates = Array.from(staffAssignmentsMap.keys()).sort();
    const orderedEntries = sortedDates.map((date) => ({
      date,
      shiftCode: staffAssignmentsMap.get(date)?.shiftCode ?? '',
    }));

    const { result: seqResult, issues: seqIssues } = evaluateStaffSequences(
      person.id,
      person.rosterName,
      orderedEntries,
      configuration.maxConsecutiveDays,
      configuration.semantics,
    );

    sequenceResults.push(seqResult);
    issues.push(...seqIssues);
  }

  // 3. Evaluate Staffing Coverage Thresholds
  const { staffing, issues: staffingIssues } = evaluateStaffing(
    periodDates,
    assignments,
    configuration.staffingThresholds,
    holidays,
    configuration.semantics,
  );
  issues.push(...staffingIssues);

  // 4. Calculate GOFF Projections
  const ledgerMap = new Map<number, GoffPosition>(ledger.map((l) => [l.staffId, l]));

  for (const person of people) {
    const pos = ledgerMap.get(person.id) ?? {
      staffId: person.id,
      openingBalance: 0,
      earned: 0,
      used: 0,
      activeReservations: 0,
    };

    const currentBalance = pos.openingBalance + pos.earned - pos.used;
    const availableBalance = currentBalance - pos.activeReservations;

    // Count draft uses in current period (e.g. shifts assigned as GOFF)
    const staffAssignmentsMap = assignmentsByStaff.get(person.id) ?? new Map<string, Assignment>();
    let draftUses = 0;
    for (const d of periodDates) {
      const a = staffAssignmentsMap.get(d);
      if (a) {
        const { base } = normalizeShiftCode(a.shiftCode);
        if (base === 'GOFF') {
          draftUses += 1;
        }
      }
    }

    const pendingEarns = 0; // Earned on close when normal OFF is displaced
    const projectedBalance = availableBalance + pendingEarns - draftUses;

    if (projectedBalance < 0) {
      issues.push({
        id: `goff-deficit-${person.id}`,
        code: 'goff_unavailable',
        severity: 'error',
        staffId: person.id,
        staffName: person.rosterName,
        message: `${person.rosterName} has negative projected GOFF balance (${projectedBalance}). Available: ${availableBalance}, Draft GOFFs assigned: ${draftUses}.`,
        suggestion: 'Replace unearned GOFF assignment with standard OFF or leave.',
      });
    }

    goffProjections.push({
      staffId: person.id,
      currentBalance,
      availableBalance,
      projectedBalance,
      pendingEarns,
      draftUses,
    });
  }

  // 5. Deterministic Checksum
  // Sort assignments canonically by staffId and date
  const canonicalAssignments = [...assignments]
    .sort((a, b) => a.staffId - b.staffId || a.dutyDate.localeCompare(b.dutyDate))
    .map((a) => `${a.staffId}:${a.dutyDate}:${normalizeShiftCode(a.shiftCode).raw}`)
    .join('|');

  const checksumInput = `P:${period.id}:REV:${period.revision}:POLICY:${configuration.weeklyOffPolicy}:ASSIGNMENTS:[${canonicalAssignments}]`;
  const checksum = computeDeterministicChecksum(checksumInput);

  return {
    issues,
    weeklyOff: weeklyOffResults,
    staffing,
    sequences: sequenceResults,
    goffProjections,
    checksum,
  };
}
