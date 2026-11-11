import { isResetShift, isTransparentShift, isWorkedShift, normalizeShiftCode } from './semantics';
import type { RosterIssue, SequenceResult, ShiftSemanticDefinition } from './types';

export type DailyAssignmentEntry = {
  readonly date: string;
  readonly shiftCode: string;
};

/**
 * Evaluates consecutive worked sequences and night rest/bundles for a single staff member across ordered dates.
 */
export function evaluateStaffSequences(
  staffId: number,
  staffName: string,
  orderedAssignments: readonly DailyAssignmentEntry[],
  maxConsecutiveDays = 6,
  customSemantics?: readonly ShiftSemanticDefinition[],
): {
  result: SequenceResult;
  issues: RosterIssue[];
} {
  const issues: RosterIssue[] = [];
  const excessiveSequences: { startDate: string; endDate: string; length: number }[] = [];
  const nightBundleIssues: { date: string; pattern: string; issue: string }[] = [];

  let currentWorkedCount = 0;
  let currentSeqStartDate: string | null = null;
  let maxWorkedSequence = 0;

  for (let i = 0; i < orderedAssignments.length; i++) {
    const cur = orderedAssignments[i];
    if (!cur) continue;

    const { base: curBase } = normalizeShiftCode(cur.shiftCode);
    const isWorked = isWorkedShift(cur.shiftCode, customSemantics);
    const isTrans = isTransparentShift(cur.shiftCode, customSemantics);
    const isReset = isResetShift(cur.shiftCode, customSemantics);

    // 1. CONSECUTIVE WORK EVALUATION
    if (isWorked) {
      currentWorkedCount += 1;
      if (!currentSeqStartDate) {
        currentSeqStartDate = cur.date;
      }
      if (currentWorkedCount > maxWorkedSequence) {
        maxWorkedSequence = currentWorkedCount;
      }

      if (currentWorkedCount > maxConsecutiveDays) {
        // Record excessive sequence if not already recorded for this sequence
        const existing = excessiveSequences.find((s) => s.startDate === currentSeqStartDate);
        if (existing) {
          existing.endDate = cur.date;
          existing.length = currentWorkedCount;
        } else if (currentSeqStartDate) {
          excessiveSequences.push({
            startDate: currentSeqStartDate,
            endDate: cur.date,
            length: currentWorkedCount,
          });
        }

        issues.push({
          id: `consecutive-${staffId}-${cur.date}`,
          code: 'consecutive_work_exceeded',
          severity: 'warning',
          staffId,
          staffName,
          date: cur.date,
          message: `${staffName} has worked ${currentWorkedCount} consecutive shifts on ${cur.date} (maximum recommended is ${maxConsecutiveDays}).`,
          suggestion: 'Schedule a rest day (OFF) or compensatory rest to avoid fatigue.',
        });
      }
    } else if (isTrans) {
      // PN is transparent: neither increments nor resets the sequence
    } else if (isReset) {
      currentWorkedCount = 0;
      currentSeqStartDate = null;
    }

    // 2. NIGHT BUNDLE AND REST EVALUATION
    const next = orderedAssignments[i + 1];
    const prev = orderedAssignments[i - 1];
    const nextBase = next ? normalizeShiftCode(next.shiftCode).base : null;
    const prevBase = prev ? normalizeShiftCode(prev.shiftCode).base : null;

    // A: Single-night duty: ON, NIGHT, N
    if (['ON', 'NIGHT', 'N'].includes(curBase)) {
      if (next) {
        // If next shift is a worked shift (not PN and not reset), warn for lack of rest
        if (isWorkedShift(next.shiftCode, customSemantics)) {
          const issueDesc = `Night duty on ${cur.date} followed directly by worked shift (${nextBase}) on ${next.date} without required post-night rest (PN).`;
          nightBundleIssues.push({
            date: cur.date,
            pattern: `${curBase} -> ${nextBase}`,
            issue: issueDesc,
          });
          issues.push({
            id: `night-rest-${staffId}-${cur.date}`,
            code: 'insufficient_night_rest',
            severity: 'error',
            staffId,
            staffName,
            date: cur.date,
            message: `${staffName}: ${issueDesc}`,
            suggestion: `Assign PN or OFF on ${next.date} following night shift.`,
          });
        }
      }
    }

    // B: Split bundle ON1: Should be followed by ON2 or PN
    if (curBase === 'ON1') {
      if (next) {
        if (nextBase !== 'ON2' && nextBase !== 'PN') {
          const issueDesc = `Bundle night ON1 on ${cur.date} followed by ${nextBase} on ${next.date}; expected ON2 or PN.`;
          nightBundleIssues.push({
            date: cur.date,
            pattern: `ON1 -> ${nextBase}`,
            issue: issueDesc,
          });
          issues.push({
            id: `bundle-on1-${staffId}-${cur.date}`,
            code: 'broken_night_bundle',
            severity: 'warning',
            staffId,
            staffName,
            date: cur.date,
            message: `${staffName}: ${issueDesc}`,
            suggestion: 'Follow ON1 with ON2 for a two-night bundle or PN for single night.',
          });
        }
      }
    }

    // C: Split bundle ON2: Should be preceded by ON1 and followed by PN
    if (curBase === 'ON2') {
      if (prev && prevBase !== 'ON1') {
        const issueDesc = `Bundle night ON2 on ${cur.date} preceded by ${prevBase} on ${prev.date}; expected ON1.`;
        nightBundleIssues.push({
          date: cur.date,
          pattern: `${prevBase} -> ON2`,
          issue: issueDesc,
        });
        issues.push({
          id: `bundle-on2-prev-${staffId}-${cur.date}`,
          code: 'broken_night_bundle',
          severity: 'warning',
          staffId,
          staffName,
          date: cur.date,
          message: `${staffName}: ${issueDesc}`,
          suggestion: 'Ensure ON2 is preceded by ON1.',
        });
      }

      if (next && nextBase !== 'PN') {
        const issueDesc = `Bundle night ON2 on ${cur.date} followed by ${nextBase} on ${next.date}; expected PN.`;
        nightBundleIssues.push({
          date: cur.date,
          pattern: `ON2 -> ${nextBase}`,
          issue: issueDesc,
        });
        issues.push({
          id: `bundle-on2-next-${staffId}-${cur.date}`,
          code: 'insufficient_night_rest',
          severity: 'error',
          staffId,
          staffName,
          date: cur.date,
          message: `${staffName}: ${issueDesc}`,
          suggestion: `Assign PN on ${next.date} following two consecutive nights.`,
        });
      }
    }
  }

  return {
    result: {
      staffId,
      maxWorkedSequence,
      excessiveSequences,
      nightBundleIssues,
    },
    issues,
  };
}
