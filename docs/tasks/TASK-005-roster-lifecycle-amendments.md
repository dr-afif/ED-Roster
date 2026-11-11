# Task Brief: TASK-005 Roster Lifecycle, Atomic Publication, Operational Views & Amendments Engine (Wave E)

## Identity

- Task ID: TASK-005
- Workstream: Wave E — Complete Roster Lifecycle, Immutable Publication, Three Views & Operational Amendments
- Owner/agent: Antigravity
- Branch/worktree: `feat/wave-e-lifecycle-amendments`
- Dependencies: TASK-001 (Scaffold baseline), TASK-002 (Identity & RLS Foundation), TASK-003 (Workforce & Requests), TASK-004 (Rules Engine & Draft Grid)
- Target Environment: Supabase Staging (`hgrutigkgnrcjhcjxabs`)
- Production impact: NONE (Zero production changes, zero production keys)

## Objective

Deliver the complete production-grade Roster Lifecycle, atomic publication transaction, three operational views (Current, Original Planned, Changes/Amendments), operational amendment workflows (Absence, Replacement, Swap, Correction, Reversal), and the compensatory GOFF ledger mechanics:

1. **Atomic Publication Transaction (`Draft → Published`)**:
   - Secure Postgres RPC `publish_roster_period`:
     - Validates owner role and expected draft status.
     - Freezes draft assignments into immutable `roster_planned_assignments`.
     - Generates `roster_publications` record with version, revision, and data checksum.
     - Emits append-only audit log entry.
     - Changes period status to `published`.
2. **Three Operational Roster Views**:
   - **Current Roster**: Live operational schedule (`planned assignments + active amendment lines`).
   - **Original Planned**: Immutable publication snapshot from `roster_planned_assignments`.
   - **Changes / Amendments History**: Comprehensive timeline and diff table of all operational adjustments.
3. **Structured Amendments Engine**:
   - `roster_amendment_events` and linked `roster_amendment_lines`.
   - Categories:
     - `absence_only`: Staff member absent (e.g. sick leave / emergency leave).
     - `absence_plus_replacement`: Absent staff replaced by an on-duty doctor.
     - `shift_swap`: Mutual shift exchange between two doctors with rest protection.
     - `admin_correction`: Administrative adjustment.
     - `reversal`: Reversal of a previous amendment via compensating lines.
   - Pre-flight preview: displays staffing before and after, weekly OFF effects, and rest alerts.
4. **GOFF Ledger Mechanics (`public.goff_ledger`)**:
   - Tracking compensatory rest: opening balance + earned - used.
   - Displaced planned normal OFFs earn 1 GOFF upon period close.
   - Pre-close reservations and releases.
5. **Close & Reopen Lifecycle**:
   - `close_roster_period`: Finalizes ledger entries, transitions status to `closed`.
   - `reopen_roster_period`: Reasoned owner-only reopening with audit tracking.

## Verification & Quality Gates

- TypeScript: 0 errors (`npm run typecheck`).
- Lint: 0 errors, 0 warnings (`npm run lint`).
- Format: 100% Prettier compliance (`npm run format:check`).
- Unit tests: Full lifecycle, publication, amendments, and GOFF test suite (`npm test -- --run`).
- Production build: Succeeded in Vite (`npm run build`).
