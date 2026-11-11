import { describe, expect, it } from 'vitest';
import {
  computeCurrentAssignments,
  formatAmendmentCategoryLabel,
  validateAbsenceOnly,
  validateAbsencePlusReplacement,
  validateAdminCorrection,
  validateShiftSwap,
} from '../amendments';
import type { AmendmentEvent, Assignment } from '../types';

describe('Roster Amendments Domain Module', () => {
  const basePlanned: Assignment[] = [
    { staffId: 101, dutyDate: '2027-01-15', shiftCode: 'AM' },
    { staffId: 101, dutyDate: '2027-01-16', shiftCode: 'PM' },
    { staffId: 102, dutyDate: '2027-01-15', shiftCode: 'OFF' },
    { staffId: 102, dutyDate: '2027-01-16', shiftCode: 'AM' },
  ];

  it('returns planned assignments intact when there are no amendment events', () => {
    const current = computeCurrentAssignments(basePlanned, []);
    expect(current).toHaveLength(4);
    expect(current.find((a) => a.staffId === 101 && a.dutyDate === '2027-01-15')?.shiftCode).toBe(
      'AM',
    );
  });

  it('replays an active absence-only amendment over planned assignments', () => {
    const event: AmendmentEvent = {
      id: 1,
      periodId: 10,
      category: 'absence_only',
      reason: 'Acute medical illness / MC',
      status: 'active',
      createdAt: '2027-01-14T10:00:00Z',
      lines: [
        {
          staffId: 101,
          dutyDate: '2027-01-15',
          lineAction: 'absent',
          fromShiftCode: 'AM',
          toShiftCode: 'MC',
          notes: 'Sick leave Day 1',
        },
      ],
    };

    const current = computeCurrentAssignments(basePlanned, [event]);
    const cell101 = current.find((a) => a.staffId === 101 && a.dutyDate === '2027-01-15');
    expect(cell101?.shiftCode).toBe('MC');
    expect(cell101?.note).toBe('Sick leave Day 1');

    // Untouched cell remains as planned
    const cell102 = current.find((a) => a.staffId === 102 && a.dutyDate === '2027-01-15');
    expect(cell102?.shiftCode).toBe('OFF');
  });

  it('replays absence with replacement updating both doctors', () => {
    const event: AmendmentEvent = {
      id: 2,
      periodId: 10,
      category: 'absence_plus_replacement',
      reason: 'Emergency Leave covered by Dr 102',
      status: 'active',
      createdAt: '2027-01-14T12:00:00Z',
      lines: [
        {
          staffId: 101,
          dutyDate: '2027-01-15',
          lineAction: 'absent',
          fromShiftCode: 'AM',
          toShiftCode: 'EL',
        },
        {
          staffId: 102,
          dutyDate: '2027-01-15',
          lineAction: 'replace',
          fromShiftCode: 'OFF',
          toShiftCode: 'AM',
        },
      ],
    };

    const current = computeCurrentAssignments(basePlanned, [event]);
    expect(current.find((a) => a.staffId === 101 && a.dutyDate === '2027-01-15')?.shiftCode).toBe(
      'EL',
    );
    expect(current.find((a) => a.staffId === 102 && a.dutyDate === '2027-01-15')?.shiftCode).toBe(
      'AM',
    );
  });

  it('excludes reversed amendment events and restores planned state', () => {
    const reversedEvent: AmendmentEvent = {
      id: 1,
      periodId: 10,
      category: 'absence_only',
      reason: 'Erroneous absence reported',
      status: 'reversed',
      reversedByEventId: 2,
      reversalReason: 'Doctor confirmed attendance',
      createdAt: '2027-01-14T10:00:00Z',
      lines: [
        {
          staffId: 101,
          dutyDate: '2027-01-15',
          lineAction: 'absent',
          fromShiftCode: 'AM',
          toShiftCode: 'MC',
        },
      ],
    };

    const current = computeCurrentAssignments(basePlanned, [reversedEvent]);
    expect(current.find((a) => a.staffId === 101 && a.dutyDate === '2027-01-15')?.shiftCode).toBe(
      'AM',
    );
  });

  it('validates absence only parameters correctly', () => {
    const valid = validateAbsenceOnly({
      staffId: 101,
      dutyDate: '2027-01-15',
      fromShiftCode: 'AM',
      toShiftCode: 'MC',
      reason: 'Sudden fever and respiratory symptoms',
    });
    expect(valid.isValid).toBe(true);
    expect(valid.line?.lineAction).toBe('absent');

    const invalid = validateAbsenceOnly({
      staffId: 0,
      dutyDate: 'bad-date',
      fromShiftCode: '',
      toShiftCode: '',
      reason: 'hi',
    });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('validates absence with replacement parameters and disallows same staff', () => {
    const sameStaff = validateAbsencePlusReplacement({
      absentStaffId: 101,
      replacementStaffId: 101,
      dutyDate: '2027-01-15',
      absentFromShiftCode: 'AM',
      absentToShiftCode: 'EL',
      replacementFromShiftCode: 'OFF',
      replacementToShiftCode: 'AM',
      reason: 'Valid reason here',
    });
    expect(sameStaff.isValid).toBe(false);
    expect(sameStaff.errors).toContain(
      'Replacement staff member cannot be the same as the absent staff member.',
    );

    const valid = validateAbsencePlusReplacement({
      absentStaffId: 101,
      replacementStaffId: 102,
      dutyDate: '2027-01-15',
      absentFromShiftCode: 'AM',
      absentToShiftCode: 'EL',
      replacementFromShiftCode: 'OFF',
      replacementToShiftCode: 'AM',
      reason: 'Family emergency coverage agreed',
    });
    expect(valid.isValid).toBe(true);
    expect(valid.lines).toHaveLength(2);
  });

  it('validates mutual shift swap', () => {
    const valid = validateShiftSwap({
      staffAId: 101,
      staffBId: 102,
      dateA: '2027-01-15',
      dateB: '2027-01-15',
      shiftA: 'AM',
      shiftB: 'PM',
      reason: 'Mutual agreement for childcare duties',
    });
    expect(valid.isValid).toBe(true);
    const lines = valid.lines ?? [];
    expect(lines).toHaveLength(2);
    expect(lines[0]?.toShiftCode).toBe('PM');
    expect(lines[1]?.toShiftCode).toBe('AM');
  });

  it('validates admin correction rejects identical shift', () => {
    const identical = validateAdminCorrection({
      staffId: 101,
      dutyDate: '2027-01-15',
      fromShiftCode: 'AM',
      toShiftCode: 'AM',
      reason: 'Administrative update',
    });
    expect(identical.isValid).toBe(false);
    expect(identical.errors).toContain(
      'Target shift code must differ from the current shift code.',
    );
  });

  it('formats category labels nicely', () => {
    expect(formatAmendmentCategoryLabel('absence_only')).toBe('Absence (Uncovered)');
    expect(formatAmendmentCategoryLabel('absence_plus_replacement')).toBe('Absence + Replacement');
    expect(formatAmendmentCategoryLabel('shift_swap')).toBe('Mutual Shift Swap');
    expect(formatAmendmentCategoryLabel('admin_correction')).toBe('Admin Correction');
    expect(formatAmendmentCategoryLabel('reversal')).toBe('Reversal');
  });
});
