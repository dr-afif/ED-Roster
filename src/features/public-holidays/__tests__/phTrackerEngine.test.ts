import { describe, expect, it } from 'vitest';
import { classifyPublicHolidayShift, mergeHolidays } from '../constants';
import {
  buildStaffSummaries,
  buildTrackerMatrix,
  buildTrackerWarnings,
  getGhkaUsages,
  getPublicHolidayCredits,
  matchGhkaToCredits,
  type RosterAssignmentEntry,
} from '../phTrackerEngine';

describe('phTrackerEngine', () => {
  describe('classifyPublicHolidayShift', () => {
    it('classifies active clinical shifts on public holidays as credit-earning', () => {
      expect(classifyPublicHolidayShift('AM').earnsCredit).toBe(true);
      expect(classifyPublicHolidayShift('M').earnsCredit).toBe(true);
      expect(classifyPublicHolidayShift('PM').earnsCredit).toBe(true);
      expect(classifyPublicHolidayShift('E').earnsCredit).toBe(true);
      expect(classifyPublicHolidayShift('NIGHT').earnsCredit).toBe(true);
      expect(classifyPublicHolidayShift('ND').earnsCredit).toBe(true);
      expect(classifyPublicHolidayShift('ON1').earnsCredit).toBe(true);
      expect(classifyPublicHolidayShift('PN').earnsCredit).toBe(true);
      expect(classifyPublicHolidayShift('COURSE').earnsCredit).toBe(true);
    });

    it('classifies non-working, leave, and replacement shifts as non-credit-earning', () => {
      expect(classifyPublicHolidayShift('OFF').earnsCredit).toBe(false);
      expect(classifyPublicHolidayShift('AL').earnsCredit).toBe(false);
      expect(classifyPublicHolidayShift('EL').earnsCredit).toBe(false);
      expect(classifyPublicHolidayShift('HKA').earnsCredit).toBe(false);
      expect(classifyPublicHolidayShift('MC').earnsCredit).toBe(false);
      expect(classifyPublicHolidayShift('GHKA').earnsCredit).toBe(false);
      expect(classifyPublicHolidayShift(null).earnsCredit).toBe(false);
    });
  });

  describe('Credit Accrual & Usage Extraction', () => {
    const testHolidays = {
      '2026-12-25': 'Christmas Day',
      '2026-12-11': "Sultan of Selangor's Birthday",
    };

    const assignments: RosterAssignmentEntry[] = [
      {
        staffId: 101,
        staffName: 'Dr Afif',
        assignmentDate: '2026-12-25',
        shiftCode: 'ND',
      },
      {
        staffId: 101,
        staffName: 'Dr Afif',
        assignmentDate: '2026-12-26',
        shiftCode: 'GHKA',
      },
      {
        staffId: 102,
        staffName: 'Dr Sarah',
        assignmentDate: '2026-12-25',
        shiftCode: 'AL',
      },
      {
        staffId: 102,
        staffName: 'Dr Sarah',
        assignmentDate: '2026-12-11',
        shiftCode: 'AM',
      },
    ];

    it('accrues credits only on gazetted public holiday dates with qualifying shifts', () => {
      const credits = getPublicHolidayCredits(assignments, testHolidays);
      expect(credits).toHaveLength(2);
      expect(credits.some((c) => c.staffId === 101 && c.holidayDate === '2026-12-25')).toBe(true);
      expect(credits.some((c) => c.staffId === 102 && c.holidayDate === '2026-12-11')).toBe(true);
      expect(credits.some((c) => c.staffId === 102 && c.holidayDate === '2026-12-25')).toBe(false);
    });

    it('extracts all GHKA replacement usages', () => {
      const usages = getGhkaUsages(assignments);
      expect(usages).toHaveLength(1);
      expect(usages[0]?.staffId).toBe(101);
      expect(usages[0]?.ghkaDate).toBe('2026-12-26');
    });
  });

  describe('FIFO Matching & Balances', () => {
    const staffList = [
      { id: 1, name: 'Dr Alpha', staffCode: 'MO01' },
      { id: 2, name: 'Dr Beta', staffCode: 'MO02' },
    ];

    const openingBalances = [
      { staffId: 1, year: 2026, openingBalance: 1, note: 'From 2025' },
      { staffId: 2, year: 2026, openingBalance: 0, note: null },
    ];

    const credits = [
      {
        staffId: 1,
        staffName: 'Dr Alpha',
        holidayDate: '2026-05-01',
        holidayName: 'Labour Day',
        workedShift: 'AM',
        creditEarned: true,
        status: 'PENDING' as const,
        matchedGhkaDate: null,
        source: 'auto' as const,
      },
      {
        staffId: 2,
        staffName: 'Dr Beta',
        holidayDate: '2026-05-01',
        holidayName: 'Labour Day',
        workedShift: 'NIGHT',
        creditEarned: true,
        status: 'PENDING' as const,
        matchedGhkaDate: null,
        source: 'auto' as const,
      },
    ];

    const usages = [
      // Dr Alpha uses 1 GHKA (should match opening balance first)
      { staffId: 1, staffName: 'Dr Alpha', ghkaDate: '2026-06-01' },
      // Dr Beta uses 2 GHKA (only has 1 credit, 1 should be excess)
      { staffId: 2, staffName: 'Dr Beta', ghkaDate: '2026-06-02' },
      { staffId: 2, staffName: 'Dr Beta', ghkaDate: '2026-06-03' },
    ];

    it('matches opening balance before earned credits in FIFO order', () => {
      const { matchedRecords, unmatchedUsages } = matchGhkaToCredits(
        credits,
        usages,
        openingBalances,
        staffList,
      );

      const alphaMatches = matchedRecords.filter((r) => r.staffId === 1);
      expect(alphaMatches).toHaveLength(2); // 1 synthetic opening + 1 earned
      // Opening balance matched first
      expect(alphaMatches[0]?.source).toBe('opening_balance');
      expect(alphaMatches[0]?.status).toBe('USED');
      expect(alphaMatches[0]?.matchedGhkaDate).toBe('2026-06-01');
      // Earned credit still pending
      expect(alphaMatches[1]?.source).toBe('auto');
      expect(alphaMatches[1]?.status).toBe('PENDING');

      // Dr Beta has 1 match and 1 unmatched usage
      const betaMatches = matchedRecords.filter((r) => r.staffId === 2);
      expect(betaMatches).toHaveLength(1);
      expect(betaMatches[0]?.status).toBe('USED');
      expect(betaMatches[0]?.matchedGhkaDate).toBe('2026-06-02');

      expect(unmatchedUsages).toHaveLength(1);
      expect(unmatchedUsages[0]?.staffId).toBe(2);
      expect(unmatchedUsages[0]?.ghkaDate).toBe('2026-06-03');
    });

    it('computes correct doctor summaries and excess metrics', () => {
      const { matchedRecords, unmatchedUsages } = matchGhkaToCredits(
        credits,
        usages,
        openingBalances,
        staffList,
      );

      const summaries = buildStaffSummaries(
        matchedRecords,
        unmatchedUsages,
        staffList,
        openingBalances,
      );

      const alphaSum = summaries.find((s) => s.staffId === 1);
      expect(alphaSum?.openingBalance).toBe(1);
      expect(alphaSum?.phWorked).toBe(1);
      expect(alphaSum?.ghkaUsed).toBe(1);
      expect(alphaSum?.outstanding).toBe(1); // 1 + 1 - 1 = 1 available
      expect(alphaSum?.excessGhkaUsed).toBe(0);

      const betaSum = summaries.find((s) => s.staffId === 2);
      expect(betaSum?.openingBalance).toBe(0);
      expect(betaSum?.phWorked).toBe(1);
      expect(betaSum?.ghkaUsed).toBe(2);
      expect(betaSum?.outstanding).toBe(0);
      expect(betaSum?.excessGhkaUsed).toBe(1); // 2 used - 1 earned = 1 excess
    });

    it('generates high severity warning for excess GHKA taken', () => {
      const { matchedRecords, unmatchedUsages } = matchGhkaToCredits(
        credits,
        usages,
        openingBalances,
        staffList,
      );
      const summaries = buildStaffSummaries(
        matchedRecords,
        unmatchedUsages,
        staffList,
        openingBalances,
      );
      const warnings = buildTrackerWarnings(summaries);

      expect(warnings.some((w) => w.staffId === 2 && w.type === 'EXCESS_GHKA')).toBe(true);
      expect(warnings[0]?.severity).toBe('high');
    });
  });

  describe('Matrix & Built-in Holidays', () => {
    it('merges custom database holidays into built-in calendar', () => {
      const merged = mergeHolidays([
        { holidayDate: '2026-10-15', name: 'Special Hospital Holiday' },
      ]);
      expect(merged['2026-10-15']).toBe('Special Hospital Holiday');
      expect(merged['2026-12-25']).toBe('Christmas Day');
    });

    it('builds matrix rows for each holiday with doctor shift classifications', () => {
      const testHolidays = {
        '2026-12-25': 'Christmas Day',
      };
      const assignments: RosterAssignmentEntry[] = [
        { staffId: 10, staffName: 'Dr A', assignmentDate: '2026-12-25', shiftCode: 'ND' },
      ];
      const matrix = buildTrackerMatrix([], assignments, testHolidays, '2026');

      expect(matrix).toHaveLength(1);
      expect(matrix[0]?.date).toBe('2026-12-25');
      expect(matrix[0]?.doctors[10]?.classification.earnsCredit).toBe(true);
    });
  });
});
