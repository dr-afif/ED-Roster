export const APP_TIMEZONE = 'Asia/Kuala_Lumpur' as const;
export const APP_LOCALE = 'en-MY' as const;
export const FIRST_NATIVE_ROSTER_PERIOD = { year: '2027', month: '01' } as const;

export type RosterYearMonth = {
  year: string;
  month: string;
};

export function isValidRosterYearMonth(year: string, month: string): boolean {
  if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) {
    return false;
  }
  const numericYear = Number(year);
  return numericYear >= 2020 && numericYear <= 2100;
}

export function formatRosterPeriodLabel(year: string, month: string): string {
  if (!isValidRosterYearMonth(year, month)) {
    return 'Invalid roster period';
  }
  const utcMidMonth = new Date(Date.UTC(Number(year), Number(month) - 1, 15, 4, 0, 0));
  return new Intl.DateTimeFormat(APP_LOCALE, {
    month: 'long',
    year: 'numeric',
    timeZone: APP_TIMEZONE,
  }).format(utcMidMonth);
}

export function getMalaysiaYearMonth(referenceInstant: Date): RosterYearMonth {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: APP_TIMEZONE,
  }).formatToParts(referenceInstant);

  const year = parts.find((part) => part.type === 'year')?.value ?? '2027';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  return { year, month };
}

export function getUpcomingMalaysiaRosterPeriod(
  referenceInstant: Date = new Date(),
): RosterYearMonth {
  const { year, month } = getMalaysiaYearMonth(referenceInstant);
  const y = Number(year);
  const m = Number(month);
  if (m === 12) {
    return { year: String(y + 1), month: '01' };
  }
  return { year: String(y), month: String(m + 1).padStart(2, '0') };
}

const SESSION_ROSTER_PERIOD_STORAGE_KEY = 'resq.ui.v1.sessionRosterPeriod';

export function readSessionRosterPeriod(): RosterYearMonth | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_ROSTER_PERIOD_STORAGE_KEY);
    if (!raw) return null;
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(raw.trim());
    if (!match?.[1] || !match[2]) return null;
    return isValidRosterYearMonth(match[1], match[2]) ? { year: match[1], month: match[2] } : null;
  } catch {
    return null;
  }
}

export function writeSessionRosterPeriod(year: string, month: string): void {
  if (!isValidRosterYearMonth(year, month)) return;
  try {
    window.sessionStorage.setItem(SESSION_ROSTER_PERIOD_STORAGE_KEY, `${year}-${month}`);
  } catch {
    // Ignore storage restrictions
  }
}

export function getSessionOrUpcomingRosterPath(referenceInstant: Date = new Date()): string {
  const chosen = readSessionRosterPeriod() ?? getUpcomingMalaysiaRosterPeriod(referenceInstant);
  return `/rosters/${chosen.year}/${chosen.month}`;
}
