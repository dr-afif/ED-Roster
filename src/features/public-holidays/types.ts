/**
 * Types for Public Holiday & GHKA Replacement Leave Tracker
 */

export interface HolidayItem {
  holidayDate: string; // YYYY-MM-DD
  name: string;
  jurisdiction?: string;
  isStateSpecific?: boolean;
}

export interface OpeningBalanceEntry {
  staffId: number;
  year: number;
  openingBalance: number;
  note?: string | null;
}

export interface ShiftClassification {
  normalizedShift: string;
  category: 'worked' | 'official_ph_off' | 'mc' | 'other_non_working' | 'empty';
  isWorkedPublicHoliday: boolean;
  isPublicHolidayOff: boolean;
  earnsCredit: boolean;
}

export interface PhCredit {
  staffId: number;
  staffName: string;
  staffCode?: string;
  holidayDate: string | null; // null if opening balance
  holidayName: string;
  workedShift: string;
  originalShift?: string;
  creditEarned: boolean;
  status: 'USED' | 'PENDING';
  matchedGhkaDate: string | null;
  source: 'auto' | 'opening_balance';
}

export interface GhkaUsage {
  staffId: number;
  staffName: string;
  staffCode?: string;
  ghkaDate: string;
}

export interface StaffPhSummary {
  staffId: number;
  staffName: string;
  staffCode?: string;
  openingBalance: number;
  phWorked: number;
  ghkaUsed: number;
  usedFromOpeningBalance: number;
  usedFromCurrentYearCredit: number;
  outstanding: number;
  oldOutstanding: number;
  excessGhkaUsed: number;
}

export interface PhWarning {
  staffId: number;
  staffName: string;
  type: 'OLD_OUTSTANDING_GHKA' | 'EXCESS_GHKA';
  message: string;
  severity: 'high' | 'medium';
  count: number;
}

export interface MatrixDoctorEntry {
  classification: ShiftClassification;
  originalShift: string;
  matchedRecord: PhCredit | null;
}

export interface TrackerMatrixRow {
  date: string;
  name: string;
  doctors: Record<number, MatrixDoctorEntry>;
}

export interface MemoExportPayload {
  memoMonth: string; // YYYY-MM
  applicantName: string;
  applicantStaffId: string;
  applicantPhone: string;
  applicantEmail: string;
  memoDate: string; // ISO
  rows: Array<{
    phDate: string;
    phName: string;
    ghkaDate: string;
    ghkaDay: string;
  }>;
}
