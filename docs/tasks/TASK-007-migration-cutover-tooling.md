# Task Brief: TASK-007 Google Sheets Migration Engine, Historical Rehearsal & Cutover Tooling (Wave G)

## Identity

- Task ID: TASK-007
- Workstream: Wave G — Google Sheets Migration Engine, Historical Rehearsal & Cutover Tooling
- Owner/agent: Antigravity
- Branch/worktree: `main`
- Dependencies: TASK-001 (Scaffold baseline), TASK-002 (Identity & RLS Foundation), TASK-003 (Workforce & Requests), TASK-004 (Rules Engine & Draft Grid), TASK-005 (Roster Lifecycle & Amendments), TASK-006 (Drive, PDF & Telegram)
- Target Environment: Supabase Staging (`hgrutigkgnrcjhcjxabs`)
- Production impact: NONE (Zero production changes, zero production keys)

## Objective

Deliver the complete production-grade Google Sheets migration engine, historical rehearsal pipeline, staff identity collision resolver, reconciliation reports, and cutover safety gates matching `MODULAR_APP_BLUEPRINT/09_MIGRATION_CUTOVER.md` and `ADR-002`:

1. **Database Schema & Migrations (`Wave G Schema`)**:
   - `legacy.import_batches`: Ingestion batch metadata tracking source spreadsheet ID, export timestamp, tab manifest, file hashes, importer version, status (`staged`, `validating`, `reconciled`, `committed`, `rolled_back`), and reconciliation summary.
   - `legacy.raw_rows`: Immutable raw representation of source spreadsheet rows (`tab_name`, `row_number`, `payload`, `row_hash`).
   - `legacy.id_map`: Source-to-canonical staff identity mappings tracking confidence (`exact`, `high`, `manual_approved`, `unresolved`, `collision`).
   - `legacy.reconciliation_results`: Aggregate reconciliation records comparing source vs destination counts, duplicate counts, checksum match status, and reviewer disposition.
   - Enhanced `public.roster_periods` with `legacy_read_only` and `import_batch_id`.
   - Postgres security definer RPCs: `get_migration_batches`, `create_migration_batch`, `stage_raw_rows`, `get_migration_batch_details`, `save_id_mapping`, `update_reconciliation_disposition`, `execute_migration_transform`, `revert_migration_batch`.
2. **Pure TypeScript Domain Engine (`src/features/migration/domain/migrationEngine.ts`)**:
   - `normalizeLegacyShift`: Trims, standardizes uppercase, maps legacy codes (PN -> ND, ON1/ON2 -> ND).
   - `matchStaffIdentity`: Deterministic matching against canonical staff directory with exact, case-insensitive high, staff code, collision detection, and unresolved fallbacks.
   - `computeDeterministicRowHash`: Stable FNV-1a row hash across sorted JSON keys.
   - `calculateRosterChecksum`: Total assignments, unique staff, unique dates, shift breakdown, and deterministic aggregate hash.
   - `createSampleLegacyExport`: Realistic December 2026 rehearsal generator with StaffDirectory, MasterRoster, and Requests tabs.
3. **Owner Migration & Cutover Admin Console (`/admin/migration`)**:
   - `MigrationBatchList.tsx`: Batches explorer, status chips, raw row counts, and quick sample rehearsal loader.
   - `MigrationReconciliationView.tsx`: Metrics cards, tab manifest explorer, category reconciliation table, and reviewer disposition toggles (`approved`, `flagged`, `rejected`).
   - `MigrationIdentityMappingTable.tsx`: Staff mapping table, match confidence badges, and interactive manual resolution modal.
   - `MigrationCutoverGate.tsx`: Cutover readiness checklist (tabs classified, staff mapped, checksums verified, exceptions disposed, rollback safety), dry-run simulator, canonical commit trigger, and revert action.
   - `MigrationNewBatchModal.tsx`: Custom batch registration modal.

## Verification & Quality Gates

- TypeScript: 0 errors (`npm run typecheck`).
- Lint: 0 errors, 0 warnings (`npm run lint`).
- Format: 100% Prettier compliance (`npm run format:check`).
- Unit & integration tests: 23 test suites, 113 tests passing (`npm test -- --run`).
- Vite Production Build: Built cleanly in 1.69s (`tsc -b && vite build`).
