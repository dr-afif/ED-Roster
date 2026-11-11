# Handoff Brief: HANDOFF-004 Roster Rules Engine, Versioned Configuration & Draft Workspace (Wave D)

## Task Identity

- Task ID: TASK-004
- Workstream: Wave D — Core Roster Rules Engine, Semantic Mapping & Draft Workspace Grid
- Branch: `feat/wave-d-roster-engine`
- Target Database: Supabase Staging (`hgrutigkgnrcjhcjxabs`)
- Production Impact: NONE (All migrations and tests run strictly against staging)

## Summary of Accomplishments

1. **Database Schema & Row Level Security (`20261111120000_wave_d_roster_engine_schema.sql`)**:
   - `public.shift_definitions`: Canonical shift types (`AM`, `PM`, `ON`, `ON1`, `ON2`, `PN`, `OFF`, `GOFF`, `AL`, `MC`, `EL`, `HKA`, `GHKA`, `COURSE`, `NIGHT`), color tokens, labels, and sort orders.
   - `public.shift_semantics`: Classifications (`worked`, `transparent`, `reset`), coverage flags, and Policy-B night eligibility.
   - `public.rule_sets` & `public.rule_versions`: Immutable versioned parameters (`ed_default`, Version 1) storing Policy-B configuration, max consecutive days (6), and night bundle patterns.
   - `public.staffing_thresholds`: Effective-dated minimum staffing counts per day type (`weekday`, `weekend`, `holiday`) and bucket (`am`, `pm`, `night`, `total`).
   - `public.roster_periods`: Monthly lifecycle container anchored to the 1st of the month, starting with the first native draft period (`2027-01-01`).
   - `public.roster_draft_assignments`: Mutable draft schedule cells with revision tracking.
   - RLS policies enforcing approved user read transparency and strict owner-only administrative mutation.
   - Generated up-to-date TypeScript contracts in `src/platform/supabase/database.types.ts`.

2. **Pure TypeScript Roster Rules Engine (`src/features/rosters/domain/`)**:
   - Fully deterministic calculation engine with zero network, database, clock, or browser dependencies.
   - `semantics.ts`: Code normalization (e.g. `AM(S)` -> base `AM`), class lookups, and modifier inheritance.
   - `weeklyOff.ts`: Monday–Sunday boundaries, cross-month/year evaluation, and Policy-B enforcement (1 OFF with qualifying night, 2 OFFs without night duty).
   - `sequences.ts`: Tracks consecutive worked shifts (advisory warning at 7), `PN` transparency, and validates night shift bundles (`ON1 -> ON2 -> PN`, `ON1 -> PN`, `ON -> PN`).
   - `staffing.ts`: Daily shift bucket aggregation vs weekday/weekend/holiday minimum thresholds.
   - `rulesEngine.ts`: Master engine coordinator returning structured issues, weekly OFF results, staffing shortage indicators, GOFF projections, and reproducible checksums.
   - Test suite: 14 exhaustive unit tests covering all rules, boundary conditions, and invariant constraints.

3. **Draft Roster Workspace Grid (`src/features/rosters/`)**:
   - `RosterPeriodRoute.tsx`: Route for `/rosters/:yyyy/:mm` (e.g. `/rosters/2027/01`).
   - `RosterGrid.tsx`: Desktop-first 2D matrix (Staff rows × Day columns 1..31) with sticky headers, color-coded shift pills, and searchable filter.
   - `ShiftPickerModal.tsx`: One-click rapid shift selection and cell assignment.
   - `RosterIssuesPanel.tsx`: Collapsible live rules guidance panel displaying real-time staffing shortages, missing weekly OFFs, consecutive work warnings, and night rest violations.
   - `SaveStatusBar`: Displays real-time save state, revision count, and deterministic checksum.

4. **Rules & Settings Administration UI (`src/features/rules/` and `src/features/settings/`)**:
   - `RulesAdminRoute.tsx` (`/admin/rules`): Tabular inspection of active scheduling policies, staffing thresholds, and shift semantic classifications.
   - `SettingsAdminRoute.tsx` (`/admin/settings`): Direct owner controls for Shift Request Quotas (Daily OFF slot limit: 3, Monthly cap: 10, Weekend cap: 4, Submission cutoff day: 20th), window lock/unlock toggle, and integration status.

## Verification & Quality Gates

- `npm run typecheck`: 0 errors.
- `npm run lint`: 0 errors, 0 warnings.
- `npm run format:check`: 100% matched across repository.
- `npm test -- --run`: 13 test suites, 64 tests passing.
- `npm run build`: Production build succeeded in 2.00s.
- Secrets / PII scan: Clean (0 real emails, 0 credentials).
