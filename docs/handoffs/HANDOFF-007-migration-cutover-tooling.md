# Handoff Report: TASK-007 Google Sheets Migration Engine, Historical Rehearsal & Cutover Tooling (Wave G)

## 1. Executive Summary

Wave G delivers the complete production-grade Google Sheets migration engine, historical rehearsal pipeline, staff identity collision resolver, checksum reconciliation dashboard, and cutover safety gates on top of the Supabase Staging environment (`hgrutigkgnrcjhcjxabs`).

Zero modifications were made to the live legacy monolith (`dr-afif/REQUEST-APP`) and zero changes to the production Supabase database (`bubvwijyaqfbugsaedxp`).

---

## 2. Implemented Capabilities

### A. Database Schema & RLS Policies (`Wave G Schema`)

- **`legacy.import_batches`**:
  - Ingestion batch metadata tracking source spreadsheet ID, export timestamp, tab manifest, file hashes, importer version, status (`staged`, `validating`, `reconciled`, `committed`, `rolled_back`), and reconciliation summary.
  - Row Level Security: Owner-only access (`private.is_active_owner()`).
- **`legacy.raw_rows`**:
  - Immutable raw representation of source spreadsheet rows (`tab_name`, `row_number`, `payload`, `row_hash`).
  - Unique constraint enforces `(batch_id, tab_name, row_number)`.
- **`legacy.id_map`**:
  - Source-to-canonical staff identity mappings tracking confidence (`exact`, `high`, `manual_approved`, `unresolved`, `collision`).
  - Unique constraint enforces `(batch_id, source_entity, source_key)`.
- **`legacy.reconciliation_results`**:
  - Aggregate reconciliation records comparing source vs destination counts, duplicate counts, checksum match status, and reviewer disposition.
- **Enhanced `public.roster_periods`**:
  - Added `legacy_read_only` and `import_batch_id` columns with supporting index.
- **Postgres Security Definer RPCs**:
  - `get_migration_batches`: Returns all staged and processed migration batches with raw row counts.
  - `create_migration_batch`: Idempotently registers an import batch container and logs to `audit_events`.
  - `stage_raw_rows`: Batch inserts raw spreadsheet rows into `legacy.raw_rows`.
  - `get_migration_batch_details`: Returns tab summaries, raw row counts, ID mappings, and reconciliation results.
  - `save_id_mapping`: Upserts manual staff mapping or resolves collision.
  - `update_reconciliation_disposition`: Updates reviewer disposition notes and status.
  - `execute_migration_transform`: Executes identity resolution, roster transform into `roster_periods` (`legacy_read_only = true`), `roster_publications`, `roster_planned_assignments`, and requests transform into `roster_requests`. Supports `p_dry_run` for non-destructive simulation.
  - `revert_migration_batch`: Archives imported periods while strictly preserving all raw evidence in `legacy.raw_rows`.

### B. Pure TypeScript Domain Engine (`src/features/migration/domain/migrationEngine.ts`)

- **`normalizeLegacyShift`**: Standardizes shift codes, normalizes legacy codes (`PN` -> `ND`, `ON1`/`ON2` -> `ND`).
- **`matchStaffIdentity`**: Deterministic matching algorithm matching exact roster name, case-insensitive name, staff code, detecting collisions, or flagging unresolved staff.
- **`computeDeterministicRowHash`**: Stable FNV-1a hash across sorted JSON keys.
- **`calculateRosterChecksum`**: Computes person-shifts count, unique dates, unique staff, and aggregate rolling checksum.
- **`createSampleLegacyExport`**: Generates a realistic legacy December 2026 rehearsal export (StaffDirectory, MasterRoster with 93 shift assignments, Requests).

### C. Owner Migration & Cutover Admin Console (`/admin/migration`)

- **`MigrationBatchList.tsx`**: Batch list with status chips, raw row count, and one-click "Load Rehearsal Batch (Dec 2026)".
- **`MigrationReconciliationView.tsx`**: High-level metrics cards, tab manifest explorer, category reconciliation table, and reviewer disposition controls (`Approve`, `Flag`).
- **`MigrationIdentityMappingTable.tsx`**: Comprehensive mapping table with confidence badges (`Exact Match`, `High Confidence`, `Owner Approved`, `Name Collision`, `Unresolved`) and interactive manual resolution modal.
- **`MigrationCutoverGate.tsx`**: Visual cutover readiness checklist (100% tabs classified, staff mapped, checksums verified, exceptions disposed, rollback safety), dry-run simulator, canonical commit trigger, and revert action.
- **`MigrationNewBatchModal.tsx`**: Custom batch registration modal.

---

## 3. Verification & Test Coverage

All quality gates pass cleanly:

- **TypeScript**: 0 errors (`npm run typecheck`).
- **ESLint**: 0 errors, 0 warnings (`npm run lint`).
- **Prettier**: 100% compliant (`npm run format:check`).
- **Vitest**: 23 test suites, 113 tests passing (`npm test -- --run`):
  - `src/features/migration/domain/__tests__/migrationEngine.test.ts` (11 tests passing)
  - `src/features/migration/__tests__/MigrationAdminRoute.test.tsx` (2 tests passing)
  - Plus all 21 existing test suites (Rules engine, Amendments, Lifecycle, Auth, Directory, Calendar view, Tallies, PDF generator, Quota, Malaysia Date, Architecture boundaries).
- **Vite Production Build**: Built cleanly in 1.69s (`tsc -b && vite build`), generating `dist/assets/migration-CJVJtKfJ.js` (42.09 kB).

---

## 4. Next Steps

- **Owner Rehearsal & Cutover Signoff**:
  - Test `/admin/migration` in the browser by clicking **Load Rehearsal Batch (Dec 2026)**.
  - Review the identity mapping, run the dry-run transform, and verify the cutover checklist.
  - Prepare for final production cutover window.
