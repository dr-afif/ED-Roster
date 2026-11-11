# Task Brief: TASK-004 Roster Rules Engine, Versioned Configuration & Draft Workspace (Wave D)

## Identity

- Task ID: TASK-004
- Workstream: Wave D — Core Roster Rules Engine, Semantic Mapping & Draft Workspace Grid
- Owner/agent: Antigravity
- Branch/worktree: `feat/wave-d-roster-engine`
- Dependencies: TASK-001 (Scaffold baseline), TASK-002 (Identity & RLS Foundation), TASK-003 (Workforce & Request Foundation)
- Target Environment: Supabase Staging (`hgrutigkgnrcjhcjxabs`)
- Production impact: NONE (Zero production changes, zero production keys)

## Objective

Deliver the deterministic Roster Rules Engine, database schema for roster periods and draft assignments, versioned rule configurations, and the desktop-first January 2027 draft roster workspace grid with live issues guidance and settings management:

1. **Pure Roster Rules Engine** (`src/features/rosters/domain/`): Deterministic calculation engine (zero network/database dependency) enforcing:
   - Shift semantic classifications: `worked` (`AM`, `PM`, `ON`, `ON1`, `ON2`, `NIGHT`), `transparent` (`PN`), and `reset` (`OFF`, `GOFF`, `AL`, `MC`, `EL`, `HKA`, `GHKA`, `COURSE`).
   - Weekly OFF evaluation: Monday–Sunday boundaries, cross-month/year evaluation, Policy-A (1 OFF/wk) and Policy-B (1 OFF if qualifying night worked, else 2 OFFs).
   - Consecutive work tracking: Recommended max 6 worked days, `PN` transparency, reset upon rest/leave.
   - Night bundles & rest: `ON1 → ON2 → PN`, `ON1 → PN`, `ON/N/NIGHT → PN`, flagging broken bundles or missing post-night rest.
   - Staffing thresholds: Comparing daily duty counts (AM, PM, Night) against effective-dated minimums.
   - Deterministic input/output checksumming.
2. **Database Schema & RLS** (`supabase/migrations/20261111120000_wave_d_roster_engine_schema.sql`):
   - `public.shift_definitions` & `public.shift_semantics`.
   - `public.rule_sets` & `public.rule_versions` (immutable JSONB versioning).
   - `public.staffing_thresholds`.
   - `public.roster_periods` (anchored to first day of month, revision tracking).
   - `public.roster_draft_assignments` (mutable draft cells with revision idempotency).
   - Strict Row Level Security policies.
3. **Draft Roster Workspace Grid** (`/rosters/period/:periodId` or `/rosters/2027-01`):
   - Desktop-first responsive matrix with sticky staff and date headers.
   - Cell selection, quick shift popover, and keyboard navigation.
   - Live Issues Guidance Panel surfacing real-time rule warnings (staffing shortages, missing OFFs, consecutive work warnings).
   - Save status bar with revision tracking and debounced autosave.
4. **Settings & Rules Administration** (`/admin/rules` & `/admin/settings`):
   - View active rule configuration (Policy B, consecutive limit, staffing minimums).
   - Edit draft version and preview rule impacts.

## Verification & Quality Gates

- TypeScript: 0 errors (`npm run typecheck`).
- Lint: 0 errors, 0 warnings (`npm run lint`).
- Format: 100% Prettier compliance (`npm run format:check`).
- Unit tests: Full rules engine test corpus covering all boundary weeks, Policy A & B, night bundles, consecutive work, and PN transparency (`npm test -- --run`).
- Production build: Succeeded in Vite (`npm run build`).
