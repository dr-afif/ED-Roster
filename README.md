# RESQ Modular App (`ED-Roster`)

Emergency Department workforce operations application for **Hospital Sultan Abdul Aziz Shah (HSAAS)** — built as a modular React + TypeScript + Supabase SPA for roster planning, MO shift requests, rules-engine validation, professional records, Telegram notifications, and immutable PDF/Google Drive archiving.

> **Architecture Source of Truth**: Read [`MODULAR_APP_BLUEPRINT/README.md`](./MODULAR_APP_BLUEPRINT/README.md) and [`MODULAR_APP_BLUEPRINT/AGENTS.md`](./MODULAR_APP_BLUEPRINT/AGENTS.md) before modifying code, schemas, or workflows.

---

## Key Features & Capabilities

### 1. Roster Planning, Rules Engine & Lifecycle (`/rosters/:yyyy/:mm`)

- **Interactive Roster Grid & Calendar Views**: Build and inspect monthly MO schedules with a dedicated shift picker (`ShiftPickerModal`) and live daily/monthly staffing **Tally Tables** (`RosterTallyTables`).
- **Automated Rules Engine & Guidance Modal**: Real-time validation across staffing minimums, shift sequences, weekly OFFs, and replacement **GOFF** tracking (including multi-week and cross-month carry-forward replacement OFFs), with a dedicated **Rules Guidance Modal** (`RulesGuidanceModal`) for sorting, grouping, and filtering errors, warnings, and informational notices by staff, date, or rule.
- **Controlled Lifecycle & Amendments**: Full publish (`PublishModal`), post-publish amendment (`AmendRosterModal`) with change history (`AmendmentHistoryList`), and close/reconcile (`CloseReconcileModal`) workflows.
- **Immutable PDF Snapshots & Google Drive Archiving**: Generate formatted roster PDFs (`pdf-lib` / `docxtemplater`) via `RosterExportModal` and archive versioned snapshots to Google Drive (`archive-roster-snapshot` Edge Function).

### 2. Telegram Notifications & Broadcasts

- **Preview-Before-Send Modals** (`TelegramNotifyModal`):
  - **Roster Published Broadcast**: Preview and send publication announcements when a monthly roster goes live.
  - **Amendment Update Selector**: Review, select, and edit individual Telegram update messages for affected MOs before sending — preventing notification spam while multiple roster adjustments are still in progress.
- **Private Owner PDF Delivery**: Send archived roster PDFs directly to the owner's private Telegram chat (`send-snapshot-telegram` Edge Function), alongside staff notifications (`send-staff-telegram`) and webhook handling (`telegram-webhook`).

### 3. Shift Requests & Cutoff Governance (`/requests`, `/admin/requests`)

- **MO Self-Service Request Portal**: Calendar, table, and list views for submitting, editing, and managing monthly shift/off requests (`AM`, `PM`, `ON1`, `OFF`, `GHKA`, `COURSE`, etc.) with fair-queue preservation and replacement confirmation prompts.
- **Configurable Quotas**: Server- and client-enforced monthly limits, weekend limits, daily `ON1` caps, and shared daily `OFF`-group caps (`OFF` + `GHKA` + `COURSE`).
- **Automated Monthly Cutoff & Emergency Override**:
  - Persisted in Supabase (`rule_versions.config`) and enforced both in the UI and server-side inside `public.submit_roster_request(...)` using `Asia/Kuala_Lumpur` time.
  - Automatically closes non-owner submissions after the configured `cutoffDay` (1–28).
  - Supports **early manual closing** before the cutoff date and a **month-scoped emergency override** (`request_window_override_month`) so admins can temporarily reopen submissions after the cutoff date without changing the cutoff day, automatically expiring on the next month.

### 4. Professional Records, PH Tracker & Documents

- **Professional Records & Public Holidays (`/records`, `/holidays`, `/ph-tracker`)**: Track MO professional records and Public Holiday (PH) / replacement off entitlements.
- **Department Documents (`/documents`)**: Controlled Google Drive document catalog backed by searchable metadata in Supabase.
- **Updates & Personal Profile (`/updates`, `/profile/me`)**: Department announcements feed and MO profile view.

### 5. Owner Administration (`/admin/*`)

- **Staff & Accounts (`/admin/staff`)**: Manage the MO directory, roles, and Google OAuth email allowlist.
- **Rules & Policies (`/admin/rules`)**: Edit and version operational rule configurations (`rule_versions`).
- **Department Settings (`/admin/settings`)**: Configure department/hospital identity, monthly request cutoff day, manual window toggle & post-cutoff emergency override, and automation toggles (quotas, Telegram alerts, Google Drive sync).
- **Audit & Recovery (`/admin/audit`)**: Inspect audit trails for roster amendments and administrative actions.
- **Sheets Migration (`/admin/migration`)**: Import and reconcile historical Google Sheets data into Supabase.

---

## Tech Stack

- **Frontend**: React 19, TypeScript 5.9, Vite 8, Tailwind CSS 4, React Router 7 (`HashRouter`, `ADR-007`), TanStack Query 5, React Hook Form + Zod 4, Lucide Icons
- **Documents & Exports**: `pdf-lib`, `docxtemplater`, `pizzip`
- **Backend**: Supabase (Postgres, Row Level Security, Google OAuth PKCE, Edge Functions)
- **Testing & Quality**: Vitest, Testing Library, Playwright, ESLint, Prettier

---

## Environment Separation (`ADR-006`)

- **Local / Staging (`hgrutigkgnrcjhcjxabs`)**: Configured via gitignored `.env.local` for application development, database/RLS iteration, auth testing, migration rehearsals, synthetic data, and UAT.
- **Production**: Reserved strictly for reviewed production releases with explicit owner approval. Never connect development servers, automated tests, or preview builds to production.
- **Browser Credentials**: Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_*`) are allowed in browser builds. Secret/service-role keys, Google credentials, and Telegram tokens remain server-side only.

---

## Local Setup

1. Install exact pinned dependencies (Node.js `>=22.0.0`):
   ```bash
   npm ci
   ```
2. Copy `.env.example` to `.env.local` (gitignored) and populate staging `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

---

## Verification Commands

| Command                | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run format:check` | Verify Prettier formatting                                         |
| `npm run lint`         | Run ESLint + architecture import boundary checks                   |
| `npm run typecheck`    | Run strict TypeScript project-reference check (`tsc -b`)           |
| `npm test`             | Run Vitest unit, architecture boundary, and Testing Library suites |
| `npm run build`        | Type-check and build production static bundle                      |
| `npm run test:e2e`     | Run Playwright end-to-end suite against preview server             |

---

## Module Structure

```text
src/
  app/                    App composition, HashRouter factory (ADR-007), AppShell, ErrorBoundary, tokens
  platform/
    auth/                 OAuth PKCE callback helpers, UX-only session/owner boundaries
    query/                TanStack Query client and canonical query key hierarchy
    supabase/             Fail-closed env validator, PKCE client wrapper, provider boundary
    telemetry/            Privacy-safe diagnostic logger and correlation IDs
  shared/
    ui/                   Semantic frosted-glass and solid surface primitives (WCAG 2.2 AA)
    forms/                React Hook Form + Zod blur/submit adapters
    dates/                Asia/Kuala_Lumpur calendar and period helpers
    validation/           Shared Zod schemas
    types/                Cross-feature error envelope and primitive contracts
  features/               Isolated domain/feature modules exporting minimal index.ts APIs
    audit/                Owner audit & recovery logs
    dashboard/            Operations home dashboard
    directory/            MO directory & allowlist administration
    documents/            Controlled Google Drive document catalog
    migration/            Historical Google Sheets import & reconciliation
    professional-records/ Professional records & PH tracker
    profiles/             Personal MO profile
    public-holidays/      Public holiday data & tracking
    requests/             MO shift requests, quotas, and cutoff enforcement
    rosters/              Roster grid/calendar, rules engine, PDF export, Telegram notify
    rules/                Versioned operational rule policies
    settings/             Department settings, cutoff day & manual window override
    updates/              Department announcements & updates
  routes/                 Canonical lazy-loaded route registration only
supabase/
  functions/              Edge Functions (archive-roster-snapshot, send-snapshot-telegram, send-staff-telegram, telegram-webhook)
  migrations/             Postgres schema, RLS policies, and RPC migrations
```
