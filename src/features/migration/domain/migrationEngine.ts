/**
 * Pure domain logic for Google Sheets Migration & Reconciliation (Wave G).
 * Matching MODULAR_APP_BLUEPRINT/09_MIGRATION_CUTOVER.md and ADR-002.
 */

export interface MigrationBatch {
  readonly id: string;
  readonly batch_id: string;
  readonly source_spreadsheet_id: string;
  readonly source_label: string;
  readonly export_timestamp: string;
  readonly tab_manifest: ReadonlyArray<{
    readonly tabName: string;
    readonly rowCount: number;
    readonly columnCount: number;
    readonly sha256?: string;
  }>;
  readonly file_hashes: Record<string, string>;
  readonly importer_version: string;
  readonly status: 'staged' | 'validating' | 'reconciled' | 'committed' | 'rolled_back';
  readonly reconciliation_summary: Record<string, unknown>;
  readonly notes: string | null;
  readonly created_at: string;
  readonly raw_row_count: number;
}

export interface MigrationTabSummary {
  readonly tab_name: string;
  readonly row_count: number;
}

export interface MigrationIdMap {
  readonly id: number;
  readonly source_entity: string;
  readonly source_tab: string;
  readonly source_key: string;
  readonly canonical_table: string;
  readonly canonical_id: string;
  readonly canonical_label: string;
  readonly confidence: 'exact' | 'high' | 'manual_approved' | 'unresolved' | 'collision';
  readonly notes: string | null;
}

export interface MigrationReconciliationResult {
  readonly id: number;
  readonly period_start: string | null;
  readonly category: string;
  readonly source_count: number;
  readonly canonical_count: number;
  readonly duplicate_count: number;
  readonly error_count: number;
  readonly checksum_match: boolean;
  readonly discrepancies: ReadonlyArray<unknown>;
  readonly reviewer_disposition: 'pending' | 'approved' | 'flagged' | 'rejected';
  readonly disposition_notes: string | null;
}

export interface MigrationBatchDetails {
  readonly batch: MigrationBatch;
  readonly tabs: ReadonlyArray<MigrationTabSummary>;
  readonly id_maps: ReadonlyArray<MigrationIdMap>;
  readonly reconciliation: ReadonlyArray<MigrationReconciliationResult>;
}

export interface StaffCandidate {
  readonly id: number;
  readonly rosterName: string;
  readonly staffCode: string;
  readonly active: boolean;
}

export interface StaffMatchResult {
  readonly canonicalId: string;
  readonly canonicalLabel: string;
  readonly confidence: 'exact' | 'high' | 'manual_approved' | 'unresolved' | 'collision';
  readonly candidateCount: number;
}

/**
 * Normalizes a shift code string, trimming whitespace and resolving legacy codes (e.g. PN -> ND).
 */
export function normalizeLegacyShift(shift: string | undefined | null): string {
  if (!shift) return 'OFF';
  const clean = shift.trim().toUpperCase();
  if (clean === 'PN') return 'ND'; // Legacy Pass Night code maps to Night Duty
  if (clean === 'ON1' || clean === 'ON2') return 'ND';
  return clean;
}

/**
 * Match a raw name/code from Google Sheets against canonical Staff Directory.
 */
export function matchStaffIdentity(
  sourceName: string,
  sourceCode: string | undefined,
  directory: ReadonlyArray<StaffCandidate>,
): StaffMatchResult {
  const cleanName = sourceName.trim();
  const lowerName = cleanName.toLowerCase();
  const cleanCode = sourceCode?.trim().toLowerCase();

  // 1. Check for collisions (multiple candidates matching case-insensitively)
  const caseInsensitiveName = directory.filter((d) => d.rosterName.toLowerCase() === lowerName);
  if (caseInsensitiveName.length > 1) {
    return {
      canonicalId: '0',
      canonicalLabel: `COLLISION: ${cleanName} matches ${caseInsensitiveName.length} staff`,
      confidence: 'collision',
      candidateCount: caseInsensitiveName.length,
    };
  }

  // 2. Exact match on rosterName
  const exactName = directory.filter((d) => d.rosterName === cleanName);
  if (exactName.length === 1 && exactName[0]) {
    return {
      canonicalId: String(exactName[0].id),
      canonicalLabel: exactName[0].rosterName,
      confidence: 'exact',
      candidateCount: 1,
    };
  }

  // 3. Case-insensitive match on rosterName
  if (caseInsensitiveName.length === 1 && caseInsensitiveName[0]) {
    return {
      canonicalId: String(caseInsensitiveName[0].id),
      canonicalLabel: caseInsensitiveName[0].rosterName,
      confidence: 'high',
      candidateCount: 1,
    };
  }

  // 3. Staff Code match
  if (cleanCode) {
    const codeMatches = directory.filter((d) => d.staffCode.toLowerCase() === cleanCode);
    if (codeMatches.length === 1 && codeMatches[0]) {
      return {
        canonicalId: String(codeMatches[0].id),
        canonicalLabel: `${codeMatches[0].rosterName} (${codeMatches[0].staffCode})`,
        confidence: 'high',
        candidateCount: 1,
      };
    }
  }

  // 4. Unresolved
  return {
    canonicalId: '0',
    canonicalLabel: `UNRESOLVED: ${cleanName}`,
    confidence: 'unresolved',
    candidateCount: 0,
  };
}

/**
 * Computes a simple deterministic FNV-1a 32-bit hash string for raw row verification.
 */
export function computeDeterministicRowHash(payload: Record<string, unknown>): string {
  const sortedKeys = Object.keys(payload).sort();
  const str = JSON.stringify(sortedKeys.map((k) => [k, payload[k]]));

  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Calculates a cryptographic checksum summary for a set of roster assignments.
 */
export function calculateRosterChecksum(
  assignments: ReadonlyArray<{
    readonly staffId: number | string;
    readonly dutyDate: string;
    readonly shiftCode: string;
  }>,
): {
  readonly totalAssignments: number;
  readonly uniqueStaffCount: number;
  readonly uniqueDatesCount: number;
  readonly shiftCounts: Record<string, number>;
  readonly checksumHash: string;
} {
  const staffSet = new Set<string>();
  const dateSet = new Set<string>();
  const shiftCounts: Record<string, number> = {};

  let aggregateHash = 0;

  for (const a of assignments) {
    staffSet.add(String(a.staffId));
    dateSet.add(a.dutyDate);
    const code = normalizeLegacyShift(a.shiftCode);
    shiftCounts[code] = (shiftCounts[code] ?? 0) + 1;

    // Rolling hash
    const itemStr = `${a.staffId}:${a.dutyDate}:${code}`;
    for (let i = 0; i < itemStr.length; i++) {
      aggregateHash = (aggregateHash * 31 + itemStr.charCodeAt(i)) | 0;
    }
  }

  return {
    totalAssignments: assignments.length,
    uniqueStaffCount: staffSet.size,
    uniqueDatesCount: dateSet.size,
    shiftCounts,
    checksumHash: (aggregateHash >>> 0).toString(16).padStart(8, '0'),
  };
}

/**
 * Generates sample rehearsal data representing a December 2026 legacy Google Sheets export.
 */
export function createSampleLegacyExport(customBatchId?: string): {
  readonly batchId: string;
  readonly spreadsheetId: string;
  readonly tabManifest: Array<{ tabName: string; rowCount: number; columnCount: number }>;
  readonly tabsData: Record<
    string,
    Array<{ row_number: number; payload: Record<string, unknown> }>
  >;
} {
  const batchId =
    customBatchId ??
    `REHEARSAL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
  const spreadsheetId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

  const staffRows = [
    {
      row_number: 1,
      payload: { roster_name: 'Dr Afif', staff_code: 'MO-01', staff_group: 'Medical Officer' },
    },
    {
      row_number: 2,
      payload: { roster_name: 'Dr Siti', staff_code: 'MO-02', staff_group: 'Medical Officer' },
    },
    {
      row_number: 3,
      payload: { roster_name: 'Dr Tan', staff_code: 'MO-03', staff_group: 'Medical Officer' },
    },
  ];

  const rosterRows: Array<{ row_number: number; payload: Record<string, unknown> }> = [];
  let rowIdx = 1;
  const sampleDoctors = ['Dr Afif', 'Dr Siti', 'Dr Tan'];
  const sampleShifts = ['AM', 'PM', 'ND', 'OFF', 'OFF', 'AM', 'PM'];

  for (let day = 1; day <= 31; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dutyDate = `2026-12-${dayStr}`;
    for (let docIdx = 0; docIdx < sampleDoctors.length; docIdx++) {
      const shift = sampleShifts[(day + docIdx) % sampleShifts.length] ?? 'AM';
      rosterRows.push({
        row_number: rowIdx++,
        payload: {
          period_start: '2026-12-01',
          period_end: '2026-12-31',
          duty_date: dutyDate,
          roster_name: sampleDoctors[docIdx],
          shift_code: shift,
          note: null,
        },
      });
    }
  }

  const requestRows = [
    {
      row_number: 1,
      payload: {
        id: 'REQ-101',
        roster_name: 'Dr Afif',
        start_date: '2026-12-24',
        end_date: '2026-12-25',
        reason_category: 'annual_leave',
        notes: 'Christmas Eve & Christmas',
        status: 'approved',
      },
    },
    {
      row_number: 2,
      payload: {
        id: 'REQ-102',
        roster_name: 'Dr Siti',
        start_date: '2026-12-31',
        end_date: '2026-12-31',
        requested_shift_code: 'AM',
        reason_category: 'shift_preference',
        notes: 'Prefer AM shift on New Year Eve',
        status: 'approved',
      },
    },
  ];

  return {
    batchId,
    spreadsheetId,
    tabManifest: [
      { tabName: 'StaffDirectory', rowCount: staffRows.length, columnCount: 3 },
      { tabName: 'MasterRoster', rowCount: rosterRows.length, columnCount: 6 },
      { tabName: 'Requests', rowCount: requestRows.length, columnCount: 7 },
    ],
    tabsData: {
      StaffDirectory: staffRows,
      MasterRoster: rosterRows,
      Requests: requestRows,
    },
  };
}
