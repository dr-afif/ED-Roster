# Handoff: Wave C — Canonical Data, Staff Directory & Allowlist Admin, Self-Service Profiles, and Request Lifecycle

## Outcome

Supabase Staging (`hgrutigkgnrcjhcjxabs`) now hosts the complete Wave C workforce interactions, canonical data schemas, credential catalogs, Malaysian statutory public holidays, and request decision lifecycles. Postgres Row Level Security (RLS) is enabled on all seven newly created public tables with granular role predicates, zero unindexed foreign keys, and strict server-side authorization enforcement across all RPC functions.

The frontend SPA is enhanced with accessible, responsive interfaces for:

1. **Owner Staff Directory & Allowlist Administration** (`/admin/staff`): Real-time metrics, search/filtering, modal dialogs for inviting staff by Google email, and account status transitions (activate, suspend, revoke) with mandatory audit logging.
2. **Self-Service Staff Profiles** (`/profile/me`): Separation of immutable operational roster identity from user-editable contact fields (`full_name`, `phone`, `registration_number`) via React 19-idiomatic isolated form state and strict self-only RLS update boundaries.
3. **Live-Aligned Roster Request Workflow** (`/requests` and `/admin/requests`): Restored to match the exact live application (`dr-afif/REQUEST-APP`):
   - **Interactive Calendar Surface** (`CalendarView.tsx`): 7-column grid (Mon–Sun) with Malaysian statutory public holiday badges, color-coded team shift tags (`AM`, `PM`, `ON`, `OFF`, `AL`, `HKA`, `GHKA`, `COURSE`), hover tooltips for comments, and month navigation (`‹ Prev`, `Today`, `Next ›`).
   - **Date Detail Slide-Over Panel** (`DateDetailPanel.tsx`): Mobile bottom sheet and desktop right drawer displaying all team requests on the selected date with Edit/Delete controls for authors/admin.
   - **New & Update Request Form** (`NewRequestForm.tsx`): 4-column shift type pill selector with real-time slot quota capping (e.g. max 3 OFFs/day across the ED), live monthly limit warning card, and Admin "submit on behalf of" capabilities.
   - **Personal Request History** (`UserRequests.tsx`): Monthly accordion list of active requests with instant Edit (re-opens panel) and Delete actions.
   - **Alternative Table View** (`RosterTable.tsx`): Team member rows × days columns grid.
   - **Pure Domain Quota Rules** (`quota.ts`): Daily limit (3 slots for OFF/AL/HKA), monthly limit (10 requests), and weekend limit (4 weekend requests).

Staging project reference: `hgrutigkgnrcjhcjxabs`. Production project (`bubvwijyaqfbugsaedxp`) and legacy repository (`dr-afif/REQUEST-APP`) remain 100% untouched.

## Changed artifacts

- **Branch**: `feat/wave-c-requests-directory`
- **Database Migrations & Schemas**:
  - `supabase/migrations/20261111100000_wave_c_requests_records_schema.sql` (applied cleanly to staging `hgrutigkgnrcjhcjxabs`)
- **TypeScript Database Contracts**:
  - `src/platform/supabase/database.types.ts` (regenerated from staging PostgREST schema, 940 lines)
- **Frontend Platform & Shared UI**:
  - `src/platform/auth/authContext.ts` (added `useAuth` convenience hook alias)
  - `src/platform/auth/index.ts`
  - `src/platform/supabase/client.ts` (added ergonomic typed client getter and proxy)
  - `src/platform/supabase/index.ts`
  - `src/shared/ui/Modal.tsx` (accessible dialog with focus trap, backdrop blur, Escape listener, >= 44x44px touch targets)
  - `src/shared/ui/index.ts`
- **Frontend Features**:
  - `src/features/directory/useDirectoryAdmin.ts` (TanStack Query hooks for staff and allowlist management)
  - `src/features/directory/StaffDirectoryAdminRoute.tsx` (directory grid, invite modal, status transition flow)
  - `src/features/profiles/useMyProfile.ts` (TanStack Query hooks for self-service profile querying and mutation)
  - `src/features/profiles/MyProfileRoute.tsx` (operational directory summary & `<ProfileEditForm>` component)
  - `src/features/requests/domain/quota.ts` (pure domain quota rules: daily group limits, monthly/weekend quotas)
  - `src/features/requests/calendar.css` (calendar grid, chip styles, date-panel slide-over drawer styles)
  - `src/features/requests/components/CalendarView.tsx` (interactive 7-column calendar, holiday badges, team chips)
  - `src/features/requests/components/DateDetailPanel.tsx` (accessible date drawer with team request list & embedded form)
  - `src/features/requests/components/NewRequestForm.tsx` (4-column shift type pills, live quota capping, on-behalf-of admin flow)
  - `src/features/requests/components/UserRequests.tsx` (monthly accordion request history with inline edit/delete)
  - `src/features/requests/components/RosterTable.tsx` (alternative table view: staff rows × days columns)
  - `src/features/requests/useRequests.ts` (TanStack Query hooks for active team requests, holidays, mutations)
  - `src/features/requests/RequestsRoutes.tsx` (`StaffRequestsRoute` and `AdminRequestsRoute` implementations)
  - `src/features/dashboard/DashboardRoute.tsx` (updated roadmap status to reflect Wave C live on staging)
- **Automated Tests**:
  - `src/features/directory/__tests__/directoryAdmin.test.tsx` (rendering, search, owner gate, invite flow)
  - `src/features/profiles/__tests__/myProfile.test.tsx` (profile display, editing, validation, save mutation)
  - `src/features/requests/__tests__/requests.test.tsx` (calendar render, table view toggle, quota calculation, date select, new request submission, delete flow)
  - `src/app/__tests__/AppShell.test.tsx` (navigation routing, authenticated dashboard gates)
- **Task & Roadmap Documentation**:
  - `docs/tasks/TASK-003-requests-directory-profiles.md`
  - `docs/handoffs/HANDOFF-003-requests-directory-profiles.md`

## Contracts added or changed

- **Database Schemas & Tables (`public`)**:
  - `public.request_types`: Canonical catalogue of roster request categories (`annual_leave`, `preferred_off`, `cme_leave`, `shift_swap`, `emergency_leave`) with operational constraints (`notice_days_required`, `max_consecutive_days`, `requires_document_proof`).
  - `public.roster_requests`: Submission table with `public_id uuid unique default gen_random_uuid()`, `staff_id`, `request_type_id`, `start_date`, `end_date`, `status text check (status in ('submitted', 'under_review', 'approved', 'rejected', 'withdrawn', 'cancelled'))`, operational `reason`, review metadata (`decided_by_staff_id`, `decided_at`, `decision_reason`).
  - `public.request_status_events`: Immutable transition journal capturing `(from_status, to_status, actor_auth_user_id, note, created_at)`.
  - `public.leave_records`: Operational absence tracking records (`start_date`, `end_date`, `leave_type`, `approved_by_staff_id`) strictly excluding clinical diagnostic data.
  - `public.record_type_definitions`: Catalog of compliance credentials (`apc`, `full_mmc_registration`, `bls`, `acls`, `atls`) with renewal cycles and mandatory flags.
  - `public.professional_records`: Staff compliance records (`staff_id`, `record_type_id`, `registration_number`, `effective_date`, `expiry_date`, `verification_status`).
  - `public.public_holidays`: Malaysian statutory holiday calendar (`holiday_date`, `name`, `state_scope`, `observed_date`, `year`).
- **Database Functions & RPCs (`public` & `private`)**:
  - `public.decide_roster_request(p_request_id bigint, p_decision text, p_reason text)`: `SECURITY DEFINER` RPC restricted to `authenticated` owners with internal authorization check (`private.is_active_owner()`), atomic status transition, review metadata recording, and automated audit logging.
  - `public.admin_create_staff_member(...)`: `SECURITY DEFINER` RPC allowing owner to atomically create a `staff_directory` entry, provision an invited `allowed_users` Google email row, initialize empty `staff_profiles`, and record audit event in a single transaction.
  - `public.admin_update_allowlist_status(p_allowed_user_id bigint, p_new_status text, p_reason text)`: `SECURITY DEFINER` RPC for owner to change user access state (`active`, `suspended`, `revoked`).
  - `private.trg_roster_requests_status_event()`: Trigger function that automatically logs every status change into `request_status_events`.
- **Database Index Optimization**:
  - Created covering indexes on all foreign key references (`request_types_pkey`, `roster_requests_staff_id_idx`, `roster_requests_request_type_id_idx`, `professional_records_record_type_id_idx`, `leave_records_staff_id_idx`, etc.), achieving zero unindexed foreign keys on Supabase performance linter.

## Verification evidence

| Check                        | Command / Tool                                                        | Result                                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration apply              | `supabase_mcp.execute_sql`                                            | Applied cleanly: 7 tables, 3 RPCs, triggers, RLS policies, seeds                                                                                                                                                                                                  |
| Database security advisor    | `get_advisors(project_id: hgrutigkgnrcjhcjxabs, type: 'security')`    | Clean except intentional `0029` findings on `bootstrap_my_session`, `admin_create_staff_member`, `admin_update_allowlist_status`, and `decide_roster_request` (explicitly authorized via `private.is_active_owner()` / `auth.users` checks per Supabase Option 3) |
| Database performance advisor | `get_advisors(project_id: hgrutigkgnrcjhcjxabs, type: 'performance')` | `unindexed_foreign_keys` = 0 across all tables                                                                                                                                                                                                                    |
| Type generation              | `supabase_mcp.generate_typescript_types`                              | Generated 940 lines matching staging schema                                                                                                                                                                                                                       |
| TypeScript compilation       | `npm run typecheck`                                                   | Passed (0 errors)                                                                                                                                                                                                                                                 |
| Linting                      | `npm run lint`                                                        | Passed (0 errors, 0 warnings)                                                                                                                                                                                                                                     |
| Formatting                   | `npm run format:check`                                                | Passed (100% compliant)                                                                                                                                                                                                                                           |
| Automated test suite         | `npm test -- --run`                                                   | Passed: 11 test suites, 46 tests passing                                                                                                                                                                                                                          |
| Production build             | `npm run build`                                                       | Passed: Production bundle built in 1.89s (`dist/assets/*.js`)                                                                                                                                                                                                     |
| Secret & PII scanner         | `architecture-boundaries.test.ts`                                     | Passed: Zero production secrets, zero real staff personal emails committed                                                                                                                                                                                        |

## Security and accessibility review

- **Strict Row Level Security**:
  - Staff can only view their own requests, submit requests for their own `staff_id`, and withdraw requests that belong to them.
  - Staff cannot approve/reject any request (the RPC immediately raises `42501` exception if caller is not owner).
  - Staff profiles are read-only for other staff; only the profile owner and the launch owner can read/update permitted contact fields.
  - Unapproved accounts retain zero query access.
- **Privacy & Compliance**:
  - `leave_records` and `roster_requests` explicitly contain zero clinical diagnostic columns.
  - Audit logs record masked email addresses (`m***@...`) and operational reasons for every status transition.
- **Accessibility & Design Standards**:
  - All interactive elements adhere to WCAG 2.2 AA minimum touch target sizing (`>= 44x44` px).
  - Modal dialogs trap focus, respond to `Escape`, have visible `aria-labelledby` headings, and dismiss cleanly on backdrop click.
  - High-contrast visual cues (green/emerald for approved/active, amber for pending/invited, rose/red for rejected/suspended).

## Manual actions

For local verification on `http://localhost:5173/`:

1. Ensure the local Vite dev server is running (`npm run dev`).
2. Log in using your registered Google Account (`muhammadafif@upm.edu.my`).
3. **Verify Staff Directory Admin** (`/admin/staff`):
   - Check that the launch owner is listed as `MO-ADMIN` with `Active` status.
   - Click "Invite Staff Member" to open the accessible modal. Test creating a synthetic invited test user (e.g. `test.mo@example.com`).
   - Test updating allowlist status using the action buttons (`Suspend`, `Activate`).
4. **Verify Self-Service Profile** (`/profile/me`):
   - View your read-only operational identity card.
   - Edit your phone number or MMC registration number and click "Save Contact Details" to confirm RLS persistence.
5. **Verify Request Lifecycle** (`/requests` and `/admin/requests`):
   - Under `/requests`, click "Submit Request", choose a request type (e.g., `Annual Leave` or `Preferred OFF`), select dates, enter an operational reason, and submit.
   - Under `/admin/requests`, view the submitted request in the review inbox, open "Review & Decide", enter a decision reason, and click "Approve Request".
   - Return to `/requests` to verify the request status chip has transitioned to `Approved`.

## Known risks or incomplete items

- Historical shift roster data import from legacy Google Sheets is scheduled for the Migration Rehearsal phase.
- Core Roster Generation Engine, Shift Sequence Solvers, Policy-B Night Rules, and January 2027 draft workspace grid are scheduled for Wave D (`TASK-004`).

## Next recommended task

- **Wave D (`TASK-004`)**: Core Roster Engine, Shift Semantics & Sequences, Policy-B Night Shift Constraints, Weekly OFF (Mondays), January 2027 Draft Workspace Grid, and Atomic Publication Lifecycle.
