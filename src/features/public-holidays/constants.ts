import type { HolidayItem, ShiftClassification } from './types';

export const BUILT_IN_HOLIDAYS: Record<string, string> = {
  // 2025 Selangor Public Holidays
  '2025-01-01': "New Year's Day",
  '2025-01-29': 'Chinese New Year (Day 1)',
  '2025-01-30': 'Chinese New Year (Day 2)',
  '2025-02-11': 'Thaipusam',
  '2025-03-18': 'Nuzul Al-Quran',
  '2025-03-31': 'Hari Raya Aidilfitri (Day 1)',
  '2025-04-01': 'Hari Raya Aidilfitri (Day 2)',
  '2025-05-01': 'Labour Day',
  '2025-05-12': 'Wesak Day',
  '2025-06-02': "Agong's Birthday",
  '2025-06-07': 'Hari Raya Haji',
  '2025-06-27': 'Awal Muharram',
  '2025-08-31': 'National Day',
  '2025-09-01': 'National Day Replacement',
  '2025-09-05': 'Maulidur Rasul',
  '2025-09-16': 'Malaysia Day',
  '2025-10-20': 'Deepavali',
  '2025-12-11': "Sultan of Selangor's Birthday",
  '2025-12-25': 'Christmas Day',

  // 2026 Selangor Public Holidays
  '2026-01-01': "New Year's Day",
  '2026-02-01': 'Thaipusam',
  '2026-02-02': 'Thaipusam Holiday',
  '2026-02-17': 'Chinese New Year (Day 1)',
  '2026-02-18': 'Chinese New Year (Day 2)',
  '2026-03-07': 'Nuzul Al-Quran',
  '2026-03-20': 'Hari Raya Aidilfitri Holiday',
  '2026-03-21': 'Hari Raya Aidilfitri (Day 1)',
  '2026-03-22': 'Hari Raya Aidilfitri (Day 2)',
  '2026-03-23': 'Hari Raya Aidilfitri Holiday',
  '2026-05-01': 'Labour Day',
  '2026-05-27': 'Hari Raya Haji',
  '2026-05-31': 'Wesak Day',
  '2026-06-01': "Agong's Birthday",
  '2026-06-02': 'Wesak Day Holiday',
  '2026-06-17': 'Awal Muharram',
  '2026-08-25': 'Maulidur Rasul',
  '2026-08-31': 'National Day',
  '2026-09-16': 'Malaysia Day',
  '2026-11-08': 'Deepavali',
  '2026-11-09': 'Deepavali Holiday',
  '2026-12-11': "Sultan of Selangor's Birthday",
  '2026-12-25': 'Christmas Day',

  // 2027 Core Selangor Public Holidays
  '2027-01-01': "New Year's Day",
  '2027-01-22': 'Thaipusam',
  '2027-02-06': 'Chinese New Year (Day 1)',
  '2027-02-07': 'Chinese New Year (Day 2)',
  '2027-03-10': 'Hari Raya Aidilfitri (Day 1)',
  '2027-03-11': 'Hari Raya Aidilfitri (Day 2)',
  '2027-05-01': 'Labour Day',
  '2027-05-20': 'Wesak Day',
  '2027-06-07': "Agong's Birthday",
  '2027-08-31': 'National Day',
  '2027-09-16': 'Malaysia Day',
  '2027-10-29': 'Deepavali',
  '2027-12-25': 'Christmas Day',
};

/**
 * Classifies a shift on a public holiday for credit calculation.
 */
export function classifyPublicHolidayShift(shift: string | null | undefined): ShiftClassification {
  if (!shift) {
    return {
      normalizedShift: '',
      category: 'empty',
      isWorkedPublicHoliday: false,
      isPublicHolidayOff: false,
      earnsCredit: false,
    };
  }

  const cleanShift = shift
    .replace(/\(s\)/i, '')
    .replace(/-s/i, '')
    .replace(/\(x\)/i, '')
    .replace(/-x/i, '')
    .trim();
  const s = cleanShift.toUpperCase();
  let normalizedShift = s;

  if (['NIGHT', 'N', 'ND', 'ON', 'ON1', 'ON2'].includes(s)) {
    normalizedShift = 'NIGHT';
  } else if (['POSTNIGHT', 'POST NIGHT', 'POST-NIGHT', 'PN'].includes(s)) {
    normalizedShift = 'PN';
  } else if (s === 'COURSE' || s.startsWith('COURSE') || s.includes('COURSE')) {
    normalizedShift = 'COURSE';
  }

  // Active working shifts earn GHKA credits when worked on gazetted public holidays
  if (['AM', 'M', 'PM', 'E', 'AMX', 'PMX', 'NIGHT', 'PN', 'COURSE'].includes(normalizedShift)) {
    return {
      normalizedShift,
      category: 'worked',
      isWorkedPublicHoliday: true,
      isPublicHolidayOff: false,
      earnsCredit: true,
    };
  }

  if (s === 'HKA') {
    return {
      normalizedShift,
      category: 'official_ph_off',
      isWorkedPublicHoliday: false,
      isPublicHolidayOff: true,
      earnsCredit: false,
    };
  }

  if (s === 'MC' || s.startsWith('MC ') || ['MC1', 'MC2'].includes(s)) {
    return {
      normalizedShift: 'MC',
      category: 'mc',
      isWorkedPublicHoliday: false,
      isPublicHolidayOff: true,
      earnsCredit: false,
    };
  }

  // AL, EL, OFF, GHKA, etc.
  return {
    normalizedShift,
    category: 'other_non_working',
    isWorkedPublicHoliday: false,
    isPublicHolidayOff: true,
    earnsCredit: false,
  };
}

/**
 * Merge Supabase holidays with built-in holiday dictionary.
 */
export function mergeHolidays(supabaseHolidays: HolidayItem[] = []): Record<string, string> {
  const merged = { ...BUILT_IN_HOLIDAYS };
  supabaseHolidays.forEach((h) => {
    if (h.holidayDate && h.name) {
      merged[h.holidayDate] = h.name;
    }
  });
  return merged;
}
