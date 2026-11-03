# ADR-007: GitHub Pages SPA routing with HashRouter and Supabase PKCE

- Status: Accepted
- Date: 2026-11-03
- Deciders: Product owner, Architecture/App shell workstream
- Supersedes: None
- Superseded by: None

## Context

The RESQ Modular App is deployed initially as a static Vite/React single-page application on GitHub Pages at `https://dr-afif.github.io/ED-Roster/` (`project-manifest.yaml`, `08_FRONTEND_UX.md`, `12_DEPLOYMENT_OPERATIONS.md`). Before cutover in January 2027, the deployment URL may move either to a custom domain (`https://<custom-domain>/`) or via a repository rename to `/REQUEST-APP/` (`12_DEPLOYMENT_OPERATIONS.md`).

Selecting the client router strategy requires evaluating five coupled behaviors simultaneously:

1. **GitHub Pages refresh and deep-link behavior**: GitHub Pages is a static file server without configurable server-side SPA rewrite rules (`200 OK` fallback to `index.html`). Direct requests or browser refreshes on path-based deep links such as `/ED-Roster/rosters/2027/01` return HTTP `404 Not Found`.
2. **The `/ED-Roster/` base path**: Static asset paths (`/ED-Roster/assets/...`), router navigation, manifest start URL, and OAuth redirects must operate reliably under a subpath in staging/preview and under `/` in local dev or a future custom domain.
3. **Future Supabase Google OAuth callbacks**: Supabase Auth supports implicit flow (returning `#access_token=...` in the URL hash fragment) and PKCE flow (`flowType: 'pkce'`, returning `?code=...` in the URL query string before `#`). Implicit-flow hash fragments collide with hash-based client routers, whereas `404.html` query-rewrite workarounds for path-based routers rewrite `?code=...` and can break `detectSessionInUrl` or emit HTTP `404` status codes during login callbacks.
4. **Repository rename or custom-domain cutover**: Cutover from `/ED-Roster/` to `/` (custom domain) or `/REQUEST-APP/` (repository rename) must not break bookmarked route patterns or fail due to hardcoded path-segment counters in custom `404.html` scripts.
5. **PWA and service-worker scope**: Optional bounded read-only PWA support (`08_FRONTEND_UX.md`) registers a build-generated service worker scoped to Vite's `BASE_URL` (`/ED-Roster/`). Serving synthetic `404` responses on deep links complicates service-worker navigation caching and browser installability checks.

## Options considered

### Option A: `createHashRouter` + Supabase Auth PKCE (`flowType: 'pkce'`) + parameterized `VITE_BASE_PATH`

- **Mechanism**:
  - Vite serves the document and assets under parameterized `VITE_BASE_PATH` (default `/` locally, `/ED-Roster/` on GitHub Pages).
  - Client routes live in the hash fragment (`https://dr-afif.github.io/ED-Roster/#/rosters/2027/01`), encapsulated behind a single router factory (`src/app/router.tsx`).
  - Supabase client explicitly configures `auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }`.
  - Google OAuth `redirectTo` targets the canonical base document URL (`${window.location.origin}${import.meta.env.BASE_URL}`), so Supabase returns `https://dr-afif.github.io/ED-Roster/?code=<one-time-code>` (`200 OK` directly from `index.html`, with `?code=` in `window.location.search` before `#`).
  - A pre-route OAuth callback guard also inspects `window.location.search` and `window.location.hash` for OAuth error fragments (`error`, `error_description`) or legacy fragments so `HashRouter` never misinterprets an OAuth callback fragment as an unknown application route.
- **Benefits**:
  - Native HTTP `200 OK` on every refresh, bookmark, and shared deep link on GitHub Pages with zero `404.html` redirect scripts.
  - PKCE is Supabase's recommended OAuth security flow for SPAs (no bearer access token exposed in URL fragments or browser history).
  - Route paths (`#/rosters/2027/01`, `#/requests`) are completely independent of base-path changes (`/ED-Roster/` -> `/` or `/REQUEST-APP/`).
  - Service worker navigation scope maps cleanly to `${BASE_URL}index.html` without HTTP `404` workarounds.
- **Costs and risks**:
  - URLs include `/#/` while hosted on GitHub Pages.
  - Requires enforcing `flowType: 'pkce'` in the Supabase client wrapper and preserving any post-login target route in `sessionStorage` prior to `signInWithOAuth` rather than encoding a second `#` inside `redirectTo`.

### Option B: `createBrowserRouter` with `basename` + custom `404.html` fallback

- **Mechanism**:
  - Uses clean pathname URLs (`/ED-Roster/rosters/2027/01`) with `basename={import.meta.env.BASE_URL}` and either copies `index.html` to `404.html` or uses a `spa-github-pages` query-string redirect script.
- **Benefits**:
  - Clean pathname URLs without `#`.
- **Costs and risks**:
  - Copying `index.html` to `404.html` causes GitHub Pages to return HTTP status `404` on every deep-link reload and path-based OAuth callback (`/ED-Roster/auth/callback`), degrading diagnostics, monitoring, and service-worker caching.
  - Query-string rewriting (`spa-github-pages`) mutates `?code=...` OAuth callback query strings and embeds a `pathSegmentsToKeep` integer (`1` for `/ED-Roster/`, `0` for custom domain `/`) that is a known failure point during cutover.

### Option C: `createMemoryRouter`

- **Benefits**: No server-side path dependencies.
- **Costs and risks**: Breaks browser refresh state, back/forward URL visibility, bookmarkable monthly rosters (`/rosters/2027/01`), and deep links to documents/requests. Rejected.

## Decision

Select **Option A**:

1. Use React Router's **`createHashRouter`** behind a single router factory (`src/app/router.tsx`) so all feature modules use standard `<Link to="/...">` and `useNavigate()` calls without coupling to hash internals.
2. Parameterize Vite's `base` configuration via `VITE_BASE_PATH` (normalizing leading/trailing slashes; defaulting to `/` in local dev and `/ED-Roster/` in GitHub Pages builds).
3. Configure the browser Supabase client exclusively with **`flowType: 'pkce'`** so Google OAuth callbacks arrive via `?code=` query parameters at `${origin}${BASE_URL}` (`HTTP 200`), and include an OAuth URL fragment safety helper so unexpected `#error=` fragments are handled cleanly before route matching.
4. Keep router creation isolated to `src/app/router.tsx` so migrating to `createBrowserRouter` after a future move off GitHub Pages onto a host with native `200` SPA rewrites requires changing only one file.

## Consequences

### Positive

- Refreshing `/ED-Roster/#/rosters/2027/01` or any admin/staff deep link on GitHub Pages always returns `200 OK` without `404.html` hacks.
- Repository rename (`/ED-Roster/` -> `/REQUEST-APP/`) or custom-domain cutover (`/`) requires changing only `VITE_BASE_PATH` and Supabase/Google OAuth allowlisted base URLs—no `404.html` segment-counting changes.
- Eliminates implicit-flow bearer tokens from URL fragments by mandating PKCE.
- Future PWA service-worker precaching and `navigateFallback` stay strictly within `${BASE_URL}` scope on `200 OK` responses.

### Negative/trade-offs

- Browser address bar displays `#/` between base path and route path (e.g., `https://dr-afif.github.io/ED-Roster/#/requests`).
- Deep-link restoration across Google OAuth sign-in must store the intended internal route (e.g., `/rosters/2027/01`) in `sessionStorage` (`resq.auth.v1.returnTo`) before redirecting to Google, then `navigate(returnTo, { replace: true })` after PKCE code exchange completes.

## Security, data and migration impact

- **Security**: Improves OAuth security posture by mandating PKCE (`?code=` + `code_verifier`) over implicit `#access_token=` fragments. Open-redirect risk on `returnTo` is mitigated by accepting only relative internal paths starting with `/` (never `//` or external origins).
- **Supabase Auth allowlist**: Both `http://localhost:5173/` and `https://dr-afif.github.io/ED-Roster/` (and later the production URL) are registered as exact base URLs in Supabase Auth Redirect URLs—no wildcard deep-link patterns needed.
- **Data/migration**: No database schema impact.

## Verification

1. **Unit/Component tests**: Verify router renders all blueprint routes (`/`, `/rosters/2027/01`, `/requests`, `/profile/me`, `/records`, `/documents`, `/updates`, `/admin/*`), handles unknown routes with a clear recovery view, and sanitizes OAuth callback/return-path helpers.
2. **Build base-path check**: Build with `VITE_BASE_PATH=/ED-Roster/` and verify generated `dist/index.html` prefixes asset URLs with `/ED-Roster/` while hash routes resolve cleanly.
3. **Wave B OAuth integration check**: In staging (`hgrutigkgnrcjhcjxabs`), complete Google sign-in from `/ED-Roster/#/requests`, confirm `?code=` PKCE exchange succeeds with `HTTP 200`, `?code=` is scrubbed from the URL after exchange, and the user lands back on `#/requests` (or is signed out with an unapproved-account message if not in `allowed_users`).
4. **Cutover rehearsal**: Smoke test identical build behavior with `VITE_BASE_PATH=/` (custom domain simulation) and `VITE_BASE_PATH=/REQUEST-APP/` (repo rename simulation).

## References

- `MODULAR_APP_BLUEPRINT/04_SECURITY_AUTHORIZATION.md`
- `MODULAR_APP_BLUEPRINT/08_FRONTEND_UX.md`
- `MODULAR_APP_BLUEPRINT/12_DEPLOYMENT_OPERATIONS.md`
- [Supabase Auth PKCE Flow & Google Sign-In](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
