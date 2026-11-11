# Handoff: Wave B — Canonical Identity, Allowlist, RLS Foundation & Auth Bootstrap

## Outcome

Supabase Staging (`hgrutigkgnrcjhcjxabs`) now hosts the complete Wave B identity, allowlist, private profile, idempotency log, and append-only audit foundation. Postgres Row Level Security and server-side RPC functions enforce strict zero-anonymous access, single-owner launch invariants, and verified allowlist binding based on `auth.users` confirmed emails (never trusting user-editable `user_metadata`). The frontend SPA is upgraded with Google OAuth PKCE authentication, accessible loading/sign-in/unapproved screens, owner UX administration guards, and session cache invalidation on sign-out.

The launch owner Google email was confirmed by the owner and seeded directly into staging `public.allowed_users` out-of-band (redacted from all repository commits and test files). Staging project reference: `hgrutigkgnrcjhcjxabs`. Production project (`bubvwijyaqfbugsaedxp`) remains untouched.

## Changed artifacts

- **Branch**: `feat/wave-b-identity`
- **Database Migration**:
  - `supabase/migrations/20261103162000_wave_b_identity_rls_foundation.sql` (applied to staging `hgrutigkgnrcjhcjxabs`)
- **SQL Verification Suite**:
  - `supabase/tests/wave_b_rls_verification.sql`
- **TypeScript Database Contracts**:
  - `src/platform/supabase/database.types.ts` (generated from staging PostgREST schema)
- **Frontend Platform & Shell**:
  - `src/platform/auth/authContext.ts`
  - `src/platform/auth/AuthProvider.tsx`
  - `src/platform/auth/AuthScreens.tsx`
  - `src/platform/auth/OwnerUxBoundary.tsx`
  - `src/platform/auth/index.ts`
  - `src/app/App.tsx`
  - `src/app/AppShell.tsx`
  - `src/features/dashboard/DashboardRoute.tsx`
- **Tests**:
  - `src/platform/auth/__tests__/AuthBoundary.test.tsx`
  - `src/app/__tests__/AppShell.test.tsx`
  - `src/__tests__/architecture-boundaries.test.ts`
- **Blueprint & Tasks**:
  - `MODULAR_APP_BLUEPRINT/14_DECISIONS_OPEN_QUESTIONS.md` (recorded D-015; updated BLOCKS FOUNDATION items)
  - `MODULAR_APP_BLUEPRINT/project-manifest.yaml` (updated staging connection status and open inputs)
  - `docs/tasks/TASK-002-identity-rls-foundation.md`
  - `docs/handoffs/HANDOFF-002-identity-rls-foundation.md`

## Contracts added or changed

- **Database Schemas & Tables (`public`)**:
  - `public.staff_directory`: operational staff identity (`id bigint generated always as identity primary key`, `staff_code text unique not null`, `roster_name`, `display_name`, `staff_group`, `employment_status`, `active boolean`, audit columns).
  - `public.allowed_users`: Google email allowlist (`id bigint generated always as identity primary key`, `email extensions.citext unique not null`, `auth_user_id uuid unique null references auth.users(id)`, `role text check (role in ('owner','staff'))`, `status text check (status in ('invited','active','suspended','revoked'))`, `staff_id bigint null references staff_directory(id)`, single-owner launch partial unique index, audit columns).
  - `public.staff_profiles`: private contact details (`staff_id bigint primary key references staff_directory(id)`, `auth_user_id uuid unique null`, `full_name`, `email extensions.citext`, `phone`, `registration_number`, `verification_status`). Guard trigger blocks staff self-service mutation of verification or identity columns.
  - `public.operation_log`: idempotency tracking (`operation_id uuid unique not null`, `command_type`, `actor_auth_user_id`, `request_hash`, `status`, `result_ref`, `error_code`, `error_message`).
  - `public.audit_events`: immutable append-only audit trail (`id bigint generated always as identity primary key`, `actor_auth_user_id`, `actor_staff_id`, `action`, `entity_type`, `entity_id`, `operation_id`, `before_summary`, `after_summary`, `reason`). Trigger unconditionally raises `42501` on `UPDATE` or `DELETE`.
- **Database Functions (`public` & `private`)**:
  - `public.bootstrap_my_session()`: `SECURITY DEFINER` function callable by `authenticated` to verify caller's confirmed email from `auth.users`, bind invited unbound `allowed_users` rows, transition `status` to `active`, append an audit record, and return minimal session/role context.
  - `private.is_active_approved_user()`: helper for RLS policies checking if `(select auth.uid())` is active in `public.allowed_users`.
  - `private.is_active_owner()`: helper checking if caller is active owner.
  - `private.current_active_staff_id()`: helper returning linked `staff_id`.
  - `private.append_audit_event(...)`: helper logging privileged actions.
- **Frontend Auth Types (`AuthBoundaryState`)**:
  - `status`: `'loading' | 'unauthenticated' | 'unapproved' | 'authenticated' | 'error'`
  - `user`: `AuthenticatedUserContext` (`authUserId`, `email`, `role`, `staffId`, `staffCode`, `displayName`, `rosterName`)
  - `signInWithGoogle(returnToPath?)`: initiates PKCE Google OAuth with return path in `sessionStorage`
  - `signOut()`: signs out of Supabase Auth, removes stored return path, and invalidates TanStack Query cache

## Verification evidence

| Check                        | Command/test                                                          | Result                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Migration apply              | `apply_migration(hgrutigkgnrcjhcjxabs)`                               | Applied cleanly: 5 tables, schemas `private`/`legacy`, triggers, RLS policies, indexes                                          |
| Database security advisor    | `get_advisors(project_id: hgrutigkgnrcjhcjxabs, type: 'security')`    | Clean except intentional `0029` finding on `bootstrap_my_session()` (documented & verified per Supabase advisor guide Option 3) |
| Database performance advisor | `get_advisors(project_id: hgrutigkgnrcjhcjxabs, type: 'performance')` | Clean (all FKs and RLS columns indexed; informational `unused_index` notes on fresh tables)                                     |
| Type generation              | `generate_typescript_types(hgrutigkgnrcjhcjxabs)`                     | Generated 448 lines matching staging PostgREST contract                                                                         |
| TypeScript check             | `npm run typecheck`                                                   | Passed (0 errors)                                                                                                               |
| Formatting check             | `npm run format:check`                                                | Passed                                                                                                                          |
| Lint                         | `npm run lint`                                                        | Passed (0 errors, 0 warnings)                                                                                                   |
| Unit & component tests       | `npm test`                                                            | Passed: 8 test suites, 31 tests passing                                                                                         |
| Production build             | `npm run build`                                                       | Passed: 0 build errors                                                                                                          |
| Secret/PII scanning          | `architecture-boundaries.test.ts`                                     | Passed: zero production secrets, zero real personal emails committed                                                            |

## Security/accessibility review

- **Authorization denial checked**: Verified that `anon` has zero table grants, unapproved accounts are rejected by `bootstrap_my_session()` and RLS, suspended/revoked users lose table access immediately, and staff cannot read or alter other staff profiles or audit logs.
- **Secrets/logging checked**: All personal email addresses in audit events are masked (`m***@...`). Zero hard-coded project URLs, secret keys, or real emails in tracked files.
- **Keyboard/contrast/mobile checked**: All sign-in and sign-out controls have `>= 44x44` px touch targets, visible focus indicators, semantic headings and ARIA alerts.

## Manual actions

For the product owner in the [Supabase Staging Dashboard](https://supabase.com/dashboard/project/hgrutigkgnrcjhcjxabs):

1. **Google OAuth Provider**:
   Under **Authentication -> Providers -> Google**, ensure Google provider is enabled with your Google Cloud Web OAuth Client ID & Client Secret.
2. **Redirect URLs**:
   Under **Authentication -> URL Configuration**:
   - **Site URL**: `http://localhost:5173/` (for local development)
   - **Redirect URLs**:
     - `http://localhost:5173/`
     - `https://dr-afif.github.io/ED-Roster/`

## Known risks or incomplete items

- Operational roster planning, shift templates, roster periods/drafts, and GOFF ledger tables are scheduled for Waves C–D.
- Initial staff email list and identity mapping source for legacy data are pending owner input for Wave C.

## Next recommended task

- **Wave C (`TASK-003`)**: Staff Directory & Allowlist Administration UI (Owner can invite, activate, suspend, and link staff), Self-Service Profile view/edit, Request Submission/Review lifecycle, and first Legacy Sheets Identity Rehearsal.
