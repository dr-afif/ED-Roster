import { describe, expect, it } from 'vitest';
import {
  normalizeLegacyShift,
  matchStaffIdentity,
  computeDeterministicRowHash,
  calculateRosterChecksum,
  createSampleLegacyExport,
  type StaffCandidate,
} from '../migrationEngine';

describe('migrationEngine (Wave G Domain)', () => {
  describe('normalizeLegacyShift', () => {
    it('normalizes standard shifts and trims whitespace', () => {
      expect(normalizeLegacyShift(' am ')).toBe('AM');
      expect(normalizeLegacyShift('pm')).toBe('PM');
      expect(normalizeLegacyShift('nd')).toBe('ND');
      expect(normalizeLegacyShift(null)).toBe('OFF');
      expect(normalizeLegacyShift('')).toBe('OFF');
    });

    it('maps legacy shift codes to canonical definitions', () => {
      expect(normalizeLegacyShift('PN')).toBe('ND'); // Pass Night -> Night Duty
      expect(normalizeLegacyShift('pn')).toBe('ND');
      expect(normalizeLegacyShift('ON1')).toBe('ND');
      expect(normalizeLegacyShift('ON2')).toBe('ND');
    });
  });

  describe('matchStaffIdentity', () => {
    const directory: StaffCandidate[] = [
      { id: 1, rosterName: 'Dr Afif', staffCode: 'MO-01', active: true },
      { id: 2, rosterName: 'Dr Siti', staffCode: 'MO-02', active: true },
      { id: 3, rosterName: 'Dr Tan', staffCode: 'MO-03', active: true },
    ];

    it('matches exact name with exact confidence', () => {
      const result = matchStaffIdentity('Dr Afif', 'MO-01', directory);
      expect(result.confidence).toBe('exact');
      expect(result.canonicalId).toBe('1');
      expect(result.canonicalLabel).toBe('Dr Afif');
    });

    it('matches case-insensitive name with high confidence', () => {
      const result = matchStaffIdentity('dr siti', undefined, directory);
      expect(result.confidence).toBe('high');
      expect(result.canonicalId).toBe('2');
      expect(result.canonicalLabel).toBe('Dr Siti');
    });

    it('matches by staff code when name differs slightly', () => {
      const result = matchStaffIdentity('Dr Siti Aminah', 'mo-02', directory);
      expect(result.confidence).toBe('high');
      expect(result.canonicalId).toBe('2');
    });

    it('flags collisions when multiple candidates match', () => {
      const collisionDir: StaffCandidate[] = [
        { id: 10, rosterName: 'Dr Lee', staffCode: 'MO-10', active: true },
        { id: 11, rosterName: 'dr lee', staffCode: 'MO-11', active: true },
      ];
      const result = matchStaffIdentity('Dr Lee', undefined, collisionDir);
      expect(result.confidence).toBe('collision');
      expect(result.candidateCount).toBe(2);
    });

    it('marks unknown staff as unresolved', () => {
      const result = matchStaffIdentity('Dr Unknown Locum', undefined, directory);
      expect(result.confidence).toBe('unresolved');
      expect(result.canonicalId).toBe('0');
    });
  });

  describe('computeDeterministicRowHash', () => {
    it('produces identical hashes regardless of object key order', () => {
      const hash1 = computeDeterministicRowHash({ a: 1, b: 'two', c: true });
      const hash2 = computeDeterministicRowHash({ c: true, a: 1, b: 'two' });
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(8);
    });

    it('produces different hashes for different payloads', () => {
      const hash1 = computeDeterministicRowHash({ a: 1 });
      const hash2 = computeDeterministicRowHash({ a: 2 });
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('calculateRosterChecksum', () => {
    it('calculates totals, unique entities, and rolling checksum', () => {
      const assignments = [
        { staffId: 1, dutyDate: '2026-12-01', shiftCode: 'AM' },
        { staffId: 2, dutyDate: '2026-12-01', shiftCode: 'PM' },
        { staffId: 1, dutyDate: '2026-12-02', shiftCode: 'ND' },
      ];

      const checksum = calculateRosterChecksum(assignments);
      expect(checksum.totalAssignments).toBe(3);
      expect(checksum.uniqueStaffCount).toBe(2);
      expect(checksum.uniqueDatesCount).toBe(2);
      expect(checksum.shiftCounts['AM']).toBe(1);
      expect(checksum.shiftCounts['PM']).toBe(1);
      expect(checksum.shiftCounts['ND']).toBe(1);
      expect(checksum.checksumHash).toBeDefined();
    });
  });

  describe('createSampleLegacyExport', () => {
    it('generates sample December 2026 export with required tabs', () => {
      const sample = createSampleLegacyExport();
      expect(sample.batchId).toContain('REHEARSAL');
      expect(sample.tabManifest.length).toBe(3);
      expect(sample.tabsData['StaffDirectory']?.length).toBe(3);
      expect(sample.tabsData['MasterRoster']?.length).toBe(93); // 31 days * 3 doctors
      expect(sample.tabsData['Requests']?.length).toBe(2);
    });
  });
});
