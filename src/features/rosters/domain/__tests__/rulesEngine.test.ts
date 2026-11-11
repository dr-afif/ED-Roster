import { describe, expect, it } from 'vitest';
import { evaluateRosterRules } from '../rulesEngine';
import {
  getShiftSemantic,
  isQualifyingNightShift,
  isResetShift,
  isTransparentShift,
  isWorkedShift,
  normalizeShiftCode,
} from '../semantics';
import type {
  Assignment,
  RosterPeriod,
  StaffRosterIdentity,
  VersionedRuleConfiguration,
} from '../types';
import { getRosterWeeks, getWeekMonday, getWeekSunday } from '../weeklyOff';

const DEFAULT_CONFIG: VersionedRuleConfiguration = {
  schemaVersion: 1,
  weeklyOffPolicy: 'policy_b',
  maxConsecutiveDays: 6,
  consecutiveWarningThreshold: 7,
  nightQualifyingCodes: ['ON', 'ON1', 'ON2', 'PN', 'NIGHT', 'N'],
  nightSequencePatterns: [
    ['ON1', 'ON2', 'PN'],
    ['ON1', 'PN'],
    ['ON', 'PN'],
    ['NIGHT', 'PN'],
  ],
  requestDailyOffLimit: 3,
  requestMonthlyLimit: 10,
  requestWeekendLimit: 4,
  minRestHoursAfterNight: 24,
  staffingThresholds: [
    { dayType: 'weekday', shiftBucket: 'am', minStaff: 2, targetStaff: 3 },
    { dayType: 'weekday', shiftBucket: 'pm', minStaff: 2, targetStaff: 3 },
    { dayType: 'weekday', shiftBucket: 'night', minStaff: 1, targetStaff: 2 },
    { dayType: 'weekday', shiftBucket: 'total', minStaff: 5, targetStaff: 8 },
    { dayType: 'weekend', shiftBucket: 'am', minStaff: 1, targetStaff: 2 },
    { dayType: 'weekend', shiftBucket: 'pm', minStaff: 1, targetStaff: 2 },
    { dayType: 'weekend', shiftBucket: 'night', minStaff: 1, targetStaff: 1 },
    { dayType: 'weekend', shiftBucket: 'total', minStaff: 3, targetStaff: 5 },
  ],
};

const TEST_PERIOD: RosterPeriod = {
  id: 1,
  periodStart: '2027-01-01', // Friday
  periodEnd: '2027-01-31', // Sunday
  status: 'draft',
  revision: 0,
};

const DR_AFIF: StaffRosterIdentity = {
  id: 101,
  staffCode: 'MO-01',
  rosterName: 'Dr. Afif',
  displayName: 'Dr. Muhammad Afif',
  staffGroup: 'medical_officer',
  active: true,
};

const DR_SITI: StaffRosterIdentity = {
  id: 102,
  staffCode: 'MO-02',
  rosterName: 'Dr. Siti',
  displayName: 'Dr. Siti Aminah',
  staffGroup: 'medical_officer',
  active: true,
};

const TEST_PEOPLE: StaffRosterIdentity[] = [DR_AFIF, DR_SITI];

describe('Shift Semantics & Normalization', () => {
  it('normalizes shift codes with and without modifiers', () => {
    expect(normalizeShiftCode('AM')).toEqual({ raw: 'AM', base: 'AM', modifier: undefined });
    expect(normalizeShiftCode('am')).toEqual({ raw: 'AM', base: 'AM', modifier: undefined });
    expect(normalizeShiftCode('  pm(x) ')).toEqual({ raw: 'PM(X)', base: 'PM', modifier: 'X' });
    expect(normalizeShiftCode(null)).toEqual({ raw: '', base: '' });
  });

  it('classifies canonical shifts correctly', () => {
    expect(isWorkedShift('AM')).toBe(true);
    expect(isWorkedShift('PM')).toBe(true);
    expect(isWorkedShift('ON')).toBe(true);
    expect(isWorkedShift('ON1')).toBe(true);
    expect(isWorkedShift('ON2')).toBe(true);
    expect(isWorkedShift('NIGHT')).toBe(true);

    expect(isTransparentShift('PN')).toBe(true);
    expect(isTransparentShift('AM')).toBe(false);

    expect(isResetShift('OFF')).toBe(true);
    expect(isResetShift('GOFF')).toBe(true);
    expect(isResetShift('AL')).toBe(true);
    expect(isResetShift('MC')).toBe(true);

    expect(isQualifyingNightShift('ON')).toBe(true);
    expect(isQualifyingNightShift('ON1')).toBe(true);
    expect(isQualifyingNightShift('PN')).toBe(true);
    expect(isQualifyingNightShift('AM')).toBe(false);
  });

  it('marks unknown shift codes as unknown', () => {
    const s = getShiftSemantic('UNKNOWN_XYZ');
    expect(s.semanticClass).toBe('unknown');
  });
});

describe('Weekly OFF & Calendar Math', () => {
  it('computes correct Monday and Sunday for dates', () => {
    // 2027-01-01 is Friday
    expect(getWeekMonday('2027-01-01')).toBe('2026-12-28');
    expect(getWeekSunday('2027-01-01')).toBe('2027-01-03');

    // 2027-01-04 is Monday
    expect(getWeekMonday('2027-01-04')).toBe('2027-01-04');
    expect(getWeekSunday('2027-01-04')).toBe('2027-01-10');
  });

  it('computes all intersecting roster weeks for January 2027', () => {
    const weeks = getRosterWeeks('2027-01-01', '2027-01-31');
    expect(weeks.length).toBe(5);
    expect(weeks[0]?.weekStart).toBe('2026-12-28');
    expect(weeks[0]?.isBoundaryWeek).toBe(true);
    expect(weeks[1]?.weekStart).toBe('2027-01-04');
    expect(weeks[1]?.isBoundaryWeek).toBe(false);
    expect(weeks[4]?.weekEnd).toBe('2027-01-31');
    expect(weeks[4]?.isBoundaryWeek).toBe(false); // 2027-01-31 is Sunday, so full week 2027-01-25..2027-01-31
  });
});

describe('Pure Roster Rules Engine', () => {
  it('enforces Policy B: 2 OFFs required when no night duty is worked', () => {
    // Week 2: 2027-01-04 (Mon) to 2027-01-10 (Sun)
    // Only 1 OFF assigned and no night duty
    const assignments: Assignment[] = [
      { staffId: 101, dutyDate: '2027-01-04', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-05', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-06', shiftCode: 'PM' },
      { staffId: 101, dutyDate: '2027-01-07', shiftCode: 'PM' },
      { staffId: 101, dutyDate: '2027-01-08', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-09', shiftCode: 'OFF' },
      { staffId: 101, dutyDate: '2027-01-10', shiftCode: 'AM' },
    ];

    const output = evaluateRosterRules({
      period: {
        id: 1,
        periodStart: '2027-01-04',
        periodEnd: '2027-01-10',
        status: 'draft',
        revision: 0,
      },
      people: [DR_AFIF],
      assignments,
      configuration: DEFAULT_CONFIG,
    });

    const offIssue = output.issues.find((i) => i.code === 'missing_weekly_off');
    expect(offIssue).toBeDefined();
    expect(offIssue?.message).toContain('Entitled to 2 OFFs');
    expect(output.weeklyOff[0]?.status).toBe('short');
    expect(output.weeklyOff[0]?.requiredOff).toBe(2);
    expect(output.weeklyOff[0]?.actualOff).toBe(1);
  });

  it('enforces Policy B: 1 OFF required when qualifying night is worked', () => {
    // Week 2: 2027-01-04 (Mon) to 2027-01-10 (Sun)
    // 1 ON, 1 PN, 1 OFF, 4 AM -> compliant with Policy B
    const assignments: Assignment[] = [
      { staffId: 101, dutyDate: '2027-01-04', shiftCode: 'ON' },
      { staffId: 101, dutyDate: '2027-01-05', shiftCode: 'PN' },
      { staffId: 101, dutyDate: '2027-01-06', shiftCode: 'OFF' },
      { staffId: 101, dutyDate: '2027-01-07', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-08', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-09', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-10', shiftCode: 'AM' },
    ];

    const output = evaluateRosterRules({
      period: {
        id: 1,
        periodStart: '2027-01-04',
        periodEnd: '2027-01-10',
        status: 'draft',
        revision: 0,
      },
      people: [DR_AFIF],
      assignments,
      configuration: DEFAULT_CONFIG,
    });

    const offIssue = output.issues.find((i) => i.code === 'missing_weekly_off');
    expect(offIssue).toBeUndefined();
    expect(output.weeklyOff[0]?.status).toBe('compliant');
    expect(output.weeklyOff[0]?.requiredOff).toBe(1);
    expect(output.weeklyOff[0]?.actualOff).toBe(1);
  });

  it('invariant: GOFF or AL does not count toward normal weekly OFF entitlement', () => {
    // Staff has 1 GOFF and 1 AL instead of normal OFF
    const assignments: Assignment[] = [
      { staffId: 101, dutyDate: '2027-01-04', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-05', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-06', shiftCode: 'GOFF' },
      { staffId: 101, dutyDate: '2027-01-07', shiftCode: 'AL' },
      { staffId: 101, dutyDate: '2027-01-08', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-09', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-10', shiftCode: 'AM' },
    ];

    const output = evaluateRosterRules({
      period: {
        id: 1,
        periodStart: '2027-01-04',
        periodEnd: '2027-01-10',
        status: 'draft',
        revision: 0,
      },
      people: [DR_AFIF],
      assignments,
      configuration: DEFAULT_CONFIG,
    });

    expect(output.weeklyOff[0]?.actualOff).toBe(0);
    expect(output.weeklyOff[0]?.status).toBe('short');
  });

  it('detects consecutive work exceeding 6 days with PN transparency', () => {
    // 3 AM -> PN (transparent) -> 4 AM = 7 worked days
    const assignments: Assignment[] = [
      { staffId: 101, dutyDate: '2027-01-04', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-05', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-06', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-07', shiftCode: 'PN' }, // transparent
      { staffId: 101, dutyDate: '2027-01-08', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-09', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-10', shiftCode: 'AM' },
      { staffId: 101, dutyDate: '2027-01-11', shiftCode: 'AM' }, // 7th worked day
    ];

    const output = evaluateRosterRules({
      period: {
        id: 1,
        periodStart: '2027-01-04',
        periodEnd: '2027-01-11',
        status: 'draft',
        revision: 0,
      },
      people: [DR_AFIF],
      assignments,
      configuration: DEFAULT_CONFIG,
    });

    const seqIssue = output.issues.find((i) => i.code === 'consecutive_work_exceeded');
    expect(seqIssue).toBeDefined();
    expect(seqIssue?.message).toContain('worked 7 consecutive shifts');
  });

  it('detects night rest violations and broken bundles', () => {
    // ON directly followed by AM without PN
    const assignments: Assignment[] = [
      { staffId: 101, dutyDate: '2027-01-04', shiftCode: 'ON' },
      { staffId: 101, dutyDate: '2027-01-05', shiftCode: 'AM' },
    ];

    const output = evaluateRosterRules({
      period: {
        id: 1,
        periodStart: '2027-01-04',
        periodEnd: '2027-01-05',
        status: 'draft',
        revision: 0,
      },
      people: [DR_AFIF],
      assignments,
      configuration: DEFAULT_CONFIG,
    });

    const restIssue = output.issues.find((i) => i.code === 'insufficient_night_rest');
    expect(restIssue).toBeDefined();
    expect(restIssue?.severity).toBe('error');
    expect(restIssue?.message).toContain('without required post-night rest (PN)');
  });

  it('detects broken ON1/ON2 bundles', () => {
    // ON1 followed by OFF instead of ON2 or PN
    const assignments: Assignment[] = [
      { staffId: 101, dutyDate: '2027-01-04', shiftCode: 'ON1' },
      { staffId: 101, dutyDate: '2027-01-05', shiftCode: 'OFF' },
    ];

    const output = evaluateRosterRules({
      period: {
        id: 1,
        periodStart: '2027-01-04',
        periodEnd: '2027-01-05',
        status: 'draft',
        revision: 0,
      },
      people: [DR_AFIF],
      assignments,
      configuration: DEFAULT_CONFIG,
    });

    const bundleIssue = output.issues.find((i) => i.code === 'broken_night_bundle');
    expect(bundleIssue).toBeDefined();
    expect(bundleIssue?.message).toContain('expected ON2 or PN');
  });

  it('evaluates staffing shortages against thresholds', () => {
    // On 2027-01-04 (weekday), minimum AM staff is 2, but only 1 assigned
    const assignments: Assignment[] = [
      { staffId: 101, dutyDate: '2027-01-04', shiftCode: 'AM' },
      { staffId: 102, dutyDate: '2027-01-04', shiftCode: 'OFF' },
    ];

    const output = evaluateRosterRules({
      period: {
        id: 1,
        periodStart: '2027-01-04',
        periodEnd: '2027-01-04',
        status: 'draft',
        revision: 0,
      },
      people: TEST_PEOPLE,
      assignments,
      configuration: DEFAULT_CONFIG,
    });

    const shortage = output.issues.find(
      (i) => i.code === 'staffing_shortage' && i.message.includes('AM shift is short staffed'),
    );
    expect(shortage).toBeDefined();
    expect(shortage?.severity).toBe('error');
    expect(output.staffing.totalShortageDays).toBeGreaterThan(0);
  });

  it('detects unknown shift codes as publication-blocking errors', () => {
    const assignments: Assignment[] = [
      { staffId: 101, dutyDate: '2027-01-04', shiftCode: 'CUSTOM_INVALID' },
    ];

    const output = evaluateRosterRules({
      period: {
        id: 1,
        periodStart: '2027-01-04',
        periodEnd: '2027-01-04',
        status: 'draft',
        revision: 0,
      },
      people: [DR_AFIF],
      assignments,
      configuration: DEFAULT_CONFIG,
    });

    const unknownIssue = output.issues.find((i) => i.code === 'unknown_shift_code');
    expect(unknownIssue).toBeDefined();
    expect(unknownIssue?.severity).toBe('error');
  });

  it('produces deterministic checksums', () => {
    const assignments: Assignment[] = [
      { staffId: 101, dutyDate: '2027-01-04', shiftCode: 'AM' },
      { staffId: 102, dutyDate: '2027-01-04', shiftCode: 'PM' },
    ];

    const output1 = evaluateRosterRules({
      period: TEST_PERIOD,
      people: TEST_PEOPLE,
      assignments,
      configuration: DEFAULT_CONFIG,
    });

    const output2 = evaluateRosterRules({
      period: TEST_PERIOD,
      people: TEST_PEOPLE,
      assignments,
      configuration: DEFAULT_CONFIG,
    });

    expect(output1.checksum).toBe(output2.checksum);

    // Modify assignment and verify checksum changes
    const modifiedAssignments: Assignment[] = [
      { staffId: 101, dutyDate: '2027-01-04', shiftCode: 'ON' },
      { staffId: 102, dutyDate: '2027-01-04', shiftCode: 'PM' },
    ];

    const outputModified = evaluateRosterRules({
      period: TEST_PERIOD,
      people: TEST_PEOPLE,
      assignments: modifiedAssignments,
      configuration: DEFAULT_CONFIG,
    });

    expect(outputModified.checksum).not.toBe(output1.checksum);
  });
});
