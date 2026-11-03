import { describe, expect, it } from 'vitest';
import {
  formatRosterPeriodLabel,
  getMalaysiaYearMonth,
  isValidRosterYearMonth,
} from '@/shared/dates';

describe('malaysiaDate utilities', () => {
  it('validates four-digit years and two-digit calendar months', () => {
    expect(isValidRosterYearMonth('2027', '01')).toBe(true);
    expect(isValidRosterYearMonth('2027', '12')).toBe(true);
    expect(isValidRosterYearMonth('2027', '00')).toBe(false);
    expect(isValidRosterYearMonth('2027', '13')).toBe(false);
    expect(isValidRosterYearMonth('27', '1')).toBe(false);
  });

  it('formats roster month labels consistently', () => {
    expect(formatRosterPeriodLabel('2027', '01')).toBe('January 2027');
    expect(formatRosterPeriodLabel('2027', '99')).toBe('Invalid roster period');
  });

  it('evaluates year-month transitions in Asia/Kuala_Lumpur (+08:00)', () => {
    // 2026-12-31 16:30 UTC is already 2027-01-01 00:30 MYT!
    const utcNewYearEve = new Date('2026-12-31T16:30:00.000Z');
    expect(getMalaysiaYearMonth(utcNewYearEve)).toEqual({ year: '2027', month: '01' });
  });
});
