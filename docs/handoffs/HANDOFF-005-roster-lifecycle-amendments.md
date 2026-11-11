# Handoff Report: TASK-005 Roster Lifecycle, Atomic Publication, Operational Views & Amendments Engine (Wave E)

## 1. Executive Summary

Wave E delivers the complete production-grade Roster Lifecycle, atomic publication transaction, three operational schedule views (`Current Roster`, `Original Planned`, `Changes / Audit`), operational amendment workflows (`absence_only`, `absence_plus_replacement`, `shift_swap`, `admin_correction`, `reversal`), and compensatory rest (`GOFF`) ledger mechanics on top of the Supabase Staging environment (`hgrutigkgnrcjhcjxabs`).

Zero modifications were made to the live legacy monolith (`dr-afif/REQUEST-APP`) and zero changes to the production Supabase database (`bubvwijyaqfbugsaedxp`).

---

## 2. Implemented Capabilities

### A. Atomic Publication Transaction (`Draft → Published`)

- **Postgres RPC `publish_roster_period(p_period_id, p_notes)`**:
  - Restricts execution strictly to active owners via `private.is_active_owner()`.
  - Verifies period status is `draft` and assignment count > 0.
  - Snapshots all cells from `roster_draft_assignments` into immutable `roster_planned_assignments`.
  - Creates a versioned `roster_publications` snapshot with data hash and revision metadata.
  - Transitions period status to `published` and appends to `public.audit_events`.
- **UI Publication Modal (`PublishModal.tsx`)**:
  - Highlights atomic publication invariant: once published, cells are frozen into the immutable baseline.
  - Displays summary statistics (assigned shifts, active rule version, compliance issue count).
  - Collects optional publication notes and executes publication atomically.

### B. Three Operational Schedule Views

- **View Mode Switcher (`RosterPeriodRoute.tsx`)**:
  - **Live Schedule (Current)**:
    - Operational schedule computed in real-time via `computeCurrentAssignments(plannedAssignments, amendmentEvents)`.
    - Real-time Policy B rules engine verification runs on live assignments.
    - Owner can click any cell to pre-populate and launch the operational amendment modal.
  - **Original Planned**:
    - Displays immutable publication snapshot from `roster_planned_assignments` (read-only baseline).
  - **Changes & Audit**:
    - Displays `AmendmentHistoryList.tsx` showing the full audit trail of operational adjustments.

### C. Operational Amendments Engine

- **Structured Categories**:
  - `absence_only`: Doctor absent (MC, EL, AL, OFF) without replacement.
  - `absence_plus_replacement`: Absent doctor covered by an off-duty colleague.
  - `shift_swap`: Mutual shift exchange between two doctors.
  - `admin_correction`: Administrative adjustment.
  - `reversal`: Append-only reversal generating compensating inverted lines.
- **Pure Domain Engine (`src/features/rosters/domain/amendments.ts`)**:
  - Validation functions: `validateAbsenceOnly`, `validateAbsencePlusReplacement`, `validateShiftSwap`, `validateAdminCorrection`.
  - Schedule replay: `computeCurrentAssignments` replays active events chronologically over planned assignments.
- **Interactive Amendment Modal (`AmendRosterModal.tsx`)**:
  - Multi-workflow tabbed interface.
  - Real-time pre-flight impact preview.
  - Compensatory Rest Alert: highlights when a replacement doctor is called in from scheduled off-duty rest, qualifying for +1 GOFF accrual upon roster reconciliation.

### D. Compensatory Rest (`GOFF`) Ledger Mechanics

- **Schema**: `public.goff_ledger` tracking `opening_balance`, `earned`, `used`, `adjustment`, `expired`.
- **Pure Domain Logic (`src/features/rosters/domain/goff.ts`)**:
  - `calculateStaffGoffBalance(entries, staffId)`: Computes opening + earned - used + adjustments.
  - `summarizeAllStaffGoffBalances(entries)`: Lookup map for all department staff.
  - `detectOffDisplacementGoffAccruals(planned, current, semantics)`: Detects when planned rest (`OFF` / `GOFF`) was replaced by emergency coverage shifts.

### E. Period Close & Reconcile Lifecycle

- **Postgres RPC `close_roster_period(p_period_id, p_notes)`**:
  - Transitions period status to `closed`.
  - Reconciles final schedule and logs closing audit event.
- **Postgres RPC `reopen_roster_period(p_period_id, p_reason)`**:
  - Strictly requires a non-empty operational reason.
  - Transitions status back to `amended` and increments revision.
- **Reconciliation Modal (`CloseReconcileModal.tsx`)**:
  - Displays cycle statistics and lists all doctors qualifying for +1 GOFF accruals.
  - Handles reasoned reopening for closed periods.

---

## 3. Verification & Quality Gates

All automated quality gates passed with zero errors:

| Quality Gate                 | Tool / Runner           | Result                                           |
| ---------------------------- | ----------------------- | ------------------------------------------------ |
| **TypeScript**               | `tsc -b --pretty false` | 0 errors                                         |
| **ESLint**                   | `eslint .`              | 0 errors, 0 warnings                             |
| **Formatting**               | `prettier --check .`    | 100% compliant                                   |
| **Unit & Integration Tests** | `vitest run`            | **16 test files passed, 82 tests passed** (100%) |
| **Production Build**         | `vite build`            | Succeeded in 1.99s (`dist/` generated)           |

---

## 4. Key Files Created / Modified

- `supabase/migrations/20261111140000_wave_e_lifecycle_amendments_schema.sql` (Tables, RLS policies, RPCs)
- `src/platform/supabase/database.types.ts` (Regenerated TypeScript schema bindings)
- `src/features/rosters/domain/types.ts` (Amendment & GOFF domain type extensions)
- `src/features/rosters/domain/amendments.ts` (Pure amendments calculations & validation)
- `src/features/rosters/domain/goff.ts` (Compensatory rest balance & accrual detector)
- `src/features/rosters/domain/__tests__/amendments.test.ts` (12 unit tests)
- `src/features/rosters/domain/__tests__/goff.test.ts` (3 unit tests)
- `src/features/rosters/data/rosterQueries.ts` (Query & mutation hooks for lifecycle, amendments, and GOFF)
- `src/features/rosters/components/PublishModal.tsx` (Atomic publication modal)
- `src/features/rosters/components/AmendRosterModal.tsx` (Operational amendment modal)
- `src/features/rosters/components/AmendmentHistoryList.tsx` (Audit timeline & reversal action)
- `src/features/rosters/components/CloseReconcileModal.tsx` (Close & reopen reconciliation modal)
- `src/features/rosters/routes/RosterPeriodRoute.tsx` (Unified workspace with 3 operational views)
- `src/features/rosters/__tests__/rosterLifecycle.test.tsx` (5 comprehensive integration tests)
