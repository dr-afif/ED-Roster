# Task Brief: TASK-003 Staff Directory, Allowlist Administration, Self-Service Profiles & Request Lifecycle (Wave C)

## Identity

- Task ID: TASK-003
- Workstream: Wave C — Canonical Data & Core Workforce Interactions
- Owner/agent: Antigravity
- Branch/worktree: `feat/wave-c-requests-directory`
- Dependencies: TASK-001 (Scaffold baseline), TASK-002 (Identity & RLS Foundation)
- Target Environment: Supabase Staging (`hgrutigkgnrcjhcjxabs`)
- Production impact: NONE (Zero production changes, zero production keys)

## Objective

Deliver the canonical database schemas, Row Level Security policies, typed query hooks, and accessible frontend interfaces for:

1. **Staff Directory & Google OAuth Allowlist Administration** (`/admin/staff`): Owner can invite new staff, activate/suspend/revoke allowlist entries, and link directory records.
2. **Self-Service Staff Profiles** (`/profile/me`): Staff can view operational directory identity and securely update permitted personal contact fields with strict self-or-owner RLS enforcement.
3. **Staff Roster Requests Lifecycle** (`/requests` and `/admin/requests`): Active staff can submit, review, and withdraw shift/leave requests within quota guidelines; Roster Administrator can review, filter, and approve/reject requests with structured reason tracking and append-only audit events.
4. **Professional Records & Types Catalog**: Schema foundation for credentials (e.g. APC, BLS, ACLS) and public holidays.

## User Value

- **For Roster Administrators (Owner)**: Centralized, auditable control over workforce identities and access rights; streamlined inbox for reviewing and approving staff roster requests before roster drafting begins.
- **For Medical Officers & Staff**: Frictionless self-service profile updates and request submission with instant feedback on status transitions, eliminating uncoordinated chat messages and unverified spreadsheet edits.

## In Scope

1. **Database Migration (`supabase/migrations/20261111100000_wave_c_requests_records_schema.sql`)**:
   - `public.request_types`: Configuration for request categories, constraints, and active flags.
   - `public.roster_requests`: Core request submission table with UUID public keys, status, dates, and notes.
   - `public.request_status_events`: Append-only transition history with actor, timestamp, and status tracking.
   - `public.leave_records`: Operational absence records without clinical diagnoses.
   - `public.record_type_definitions` & `public.professional_records`: Professional credential catalog.
   - `public.public_holidays`: Regional/national holiday calendar.
   - Helper RPCs & Triggers:
     - Automated status sync and transition trigger for `roster_requests` -> `request_status_events`.
     - Owner-only decision RPC or secured RLS update policies.
     - Prevent staff from approving their own requests or modifying other staff's records.
2. **Type Generation**:
   - Update `src/platform/supabase/database.types.ts` via Supabase MCP to match the staging schema.
3. **Frontend Features & Components**:
   - **Directory & Allowlist Admin (`src/features/directory`)**:
     - Real-time TanStack Query queries/mutations for `allowed_users` and `staff_directory`.
     - Filterable, searchable data grid of active, invited, and suspended accounts.
     - "Invite Staff Member" dialog with validation (email, name, role, staff group).
     - Account action drawer (Activate, Suspend, Revoke with mandatory reason).
   - **Self-Service Profile (`src/features/profiles`)**:
     - Contact details card with editable `full_name`, `phone`, `registration_number`.
     - Read-only operational summary badge (`staff_code`, `roster_name`, `staff_group`, `employment_status`).
     - Validation via React Hook Form and Zod schemas.
   - **Staff Requests Route (`src/features/requests/StaffRequestsRoute.tsx`)**:
     - Active requests table with status chips (`submitted`, `approved`, `rejected`, `withdrawn`).
     - "Submit Request" modal with dynamic request types, date range picker, and validation.
     - "Withdraw" action for pending submissions.
   - **Owner Requests Admin Route (`src/features/requests/AdminRequestsRoute.tsx`)**:
     - Filter by status (`all`, `submitted`, `approved`, `rejected`) and date range.
     - Decision dialog with structured operational reason input.
4. **Verification & Quality**:
   - TypeScript strict check (0 errors).
   - ESLint and Prettier formatting (0 errors).
   - Vitest unit, component, and RLS negative tests.
   - Secret & PII scanner passing.

## Non-Goals

- Roster engine rules execution, monthly draft grids, and cell solvers (deferred to Wave D).
- Drive PDF file uploads and private Telegram delivery (deferred to Wave E).
- Live Google Sheets bulk migration of historical 2024–2026 data (deferred to migration rehearsal).
- Clinical diagnoses or sensitive medical information storage (strictly forbidden).

## Allowed Files and Modules

```text
supabase/migrations/20261111100000_wave_c_requests_records_schema.sql
src/platform/supabase/database.types.ts
src/features/directory/*
src/features/profiles/*
src/features/requests/*
src/shared/ui/*
src/shared/forms/*
src/shared/validation/*
docs/tasks/TASK-003-requests-directory-profiles.md
docs/handoffs/HANDOFF-003-requests-directory-profiles.md
```

## Required Reading

- `MODULAR_APP_BLUEPRINT/AGENTS.md`
- `MODULAR_APP_BLUEPRINT/03_DATA_MODEL.md`
- `MODULAR_APP_BLUEPRINT/04_SECURITY_AUTHORIZATION.md`
- `MODULAR_APP_BLUEPRINT/08_FRONTEND_UX.md`
- `MODULAR_APP_BLUEPRINT/11_DELIVERY_ROADMAP.md`

## Security and Data Classification

- **User Roles Involved**:
  - `owner`: Full read/write management of directory, allowlist, requests, decisions, and credential types.
  - `staff`: Read directory; read/update own profile; create/read/withdraw own requests; read own professional records.
  - `unapproved`: 0 read access, 0 write access.
- **Personal/Sensitive Data Involved**:
  - Staff names, phone numbers, email addresses, MMC registration numbers.
  - Medical diagnoses strictly excluded from `leave_records` and `roster_requests`.
  - All emails masked in audit trails.
- **RLS/Secret Impact**:
  - RLS enabled on all newly exposed tables.
  - Update policies require both `USING` and `WITH CHECK`.
  - No secret keys in browser code.
- **Required Negative Authorization Tests**:
  - Staff cannot view or update another staff member's private profile.
  - Staff cannot approve or reject their own or another staff member's request.
  - Staff cannot invite or alter allowlist entries.
  - Suspended staff lose all query access immediately.

## Acceptance Criteria

1. [x] **Migration & Types**: Staging migration applies cleanly with zero advisor warnings (except documented `0029` patterns); TypeScript types regenerated and committed.
2. [x] **Staff & Allowlist Admin**: Owner can view the complete staff roster, invite new staff by Google email, and change allowlist status (active, suspended, revoked).
3. [x] **Self-Service Profile**: Authenticated staff can view their operational identity and update permitted contact details; updates persist in `staff_profiles` via RLS.
4. [x] **Request Submission**: Active staff can submit a request with start/end dates, request type, and operational notes; submission appears in their request history.
5. [x] **Request Decisions**: Owner can review pending requests, approve or reject with a reason, and status transitions are recorded in `request_status_events`.
6. [x] **Security Invariants**: Vitest tests confirm RLS boundaries and verify staff cannot approve requests or mutate unauthorized profiles.
7. [x] **Accessibility & Design Tokens**: UI components meet WCAG 2.2 AA contrast, visible focus rings, and minimum 44×44 px touch targets.
