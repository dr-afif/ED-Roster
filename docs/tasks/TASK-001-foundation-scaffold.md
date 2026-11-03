# Task Brief: Foundation Scaffold and App Shell Architecture

## Identity

- Task ID: `TASK-001`
- Workstream: Architecture/release & App shell/design system (Wave A)
- Owner/agent: Antigravity
- Branch/worktree: `main` (uncommitted working tree per owner no-commit restriction until explicit approval)
- Dependencies: `MODULAR_APP_BLUEPRINT` baseline (`ADR-001` through `ADR-006`)
- Contract/migration versions: Pre-migration frontend foundation (`v0.1.0`; zero database migrations)

## Objective

Establish a strictly typed, modular React + TypeScript + Vite single-page application scaffold at the `ED-Roster` repository root that proves the blueprint module boundaries, environment validation, staging Supabase client/provider isolation, GitHub Pages routing strategy (`ADR-007`), semantic frosted-glass/solid design system, accessible desktop/mobile shell, and automated CI quality gates without touching operational features, external services, or database schemas.

## User value

Provides the Emergency Department owner and subsequent multi-agent workstreams with a verified, secret-safe, accessible application foundation where database/RLS (`Wave B`), migration (`Wave B/C`), and feature modules (`Wave C/D`) can integrate cleanly without creating another monolithic `App.jsx` or leaking credentials.

## In scope

- Inspect repository state and verify `.env.local` gitignore protection and staging configuration (`hgrutigkgnrcjhcjxabs`).
- Propose `ADR-007` evaluating GitHub Pages deep-link/refresh behavior, `/ED-Roster/` base path, Supabase Google OAuth PKCE callbacks, repository rename vs. custom-domain cutover, and PWA/service-worker scope.
- Scaffold Vite + React + strict TypeScript application at repository root while preserving `MODULAR_APP_BLUEPRINT/`.
- Establish `src/app`, `src/platform/{auth,query,supabase,telemetry}`, `src/shared/{ui,forms,dates,validation,types}`, `src/features/*`, and `src/routes` boundaries.
- Implement fail-closed runtime environment validation (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) rejecting missing, placeholder, malformed, or secret/service-role keys, and blocking production mode in tests/dev.
- Create browser-safe Supabase client wrapper (`flowType: 'pkce'`) and React provider boundaries (`SupabaseProvider`, `QueryProvider`, UX-only `AuthProvider`).
- Build accessible responsive shell (skip link, collapsible desktop sidebar with non-production environment badge, 5-destination mobile bottom navigation with accessible `More` sheet, 44x44 px minimum touch targets, semantic CSS tokens, reduced-motion support, Lucide SVG icons).
- Add placeholder route views for the blueprint route map (`08_FRONTEND_UX.md`) to prove modular boundaries.
- Configure ESLint, Prettier, Vitest, Testing Library, Playwright config, `.env.example`, `.gitignore`, pinned dependencies (`package-lock.json`), and `.github/workflows/ci.yml`.

## Non-goals

- Operational roster calculations, grid editing, publishing, amending, or GOFF ledger logic.
- Creating or altering tables, RLS policies, RPCs, Auth providers, or Edge Functions in staging (`hgrutigkgnrcjhcjxabs`) or production (`bubvwijyaqfbugsaedxp`).
- Google Drive folder provisioning or file uploads.
- PDF snapshot rendering or Telegram Bot setup/delivery.
- Importing or reading live Google Sheets data or touching `dr-afif/REQUEST-APP`.
- Committing, pushing, deploying, or altering GitHub repository settings without explicit owner approval.

## Allowed files/modules

- Root tooling & config: `package.json`, `package-lock.json`, `.npmrc`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.env.example`, `.gitignore`, `.github/workflows/ci.yml`
- Architecture & task docs: `MODULAR_APP_BLUEPRINT/decisions/ADR-007-github-pages-routing-strategy.md`, `docs/tasks/TASK-001-foundation-scaffold.md`, `docs/handoffs/HANDOFF-001-foundation-scaffold.md`
- Application source & tests: `src/**`, `e2e/**`, `public/**`

## Required reading

- `MODULAR_APP_BLUEPRINT/README.md`
- `MODULAR_APP_BLUEPRINT/AGENTS.md`
- `MODULAR_APP_BLUEPRINT/project-manifest.yaml`
- `MODULAR_APP_BLUEPRINT/00_PRODUCT_VISION_SCOPE.md` through `15_REQUIREMENTS_TRACEABILITY.md`
- `MODULAR_APP_BLUEPRINT/decisions/ADR-001-modular-monolith-supabase.md` through `ADR-006-separate-supabase-environments.md`
- `MODULAR_APP_BLUEPRINT/templates/TASK_BRIEF.md`, `ADR.md`, `HANDOFF.md`, `PR_CHECKLIST.md`

## Security and data classification

- User roles involved: None live yet; UX-only placeholder awareness for `owner` and `staff` boundaries.
- Personal/sensitive data involved: None. Synthetic/structural UI copy only; zero real staff names, emails, phones, or clinical notes.
- RLS/secret/integration impact: Browser bundle accepts only `VITE_SUPABASE_URL` and publishable key (`sb_publishable_*`). Validator explicitly rejects `sb_secret_*`, `service_role` tokens, embedded URL credentials, and production environment flags during tests/development.
- Required negative authorization tests:
  - Validator rejects `sb_secret_*` and `service_role` JWTs in `VITE_SUPABASE_PUBLISHABLE_KEY`.
  - Validator rejects missing, malformed, or `.env.example` placeholder values.
  - Validator rejects `VITE_APP_ENV=production` inside automated test runs.
  - UX route boundary clearly surfaces that server-side RLS/RPC enforcement is authoritative and never reads `user_metadata` for roles.

## Contracts

- **Environment Contract (`RuntimeEnvConfig`)**:
  - Inputs: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, optional `VITE_APP_ENV` (`local | staging | production | test`), Vite `BASE_URL` / `MODE`.
  - Output: Validated frozen config `{ supabaseUrl, supabasePublishableKey, projectRef, appEnv, basePath, isProduction }` or `EnvironmentConfigurationError`.
- **Error Envelope (`AppError`)**:
  - `{ code, message, correlationId?, fieldErrors?, retryable, currentRevision? }` (`02_TARGET_ARCHITECTURE.md`).
- **Canonical Routes (`08_FRONTEND_UX.md`)**:
  - Staff/shared: `/`, `/rosters/:yyyy/:mm`, `/requests`, `/profile/me`, `/records`, `/documents`, `/updates`
  - Owner admin placeholders: `/admin/staff`, `/admin/requests`, `/admin/rules`, `/admin/settings`, `/admin/audit`, `/admin/migration`

## Acceptance criteria

- [x] Given valid staging environment variables, when the application boots, then the shell renders with the non-production staging indicator and navigates cleanly across all placeholder routes.
- [x] Given missing or malformed `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, when the validator runs or the app boots, then startup fails closed with an actionable configuration message without exposing raw key values.
- [x] Given a `sb_secret_*` or `service_role` key supplied to `VITE_SUPABASE_PUBLISHABLE_KEY`, when validation runs, then it throws a security configuration error refusing browser initialization.
- [x] Given keyboard-only navigation or a 375 px mobile viewport, when interacting with the shell, then a visible skip link, focus indicators, >= 44x44 px primary controls, semantic landmarks, and accessible 5-tab mobile navigation (`More` dialog) operate cleanly.
- [x] Given module dependency rules, when inspecting `src/platform` and `src/shared`, then zero imports reference `src/features` or `src/routes`.

## Required tests

- Unit:
  - Environment validator success, missing vars, malformed URLs, placeholder rejection, secret/service-role rejection, and test-mode production guard (`src/platform/supabase/__tests__/env.test.ts`).
  - Architecture dependency-boundary test verifying `platform/` and `shared/` never import `features/` or `routes/`, and no `src/` file hardcodes Supabase URLs or keys (`src/__tests__/architecture-boundaries.test.ts`).
  - Malaysia date/period helper unit tests (`src/shared/dates/__tests__/malaysiaDate.test.ts`).
- Database/RLS: Not applicable in Wave A (deferred to separately approved Wave B schema/RLS foundation task).
- Component:
  - Application shell rendering, skip link, desktop/mobile navigation landmarks, placeholder route transitions, `More` sheet interaction, and startup configuration error screen (`src/app/__tests__/AppShell.test.tsx`).
- E2E/integration:
  - Playwright configuration and baseline smoke spec prepared (`playwright.config.ts`, `e2e/smoke.spec.ts`) for CI/browser execution.

## Migration and rollback impact

- Zero database migrations, Edge Functions, or external service changes.
- Rollback is purely local file removal/git reset in `ED-Roster`; `dr-afif/REQUEST-APP` and both Supabase projects remain untouched.

## Handoff expectation

- Next workstream: **Wave B — Database & Security Foundation** (once `BLOCKS FOUNDATION` owner inputs and Supabase staging management access are ready).
- Handoff provides exact package versions, environment contract, `ADR-007` routing + PKCE callback specification, query key hierarchy, and manual owner actions required before Wave B.
