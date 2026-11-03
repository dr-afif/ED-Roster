# Task Brief: Canonical Identity, Allowlist, RLS Foundation & Auth Bootstrap

## Identity

- Task ID: `TASK-002`
- Workstream: Security/database & App shell/authentication (Wave B)
- Owner/agent: Antigravity
- Branch/worktree: `feat/wave-b-identity`
- Dependencies: `TASK-001` (`ADR-007`), `ADR-001`, `ADR-006`, owner staging management connection (`hgrutigkgnrcjhcjxabs`), confirmed launch owner email (redacted from public repo), confirmed `2027-01-01` first native roster period
- Contract/migration versions: `20261103162000_wave_b_identity_rls_foundation.sql`

## Objective

Establish the canonical Postgres identity, allowlist, private profile, idempotency log, and append-only audit foundation on Supabase staging (`hgrutigkgnrcjhcjxabs`) with strict least-privilege Row Level Security, verified session bootstrap (`public.bootstrap_my_session()`), generated TypeScript database contracts, and browser Google OAuth PKCE sign-in, session persistence, unapproved-account rejection, and cache-clearing sign-out.

## User value

Enables the Emergency Department owner (and future approved staff) to authenticate securely with Google OAuth while guaranteeing at the Postgres RLS layer that anonymous and unapproved Google accounts read zero application rows, staff cannot read other staff members' personal profiles or tamper with verified credential fields, and privileged allowlist activations and edits are recorded in an append-only audit trail.

## In scope

- Create unexposed `private` and `legacy` schemas alongside exposed `public`, installing `citext` in schema `extensions`.
- Create canonical Wave B tables in `public` with `bigint generated always as identity` keys (where applicable), foreign-key indexes, normalization/invariant constraints, explicit least-privilege grants, and unified per-action RLS policies:
  - `public.staff_directory` (operational roster identity)
  - `public.allowed_users` (Google email allowlist, role `owner | staff`, status `invited | active | suspended | revoked`, single-owner launch partial unique index)
  - `public.staff_profiles` (private personal/contact fields separated from `staff_directory`, with trigger guard preventing non-owner mutation of identity/verification columns)
  - `public.operation_log` (idempotency & recovery log)
  - `public.audit_events` (append-only privileged event log with trigger blocking `UPDATE`/`DELETE` and owner-only `SELECT` RLS)
- Implement `private` `SECURITY DEFINER` RLS helpers (`set search_path = ''`, zero-argument `(select auth.uid())` evaluation, explicit `EXECUTE` grants, `REVOKE` from `PUBLIC`/`anon`):
  - `private.is_active_approved_user()`
  - `private.is_active_owner()`
  - `private.current_active_staff_id()`
  - `private.append_audit_event(...)`
- Implement `public.bootstrap_my_session()` RPC to validate the caller's confirmed `auth.users` email server-side, bind `auth_user_id` on invited unbound `allowed_users` (and linked `staff_profiles`), transition `invited -> active`, append an activation audit event, and return minimal session/role/directory context without trusting `user_metadata`.
- Apply migration to staging (`hgrutigkgnrcjhcjxabs`), seed the owner's email into staging `public.allowed_users` out-of-band (never committed to Git), run positive and negative SQL RLS verification across `anon`, unapproved `authenticated`, active `staff`, and active `owner`, and verify Supabase Security and Performance Advisors are clean.
- Generate `src/platform/supabase/database.types.ts` from staging (`hgrutigkgnrcjhcjxabs`).
- Upgrade `src/platform/auth` and `src/app` to support live Google OAuth PKCE sign-in (`signInWithOAuth`), `returnTo` route restoration (`ADR-007`), `bootstrap_my_session()` allowlist gating, unapproved/suspended/revoked denial screens with clean sign-out, owner UX route guard (`OwnerUxBoundary`), and explicit sign-out clearing both session state and TanStack Query caches.

## Non-goals

- Touching production Supabase (`bubvwijyaqfbugsaedxp`) in any way.
- Operational roster engine, shift definitions, roster periods/drafts/publications/amendments, or GOFF ledger tables (scheduled for Waves C–D).
- Request submission/review, professional record CRUD, Google Drive integration, PDF generation, Telegram delivery, or live Google Sheets migration imports.
- Committing real staff/owner email addresses or personal data to the public repository.

## Allowed files/modules

- Blueprint & task docs: `MODULAR_APP_BLUEPRINT/14_DECISIONS_OPEN_QUESTIONS.md`, `MODULAR_APP_BLUEPRINT/project-manifest.yaml`, `docs/tasks/TASK-002-identity-rls-foundation.md`, `docs/handoffs/HANDOFF-002-identity-rls-foundation.md`
- Database migrations & SQL verification tests: `supabase/migrations/20261103162000_wave_b_identity_rls_foundation.sql`, `supabase/tests/wave_b_rls_verification.sql`
- Frontend platform/app/dashboard updates & tests: `src/platform/supabase/database.types.ts`, `src/platform/auth/**`, `src/platform/query/**`, `src/app/**`, `src/features/dashboard/DashboardRoute.tsx`, `src/__tests__/architecture-boundaries.test.ts`

## Required reading

- `MODULAR_APP_BLUEPRINT/AGENTS.md`
- `MODULAR_APP_BLUEPRINT/03_DATA_MODEL.md`
- `MODULAR_APP_BLUEPRINT/04_SECURITY_AUTHORIZATION.md`
- `MODULAR_APP_BLUEPRINT/08_FRONTEND_UX.md`
- `MODULAR_APP_BLUEPRINT/10_TESTING_ACCEPTANCE.md`
- `MODULAR_APP_BLUEPRINT/decisions/ADR-006-separate-supabase-environments.md`
- `MODULAR_APP_BLUEPRINT/decisions/ADR-007-github-pages-routing-strategy.md`

## Security and data classification

- User roles involved: `anonymous`, `authenticated` (unapproved / suspended / revoked), active `staff`, active `owner`.
- Personal/sensitive data involved: Synthetic emails/names in tests only; staging `allowed_users` receives the owner's email out-of-band via SQL execution without repository tracking. Audit summaries mask email addresses rather than logging full PII.
- RLS/secret/integration impact: Every `public` table enforces RLS with zero `USING (true)` policies and zero `user_metadata` authorization reads. `private` and `legacy` remain unexposed to PostgREST.
- Required negative authorization tests:
  - `anon` receives zero rows and permission/RLS denial on writes across all `public` tables and cannot execute `bootstrap_my_session()` or `private.*` helpers.
  - Authenticated unapproved user receives `access_status = 'unapproved'` from `bootstrap_my_session()` and reads/mutates zero rows across `allowed_users`, `staff_directory`, `staff_profiles`, `operation_log`, and `audit_events`.
  - Suspended or revoked user loses table read/write access immediately even with an unexpired JWT.
  - Active `staff` cannot read other staff rows in `allowed_users` or `staff_profiles`, cannot read `audit_events`, cannot mutate `staff_directory` or `allowed_users`, and cannot alter protected identity/verification columns (`registration_number`, `verification_status`, `email`, `full_name`, `auth_user_id`) on their own `staff_profiles` row.
  - Even active `owner` cannot `UPDATE` or `DELETE` rows in `public.audit_events`, and cannot create a second active/invited `owner` at launch.

## Contracts

- **Database Tables (`public`)**: `staff_directory`, `allowed_users`, `staff_profiles`, `operation_log`, `audit_events`.
- **RPC (`public.bootstrap_my_session()`)**:
  - Args: none.
  - Returns table row: `{ access_status: 'unauthenticated' | 'active' | 'unapproved' | 'suspended' | 'revoked', role: 'owner' | 'staff' | null, staff_id: number | null, staff_code: string | null, display_name: string | null, roster_name: string | null }`.
- **Frontend Auth Boundary (`AuthBoundaryState`)**:
  - States: `loading`, `unauthenticated`, `unapproved` (covering `unapproved | suspended | revoked` with specific reason code), `authenticated` (with verified `role`, `userId`, `staffId`, `displayName`), `error` (recoverable bootstrap/OAuth failure).
  - Actions: `signInWithGoogle(returnToPath?)`, `signOut()`, `retryBootstrap()`.

## Acceptance criteria

- [ ] Given a clean staging database (`hgrutigkgnrcjhcjxabs`), when `20261103162000_wave_b_identity_rls_foundation.sql` applies, then all schemas, tables, indexes, triggers, grants, RLS policies, and `bootstrap_my_session()` are created cleanly and Supabase Security + Performance Advisors report zero warnings/errors.
- [ ] Given an invited unbound user in `public.allowed_users` whose confirmed `auth.users` email matches (case-insensitively), when `public.bootstrap_my_session()` runs as that authenticated user, then `auth_user_id` binds atomically, `status` becomes `active`, an `allowlist.activated` row is appended to `public.audit_events`, and the RPC returns `access_status = 'active'` with the user's role.
- [ ] Given an anonymous caller, an authenticated unapproved Google account, or a suspended/revoked user, when querying or mutating any `public` table or calling `bootstrap_my_session()`, then zero application rows are returned and the UI renders an explicit access-not-approved/sign-in gate and clears session + query cache on sign-out.
- [ ] Given an active `staff` user, when reading shared directory vs. private profiles, then active `staff_directory` rows and their own `staff_profiles` row are readable, other staff members' `staff_profiles` and `audit_events` return zero rows, and attempts to self-edit `verification_status` or `registration_number` fail with `42501`.
- [ ] Given keyboard and mobile (375 px) navigation, when interacting with the sign-in screen, unapproved-access gate, owner route guard, and shell session controls, then focus indicators, semantic landmarks/alerts, and `>= 44x44` px touch targets pass automated tests.

## Required tests

- Unit:
  - OAuth callback/return-path sanitization and auth state mapping (`src/platform/auth/__tests__/oauthCallbackGuard.test.ts`).
  - Architecture boundary & public-repo PII/secret hygiene checks (`src/__tests__/architecture-boundaries.test.ts`).
- Database/RLS:
  - Transactional SQL verification suite (`supabase/tests/wave_b_rls_verification.sql`) executed against staging Postgres (`hgrutigkgnrcjhcjxabs`) covering `anon`, unapproved `authenticated`, active `staff`, active `owner`, single-owner constraint, profile column protection, suspended/revoked immediate denial, and append-only `audit_events`.
- Component:
  - `AuthProvider` + `AuthGate` + `OwnerUxBoundary` + `AppShell` tests (`src/platform/auth/__tests__/AuthBoundary.test.tsx`, `src/app/__tests__/AppShell.test.tsx`) covering loading, unauthenticated Google OAuth trigger + `returnTo` storage, approved `owner` vs. `staff` UX boundaries, unapproved account denial + sign-out, OAuth callback error recovery, and TanStack Query cache clearing on sign-out.
- E2E/integration:
  - Generated TypeScript types verified against live staging schema; build + CI checks green.

## Migration and rollback impact

- Additive initial foundation migration (`20261103162000_wave_b_identity_rls_foundation.sql`) applied only to staging (`hgrutigkgnrcjhcjxabs`).
- Production (`bubvwijyaqfbugsaedxp`) is untouched.
- If rollback is ever required in staging prior to Wave C tables, dropping `public.bootstrap_my_session`, the 5 Wave B `public` tables, and `private`/`legacy` helpers cleanly restores an empty staging schema.

## Handoff expectation

- Next workstream: **Wave C — Staff Directory/Allowlist Admin UI, Self-Service Profiles, Requests & Legacy Identity Rehearsal** (or owner live Google OAuth login smoke test in staging once Google OAuth provider & redirect URLs are toggled in the Supabase Staging Dashboard).
- Handoff will document applied migration version, RLS test matrix results, advisor results, manual Supabase Dashboard Auth checklist (Google provider + Redirect URLs), and remaining owner inputs for Wave C.
