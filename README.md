# RESQ Modular App (`ED-Roster`)

Emergency Department workforce operations application for roster planning, staff requests, professional records, editable typed operational policies, and controlled Google Drive document navigation.

> **Architecture Source of Truth**: Read [`MODULAR_APP_BLUEPRINT/README.md`](./MODULAR_APP_BLUEPRINT/README.md) and [`MODULAR_APP_BLUEPRINT/AGENTS.md`](./MODULAR_APP_BLUEPRINT/AGENTS.md) before modifying code, schemas, or workflows.

## Environment Separation (`ADR-006`)

- **Local / Staging (`hgrutigkgnrcjhcjxabs`)**: Configured via gitignored `.env.local` for application development, database/RLS iteration, auth testing, migration rehearsals, synthetic data, and UAT.
- **Production**: Reserved strictly for reviewed production releases with explicit owner approval. Never connect development servers, automated tests, or preview builds to production.
- **Browser Credentials**: Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_*`) are allowed in browser builds. Secret/service-role keys, Google credentials, and Telegram tokens remain server-side only.

## Local Setup

1. Install exact pinned dependencies:
   ```bash
   npm ci
   ```
2. Copy `.env.example` to `.env.local` (gitignored) and populate staging `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

## Verification Commands

| Command                | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run format:check` | Verify Prettier formatting                                         |
| `npm run lint`         | Run ESLint + architecture import boundary checks                   |
| `npm run typecheck`    | Run strict TypeScript project-reference check (`tsc -b`)           |
| `npm test`             | Run Vitest unit, architecture boundary, and Testing Library suites |
| `npm run build`        | Type-check and build production static bundle                      |
| `npm run test:e2e`     | Run Playwright end-to-end suite against preview server             |

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
  routes/                 Canonical route registration only
```
