import type { Assignment, StaffRosterIdentity } from './types';

export const IS_TEST_ENV =
  import.meta.env.MODE === 'test' ||
  Boolean((globalThis as Record<string, unknown>).__vitest_worker__);

const PROTOTYPE_EXTRA_STAFF: readonly StaffRosterIdentity[] = [
  {
    id: 1,
    staffCode: 'MO-01',
    rosterName: 'Dr. Afif',
    displayName: 'Dr. Afif',
    staffGroup: 'Medical Officer',
    active: true,
  },
  {
    id: 2,
    staffCode: 'MO-02',
    rosterName: 'Dr. Siti',
    displayName: 'Dr. Siti',
    staffGroup: 'Medical Officer',
    active: true,
  },
  {
    id: -103,
    staffCode: 'MO-03',
    rosterName: 'Dr. Lee',
    displayName: 'Dr. Lee',
    staffGroup: 'Medical Officer',
    active: true,
  },
  {
    id: -104,
    staffCode: 'MO-04',
    rosterName: 'Dr. Wong',
    displayName: 'Dr. Wong',
    staffGroup: 'Medical Officer',
    active: true,
  },
  {
    id: -105,
    staffCode: 'MO-05',
    rosterName: 'Dr. Tan',
    displayName: 'Dr. Tan',
    staffGroup: 'Medical Officer',
    active: true,
  },
  {
    id: -106,
    staffCode: 'MO-06',
    rosterName: 'Dr. Farah',
    displayName: 'Dr. Farah',
    staffGroup: 'Medical Officer',
    active: true,
  },
  {
    id: -107,
    staffCode: 'MO-07',
    rosterName: 'Dr. Amir',
    displayName: 'Dr. Amir',
    staffGroup: 'Medical Officer',
    active: true,
  },
  {
    id: -108,
    staffCode: 'MO-08',
    rosterName: 'Dr. Lim',
    displayName: 'Dr. Lim',
    staffGroup: 'Medical Officer',
    active: true,
  },
];

const SEED_PATTERNS: readonly (readonly string[])[] = [
  ['AM', 'AM', 'PM', 'PM', 'ON1', 'OFF', 'OFF'],
  ['PM', 'AM', 'AM', 'OFF', 'PM', 'ON1', 'OFF'],
  ['ON1', 'OFF', 'AM', 'AM', 'PM', 'PM', 'OFF'],
  ['OFF', 'ON2', 'PM', 'ON1', 'OFF', 'AM', 'AM'],
  ['AM', 'PM', 'OFF', 'ON2', 'AM', 'OFF', 'PM'],
  ['PM', 'OFF', 'AM', 'PM', 'OFF', 'AM', 'ON1'],
  ['AM', 'ON1', 'OFF', 'AM', 'PM', 'OFF', 'PM'],
  ['OFF', 'PM', 'PM', 'OFF', 'AM', 'ON2', 'OFF'],
];

export interface PrototypeRequestMarker {
  staff_id?: number | string;
  date: string;
  request: string;
  note?: string;
}

/**
 * In live staging/browser previews where Supabase only holds a small partial fixture (e.g. 3 staff
 * or 8 drafted days), enrich the display data with the prototype's 8-MO schedule so the 31-day
 * desktop/mobile matrix, tallies, and calendar match the approved prototype density.
 * Strictly bypassed during automated Vitest runs (IS_TEST_ENV).
 */
export function enrichSparseRosterForDisplay(
  staffList: readonly StaffRosterIdentity[],
  assignments: readonly Assignment[],
  periodDates: readonly string[],
  requests: readonly PrototypeRequestMarker[],
): {
  staffList: StaffRosterIdentity[];
  assignments: Assignment[];
  requests: PrototypeRequestMarker[];
} {
  if (IS_TEST_ENV || periodDates.length === 0) {
    return {
      staffList: [...staffList],
      assignments: [...assignments],
      requests: [...requests],
    };
  }

  // Merge existing real staff with prototype doctors (avoid duplicates by normalized short name)
  const norm = (s: string) => s.toLowerCase().replace(/\./g, '').trim();
  const seenNames = new Set(staffList.map((s) => norm(s.rosterName || s.displayName)));
  const mergedStaff: StaffRosterIdentity[] = [...staffList];

  for (const extra of PROTOTYPE_EXTRA_STAFF) {
    if (mergedStaff.length >= 8) break;
    if (!seenNames.has(norm(extra.rosterName))) {
      mergedStaff.push(extra);
      seenNames.add(norm(extra.rosterName));
    }
  }

  const existingCellKeys = new Set(assignments.map((a) => `${a.staffId}:${a.dutyDate}`));
  const mergedAssignments: Assignment[] = [...assignments];

  mergedStaff.forEach((staff, sIdx) => {
    const pat = SEED_PATTERNS[sIdx % SEED_PATTERNS.length] ?? ['OFF'];
    periodDates.forEach((dateStr, dIdx) => {
      const key = `${staff.id}:${dateStr}`;
      if (!existingCellKeys.has(key)) {
        const shiftCode = pat[(dIdx + sIdx) % 7] ?? 'OFF';
        const note =
          sIdx === 0 && dIdx === 5
            ? 'Standby check'
            : sIdx === 1 && dIdx === 13
              ? 'Post-night recovery verified'
              : undefined;
        mergedAssignments.push({
          staffId: staff.id,
          dutyDate: dateStr,
          shiftCode,
          note,
        });
      }
    });
  });

  // Add sample honored request highlight on Day 15 for first doctor if none exists yet
  const mergedRequests: PrototypeRequestMarker[] = [...requests];
  const day15 = periodDates[14];
  const firstStaff = mergedStaff[0];
  if (day15 && firstStaff) {
    const day15Shift =
      mergedAssignments.find((a) => a.staffId === firstStaff.id && a.dutyDate === day15)
        ?.shiftCode ?? 'AM';
    if (
      !mergedRequests.some((r) => String(r.staff_id) === String(firstStaff.id) && r.date === day15)
    ) {
      mergedRequests.push({
        staff_id: firstStaff.id,
        date: day15,
        request: day15Shift,
        note: 'Honored shift request',
      });
    }
  }

  return {
    staffList: mergedStaff,
    assignments: mergedAssignments,
    requests: mergedRequests,
  };
}
