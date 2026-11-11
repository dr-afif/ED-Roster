import { describe, expect, it } from 'vitest';
import {
  calculateStaffGoffBalance,
  detectOffDisplacementGoffAccruals,
  summarizeAllStaffGoffBalances,
} from '../goff';
import { CANONICAL_SHIFT_SEMANTICS } from '../semantics';
import type { Assignment, GoffLedgerEntry } from '../types';

describe('Compensatory Rest (GOFF) Domain Module', () => {
  it('calculates staff GOFF balance correctly with additions and deductions', () => {
    const entries: GoffLedgerEntry[] = [
      {
        id: 1,
        staffId: 101,
        transactionType: 'opening_balance',
        amount: 2,
        reason: 'Carried forward from 2026',
        effectiveDate: '2027-01-01',
        createdAt: '2027-01-01T00:00:00Z',
      },
      {
        id: 2,
        staffId: 101,
        transactionType: 'earned',
        amount: 1,
        reason: 'Displaced OFF on 2027-01-15 for emergency coverage',
        effectiveDate: '2027-01-15',
        createdAt: '2027-01-15T18:00:00Z',
      },
      {
        id: 3,
        staffId: 101,
        transactionType: 'used',
        amount: 1,
        reason: 'Taken as GOFF on 2027-01-20',
        effectiveDate: '2027-01-20',
        createdAt: '2027-01-20T00:00:00Z',
      },
      {
        id: 4,
        staffId: 102,
        transactionType: 'opening_balance',
        amount: 5,
        reason: 'Carried forward',
        effectiveDate: '2027-01-01',
        createdAt: '2027-01-01T00:00:00Z',
      },
    ];

    const balance101 = calculateStaffGoffBalance(entries, 101);
    expect(balance101.opening).toBe(2);
    expect(balance101.earned).toBe(1);
    expect(balance101.used).toBe(1);
    expect(balance101.netBalance).toBe(2); // 2 + 1 - 1 = 2

    const balance102 = calculateStaffGoffBalance(entries, 102);
    expect(balance102.netBalance).toBe(5);

    const balance103 = calculateStaffGoffBalance(entries, 103);
    expect(balance103.netBalance).toBe(0);
  });

  it('summarizes all staff balances into a lookup map', () => {
    const entries: GoffLedgerEntry[] = [
      {
        id: 1,
        staffId: 101,
        transactionType: 'opening_balance',
        amount: 3,
        reason: 'Opening',
        effectiveDate: '2027-01-01',
        createdAt: '2027-01-01T00:00:00Z',
      },
      {
        id: 2,
        staffId: 102,
        transactionType: 'opening_balance',
        amount: 1,
        reason: 'Opening',
        effectiveDate: '2027-01-01',
        createdAt: '2027-01-01T00:00:00Z',
      },
    ];

    const summary = summarizeAllStaffGoffBalances(entries);
    expect(summary.get(101)?.netBalance).toBe(3);
    expect(summary.get(102)?.netBalance).toBe(1);
  });

  it('detects OFF displacement earning GOFF when doctor is called into duty', () => {
    const planned: Assignment[] = [
      { staffId: 101, dutyDate: '2027-01-15', shiftCode: 'OFF' },
      { staffId: 102, dutyDate: '2027-01-15', shiftCode: 'AM' },
      { staffId: 103, dutyDate: '2027-01-15', shiftCode: 'OFF' },
    ];

    // In current, staff 101 replaces someone and works ON (coverage)
    // Staff 102 is changed to PM (coverage -> coverage, does not displace off)
    // Staff 103 takes AL (OFF -> AL, does not earn GOFF)
    const current: Assignment[] = [
      { staffId: 101, dutyDate: '2027-01-15', shiftCode: 'ON' },
      { staffId: 102, dutyDate: '2027-01-15', shiftCode: 'PM' },
      { staffId: 103, dutyDate: '2027-01-15', shiftCode: 'AL' },
    ];

    const accruals = detectOffDisplacementGoffAccruals(planned, current, CANONICAL_SHIFT_SEMANTICS);
    expect(accruals).toHaveLength(1);
    const firstAccrual = accruals[0];
    expect(firstAccrual?.staffId).toBe(101);
    expect(firstAccrual?.originalShiftCode).toBe('OFF');
    expect(firstAccrual?.newShiftCode).toBe('ON');
  });
});
