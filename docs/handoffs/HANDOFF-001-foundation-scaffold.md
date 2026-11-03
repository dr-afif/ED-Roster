# Handoff: Foundation Scaffold and App Shell Architecture (TASK-001)

## Outcome

The RESQ Modular App (`ED-Roster`) Wave A frontend foundation is scaffolded at the repository root using Vite, React 19, and strict TypeScript while preserving all 30 baseline files in `MODULAR_APP_BLUEPRINT/` byte-for-byte.

User-observable outcomes now verified:

- Responsive, accessible application shell with skip-to-main-content focus link, collapsible desktop sidebar (persisted in `resq.ui.v1.sidebarCollapsed`), non-production staging environment badge, and 5-destination mobile bottom navigation (`Home`, `Roster`, `Requests`, `Records`, `More` accessible modal sheet).
- Restrained frosted-glass surfaces (`surface-frosted` with opaque fallback) on navigation, summary cards, and sheets, paired with solid white surfaces (`surface-opaque`) on tables, forms, and dense operational areas, plus reduced-motion support and WCAG 2.2 AA semantic color tokens.
- Canonical placeholder routes (`08_FRONTEND_UX.md`) wired with native React Router v7 route-level code splitting and modular `src/features/*` public `index.ts` boundaries.
- Fail-closed Supabase environment validator (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) resolving `.env.local` locally to staging (`hgrutigkgnrcjhcjxabs`), rejecting missing/malformed/placeholder values, rejecting `sb_secret_*` and `service_role` keys, and blocking production mode during tests and local development.
- Proposed `ADR-007` documenting GitHub Pages `HashRouter` + Supabase Auth PKCE (`flowType: 'pkce'`) + parameterized `VITE_BASE_PATH`.

## Changed artifacts

- **Files created**:
  - Architecture & task docs:
    - `MODULAR_APP_BLUEPRINT/decisions/ADR-007-github-pages-routing-strategy.md` (Status: Accepted)
    - `docs/tasks/TASK-001-foundation-scaffold.md`
    - `docs/handoffs/HANDOFF-001-foundation-scaffold.md`
    - `README.md`
  - Root tooling & CI:
    - `package.json`, `package-lock.json`, `.npmrc`, `index.html`, `public/favicon.svg`
    - `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`
    - `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
    - `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.env.example`, `.gitignore` (updated ignore rules)
    - `.github/workflows/ci.yml`
  - Application & platform modules:
    - `src/main.tsx`, `src/app/App.tsx`, `src/app/AppErrorBoundary.tsx`, `src/app/AppShell.tsx`, `src/app/router.tsx`, `src/app/styles.css`
    - `src/platform/supabase/{env.ts,client.ts,database.types.ts,supabaseContext.ts,SupabaseProvider.tsx,index.ts}`
    - `src/platform/auth/{oauthCallbackGuard.ts,authContext.ts,AuthProvider.tsx,OwnerUxBoundary.tsx,index.ts}`
    - `src/platform/query/{queryClient.ts,queryKeys.ts,QueryProvider.tsx,index.ts}`
    - `src/platform/telemetry/{logger.ts,index.ts}`
    - `src/shared/types/{errors.ts,domain.ts,index.ts}`
    - `src/shared/dates/{malaysiaDate.ts,index.ts}`
    - `src/shared/validation/{schemas.ts,index.ts}`
    - `src/shared/forms/{useZodForm.ts,FormField.tsx,index.ts}`
    - `src/shared/ui/{SurfaceCard.tsx,StatusBadge.tsx,Button.tsx,PageHeader.tsx,SaveStatusBar.tsx,ModulePlaceholderPanel.tsx,index.ts}`
    - `src/features/{dashboard,rosters,requests,profiles,professional-records,documents,updates,directory,rules,settings,audit,migration}/**`
    - `src/routes/{NotFoundRoute.tsx,routeRegistry.tsx,index.ts}`
  - Tests:
    - `src/test/setup.ts`
    - `src/__tests__/architecture-boundaries.test.ts`
    - `src/platform/supabase/__tests__/env.test.ts`
    - `src/platform/auth/__tests__/oauthCallbackGuard.test.ts`
    - `src/platform/telemetry/__tests__/logger.test.ts`
    - `src/shared/dates/__tests__/malaysiaDate.test.ts`
    - `src/shared/forms/__tests__/FormField.test.tsx`
    - `src/app/__tests__/AppShell.test.tsx`
    - `e2e/smoke.spec.ts`
- **Migrations**: None (deferred to separately approved Wave B schema/RLS foundation task).
- **Edge Functions**: None.
- **Configuration & Pinned Dependency Versions**:
  - Runtime dependencies (exact pinned):
    - `react`: `19.3.1`
    - `react-dom`: `19.3.1`
    - `react-router-dom`: `7.18.5`
    - `@supabase/supabase-js`: `2.118.0`
    - `@tanstack/react-query`: `5.105.3`
    - `react-hook-form`: `7.91.0`
    - `@hookform/resolvers`: `7.0.1`
    - `zod`: `4.6.7`
    - `lucide-react`: `1.66.0`
  - Development dependencies (exact pinned):
    - `typescript`: `5.9.3`
    - `vite`: `8.3.5`
    - `@vitejs/plugin-react`: `6.2.1`
    - `tailwindcss`: `4.3.4`
    - `@tailwindcss/vite`: `4.3.4`
    - `vitest`: `5.1.0`
    - `jsdom`: `30.1.3`
    - `@testing-library/react`: `16.3.3`
    - `@testing-library/dom`: `10.4.2`
    - `@testing-library/jest-dom`: `7.0.1`
    - `@testing-library/user-event`: `14.6.8`
    - `eslint`: `10.14.0`
    - `@eslint/js`: `10.0.1`
    - `typescript-eslint`: `8.72.1`
    - `eslint-plugin-react-hooks`: `7.1.1`
    - `eslint-plugin-react-refresh`: `0.5.7`
    - `eslint-config-prettier`: `10.1.8`
    - `globals`: `17.14.0`
    - `prettier`: `3.9.10`
    - `@playwright/test`: `1.64.1`
    - `@types/node`: `22.20.5`
    - `@types/react`: `19.3.0`
    - `@types/react-dom`: `19.3.0`

## Contracts added or changed

- **Database/RPC**: None created yet; `src/platform/supabase/database.types.ts` defines an empty typed `Database` placeholder awaiting Wave B CLI generation.
- **TypeScript/DTO**:
  - `AppError` (`src/shared/types/errors.ts`) matching `02_TARGET_ARCHITECTURE.md`.
  - `ValidatedSupabaseEnv` and `PublicSupabaseMetadata` (`src/platform/supabase/env.ts`).
  - `queryKeys` hierarchy (`src/platform/query/queryKeys.ts`).
  - `OAuthCallbackInspection` and `sanitizeReturnToPath` (`src/platform/auth/oauthCallbackGuard.ts`).
- **Route/UI**:
  - `ADR-007` (Proposed): `createHashRouter` + Supabase PKCE (`flowType: 'pkce'`) + `VITE_BASE_PATH` normalization (`/` or `/ED-Roster/`).
  - Canonical route paths registered in `src/routes/routeRegistry.tsx`: `/`, `/rosters/:yyyy/:mm`, `/requests`, `/profile/me`, `/records`, `/documents`, `/updates`, `/admin/staff`, `/admin/requests`, `/admin/rules`, `/admin/settings`, `/admin/audit`, `/admin/migration`.
- **Error codes/events**:
  - `EnvironmentConfigurationError` (fail-closed startup screen `role="alert"` when browser env vars are missing/malformed).
  - `UNHANDLED_UI_ERROR` diagnostic log envelope with sensitive-field redaction (`src/platform/telemetry/logger.ts`).

## Verification evidence

| Check                            | Command/test                                      | Result                                                                                                 |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Dependency install & lockfile    | `npm install` (`.npmrc` `save-exact=true`)        | Passed (`package-lock.json` generated; exact versions pinned)                                          |
| Formatting check                 | `npm run format:check`                            | Passed (`All matched files use Prettier code style!`)                                                  |
| Lint & boundary rules            | `npm run lint`                                    | Passed (0 errors, 0 warnings)                                                                          |
| Strict TypeScript                | `npm run typecheck`                               | Passed (`tsc -b --pretty false` exited 0)                                                              |
| Unit, boundary & UI tests        | `npm test`                                        | Passed (7 test files, 24 tests passed)                                                                 |
| Production build (`/ED-Roster/`) | `VITE_BASE_PATH=/ED-Roster/ npm run build`        | Passed (emits `/ED-Roster/assets/...` chunks cleanly; 0 chunk warnings)                                |
| Production build (default `/`)   | `npm run build`                                   | Passed (initial shell JS `~37 kB` / `~10.5 kB` gzip; route chunks lazy-split)                          |
| `.env.local` & `dist/` gitignore | `git check-ignore -v .env.local dist/`            | Confirmed ignored (`.gitignore:9:.env.*`, `.gitignore:3:dist/`)                                        |
| Local staging resolution         | `env.test.ts` + `.env.local` inspection           | Confirmed `VITE_SUPABASE_URL` resolves to staging (`hgrutigkgnrcjhcjxabs`); no production URL selected |
| Blueprint preservation           | 30-file SHA-256 comparison against reference copy | Passed (0 mismatches across all 30 original blueprint files)                                           |
| Secret & prod-ref scan           | Source and `dist/` pattern scan                   | Passed (0 secrets, 0 personal data, 0 production project refs in `src/` or `dist/`)                    |

## Security/accessibility review

- **Authorization denial checked**:
  - `env.test.ts` verifies `sb_secret_*` keys and `service_role` JWTs are rejected immediately without echoing secret strings in error messages, and `VITE_APP_ENV=production` is rejected in tests and dev mode.
  - `oauthCallbackGuard.test.ts` verifies external/protocol-relative return paths (`//...`, `https://...`, `javascript:...`) are rejected to prevent open redirects.
  - `OwnerUxBoundary` explicitly labels client-side admin routes as UX-only and never inspects `user_metadata`.
- **Secrets/logging checked**:
  - `.env.local` is gitignored and never printed; `.env.example` contains placeholders only; `logger.test.ts` verifies recursive redaction of `token`, `secret`, `key`, `email`, and `phone` fields.
- **Keyboard/contrast/mobile checked**:
  - WCAG 2.2 AA contrast-verified semantic tokens in `src/app/styles.css`; state badges always pair Lucide SVG icon + text label (zero structural emoji).
  - Skip link focuses `#main-content` without clobbering `HashRouter` URL hashes (`AppShell.test.tsx`).
  - Minimum `44x44` CSS px (`min-h-11 min-w-11`) touch targets on interactive controls, 5-item mobile bottom navigation, focus-trapped `More` dialog with `Escape` close, browser zoom enabled in `index.html`, and `@media (prefers-reduced-motion: reduce)` transitions disabled.

## Manual actions

1. **Review & approve initial Git commit**: Approved by owner on 2026-11-03 ("commit and push to main").
2. **Review `ADR-007`**: Accepted by owner on 2026-11-03 (Option A: HashRouter + Supabase PKCE).
3. **Resolve `BLOCKS FOUNDATION` owner inputs (`14_DECISIONS_OPEN_QUESTIONS.md`) before Wave B**:
   - Add approved Supabase management accounts/tool connections for staging (`hgrutigkgnrcjhcjxabs`).
   - Confirm exact owner Google email and initial approved staff email list / identity mapping source.
   - Provide source Google Sheets spreadsheet IDs and authoritative tab inventory.
   - Confirm Google Drive model (organization Shared Drive + service account vs. dedicated Workspace user OAuth).
   - Confirm `2027-01-01` as the first Supabase-native roster period.

## Known risks or incomplete items

- **Prompt commit conflict (stopped safely)**: `git commit` was withheld per the explicit Restriction (_"Do not push, deploy, commit or change GitHub repository settings without my explicit approval"_).
- **Node engine advisory on `jsdom@30.1.3`**: Local Node is `v22.20.0` while `jsdom@30.1.3` declares `^22.22.2 || ^24.15.0 || >=26.0.0`; all 24 Vitest tests execute cleanly, and upgrading local Node to `>=22.22.2` (or CI's latest Node 22 LTS) removes the npm install warning.
- **Database & Auth unprovisioned by design**: No staging tables, RLS policies, or Google OAuth redirect allowlists were altered during this task.

## Next recommended task

- **TASK-002 (Wave B — Canonical Identity, Allowlist & RLS Security Foundation on Staging `hgrutigkgnrcjhcjxabs`)**:
  Once Supabase staging management access and `BLOCKS FOUNDATION` inputs are approved, create initial migrations for `public.allowed_users`, `public.staff_directory`, `public.staff_profiles`, `public.operation_log`, and `public.audit_events`, enable strict RLS with pgTAP/client negative authorization tests, generate `database.types.ts`, and wire Google OAuth PKCE session bootstrap.
