/**
 * Pure Roster Amendments Domain Module (02_TARGET_ARCHITECTURE.md, TASK-005).
 * Deterministic calculation of operational schedules from planned assignments + amendment events.
 */

import type {
  AmendmentCategory,
  AmendmentEvent,
  AmendmentLineAction,
  AmendmentLineItem,
  Assignment,
} from './types';

/**
 * Replays active (non-reversed) amendment events over planned assignments
 * to produce the live operational schedule (Current Roster view).
 */
export function computeCurrentAssignments(
  plannedAssignments: readonly Assignment[],
  amendmentEvents: readonly AmendmentEvent[],
): Assignment[] {
  // Map of (staffId_dutyDate) -> Assignment
  const assignmentMap = new Map<string, Assignment>();

  for (const planned of plannedAssignments) {
    const key = `${planned.staffId}_${planned.dutyDate}`;
    assignmentMap.set(key, { ...planned });
  }

  // Filter only active events (exclude reversed events) and sort chronologically by ID
  const activeEvents = [...amendmentEvents]
    .filter((event) => event.status !== 'reversed')
    .sort((a, b) => a.id - b.id);

  for (const event of activeEvents) {
    for (const line of event.lines) {
      const key = `${line.staffId}_${line.dutyDate}`;
      const existing = assignmentMap.get(key);

      assignmentMap.set(key, {
        staffId: line.staffId,
        dutyDate: line.dutyDate,
        shiftCode: line.toShiftCode,
        note: line.notes ?? existing?.note,
      });
    }
  }

  return Array.from(assignmentMap.values());
}

/**
 * Validates parameters for an absence-only amendment (e.g. sick leave, emergency leave).
 */
export function validateAbsenceOnly(params: {
  staffId: number;
  dutyDate: string;
  fromShiftCode: string;
  toShiftCode: string;
  reason: string;
  notes?: string;
}): { isValid: boolean; errors: string[]; line?: AmendmentLineItem } {
  const errors: string[] = [];

  if (!params.staffId || params.staffId <= 0) {
    errors.push('A valid staff member must be selected.');
  }

  if (!params.dutyDate || !/^\d{4}-\d{2}-\d{2}$/.test(params.dutyDate)) {
    errors.push('A valid duty date (YYYY-MM-DD) is required.');
  }

  if (!params.fromShiftCode) {
    errors.push('Current shift code is required.');
  }

  if (!params.toShiftCode) {
    errors.push('Absence shift code (e.g., EL, MC, AL) is required.');
  }

  if (!params.reason || params.reason.trim().length < 3) {
    errors.push('A meaningful operational reason (at least 3 characters) is required.');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    line: {
      staffId: params.staffId,
      dutyDate: params.dutyDate,
      lineAction: 'absent' as AmendmentLineAction,
      fromShiftCode: params.fromShiftCode,
      toShiftCode: params.toShiftCode,
      notes: params.notes?.trim() || null,
    },
  };
}

/**
 * Validates parameters for an absence with replacement amendment (e.g. sick leave covered by off-duty doctor).
 */
export function validateAbsencePlusReplacement(params: {
  absentStaffId: number;
  replacementStaffId: number;
  dutyDate: string;
  absentFromShiftCode: string;
  absentToShiftCode: string;
  replacementFromShiftCode: string;
  replacementToShiftCode: string;
  reason: string;
  notes?: string;
}): { isValid: boolean; errors: string[]; lines?: [AmendmentLineItem, AmendmentLineItem] } {
  const errors: string[] = [];

  if (!params.absentStaffId || params.absentStaffId <= 0) {
    errors.push('An absent staff member must be selected.');
  }

  if (!params.replacementStaffId || params.replacementStaffId <= 0) {
    errors.push('A replacement staff member must be selected.');
  }

  if (params.absentStaffId === params.replacementStaffId) {
    errors.push('Replacement staff member cannot be the same as the absent staff member.');
  }

  if (!params.dutyDate || !/^\d{4}-\d{2}-\d{2}$/.test(params.dutyDate)) {
    errors.push('A valid duty date (YYYY-MM-DD) is required.');
  }

  if (!params.absentToShiftCode) {
    errors.push('Absence shift code for the absent staff is required.');
  }

  if (!params.replacementToShiftCode) {
    errors.push('Replacement shift code for the covering staff is required.');
  }

  if (!params.reason || params.reason.trim().length < 3) {
    errors.push('A meaningful operational reason (at least 3 characters) is required.');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const absentLine: AmendmentLineItem = {
    staffId: params.absentStaffId,
    dutyDate: params.dutyDate,
    lineAction: 'absent',
    fromShiftCode: params.absentFromShiftCode,
    toShiftCode: params.absentToShiftCode,
    notes: params.notes?.trim() || `Absence covered by staff #${params.replacementStaffId}`,
  };

  const replacementLine: AmendmentLineItem = {
    staffId: params.replacementStaffId,
    dutyDate: params.dutyDate,
    lineAction: 'replace',
    fromShiftCode: params.replacementFromShiftCode,
    toShiftCode: params.replacementToShiftCode,
    notes: params.notes?.trim() || `Covering absence of staff #${params.absentStaffId}`,
  };

  return {
    isValid: true,
    errors: [],
    lines: [absentLine, replacementLine],
  };
}

/**
 * Validates a mutual shift swap between two staff members.
 */
export function validateShiftSwap(params: {
  staffAId: number;
  staffBId: number;
  dateA: string;
  dateB: string;
  shiftA: string;
  shiftB: string;
  reason: string;
  notes?: string;
}): { isValid: boolean; errors: string[]; lines?: AmendmentLineItem[] } {
  const errors: string[] = [];

  if (!params.staffAId || !params.staffBId || params.staffAId <= 0 || params.staffBId <= 0) {
    errors.push('Two distinct staff members must be selected.');
  }

  if (params.staffAId === params.staffBId) {
    errors.push('Cannot swap shifts with the same staff member.');
  }

  if (!params.dateA || !params.dateB) {
    errors.push('Duty dates for both swap sides are required.');
  }

  if (!params.shiftA || !params.shiftB) {
    errors.push('Current shifts for both sides are required.');
  }

  if (!params.reason || params.reason.trim().length < 3) {
    errors.push('A meaningful operational reason (at least 3 characters) is required.');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // If same date: Doctor A takes shiftB, Doctor B takes shiftA
  if (params.dateA === params.dateB) {
    const lineA: AmendmentLineItem = {
      staffId: params.staffAId,
      dutyDate: params.dateA,
      lineAction: 'swap',
      fromShiftCode: params.shiftA,
      toShiftCode: params.shiftB,
      notes: params.notes || `Mutual swap with staff #${params.staffBId}`,
    };
    const lineB: AmendmentLineItem = {
      staffId: params.staffBId,
      dutyDate: params.dateB,
      lineAction: 'swap',
      fromShiftCode: params.shiftB,
      toShiftCode: params.shiftA,
      notes: params.notes || `Mutual swap with staff #${params.staffAId}`,
    };
    return { isValid: true, errors: [], lines: [lineA, lineB] };
  }

  // Cross-date swap:
  // On date A: staff A was shiftA -> becomes shiftB (or whatever B had on date A)
  // On date B: staff B was shiftB -> becomes shiftA
  // More precisely:
  // On date A: staff A gets shiftB, staff B gets shiftA
  // On date B: staff A gets shiftA, staff B gets shiftB
  // Typically, Staff A gives duty on date A to Staff B, and takes duty on date B from Staff B.
  const lineA1: AmendmentLineItem = {
    staffId: params.staffAId,
    dutyDate: params.dateA,
    lineAction: 'swap',
    fromShiftCode: params.shiftA,
    toShiftCode: params.shiftB,
    notes: `Cross-date swap date A with staff #${params.staffBId}`,
  };
  const lineB1: AmendmentLineItem = {
    staffId: params.staffBId,
    dutyDate: params.dateA,
    lineAction: 'swap',
    fromShiftCode: params.shiftB,
    toShiftCode: params.shiftA,
    notes: `Cross-date swap date A with staff #${params.staffAId}`,
  };
  const lineA2: AmendmentLineItem = {
    staffId: params.staffAId,
    dutyDate: params.dateB,
    lineAction: 'swap',
    fromShiftCode: params.shiftB,
    toShiftCode: params.shiftA,
    notes: `Cross-date swap date B with staff #${params.staffBId}`,
  };
  const lineB2: AmendmentLineItem = {
    staffId: params.staffBId,
    dutyDate: params.dateB,
    lineAction: 'swap',
    fromShiftCode: params.shiftA,
    toShiftCode: params.shiftB,
    notes: `Cross-date swap date B with staff #${params.staffAId}`,
  };

  return { isValid: true, errors: [], lines: [lineA1, lineB1, lineA2, lineB2] };
}

/**
 * Validates an administrative correction to a roster cell.
 */
export function validateAdminCorrection(params: {
  staffId: number;
  dutyDate: string;
  fromShiftCode: string;
  toShiftCode: string;
  reason: string;
  notes?: string;
}): { isValid: boolean; errors: string[]; line?: AmendmentLineItem } {
  const errors: string[] = [];

  if (!params.staffId || params.staffId <= 0) {
    errors.push('A valid staff member must be selected.');
  }

  if (!params.dutyDate || !/^\d{4}-\d{2}-\d{2}$/.test(params.dutyDate)) {
    errors.push('A valid duty date (YYYY-MM-DD) is required.');
  }

  if (!params.fromShiftCode || !params.toShiftCode) {
    errors.push('Both current and target shift codes are required.');
  }

  if (params.fromShiftCode === params.toShiftCode) {
    errors.push('Target shift code must differ from the current shift code.');
  }

  if (!params.reason || params.reason.trim().length < 3) {
    errors.push('A meaningful operational reason (at least 3 characters) is required.');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    line: {
      staffId: params.staffId,
      dutyDate: params.dutyDate,
      lineAction: 'modify',
      fromShiftCode: params.fromShiftCode,
      toShiftCode: params.toShiftCode,
      notes: params.notes?.trim() || null,
    },
  };
}

/**
 * Formats amendment categories for human-readable UI presentation.
 */
export function formatAmendmentCategoryLabel(category: AmendmentCategory): string {
  switch (category) {
    case 'absence_only':
      return 'Absence (Uncovered)';
    case 'absence_plus_replacement':
      return 'Absence + Replacement';
    case 'shift_swap':
      return 'Mutual Shift Swap';
    case 'admin_correction':
      return 'Admin Correction';
    case 'reversal':
      return 'Reversal';
    default:
      return category;
  }
}
