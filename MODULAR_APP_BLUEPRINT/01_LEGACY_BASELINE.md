# Legacy Baseline

## Evidence boundary

This baseline was inspected from the public GitHub repository `dr-afif/REQUEST-APP`, branch `main`, at commit `ff6b5119ae448e0dde2ff01243d394b6cd834573` on 2026-11-03. The local workspace containing this blueprint was empty and is not a clone of the legacy repository.

The legacy repository remains the behavioral reference, not the implementation base for the replacement.

## Current architecture

- Static Vite/React SPA hosted on GitHub Pages.
- JavaScript and JSX, Tailwind CSS, Lucide icons.
- Google Apps Script web app as the backend.
- Google Sheets as the operational system of record.
- Cache-first browser startup using multiple `resq_cache_*` localStorage keys.
- Optimistic browser mutations followed by full backend refresh.
- PWA manifest and manually maintained service worker.
- A four-digit/client-session admin flow supplemented by newer Apps Script token work.

The current app is technically a SPA and already has some feature folders, but it is not modular enough for the planned expansion. Notable large files at the baseline include:

- `src/App.jsx` approximately 75 KB;
- `src/components/AdminPanel.jsx` approximately 95 KB;
- `src/components/AnalyticsPage.jsx` approximately 104 KB;
- `src/components/RosterPage.jsx` approximately 246 KB;
- `backend/roster-lifecycle.gs` approximately 246 KB;
- `appscript.txt` approximately 587 KB.

## Existing user-facing areas

- Dashboard.
- Full roster and roster lifecycle workspace.
- Request panel.
- Updates.
- Administrative summary and analytics.
- Public-holiday tracker.
- Admin panel for roster and configuration.
- Leave applications and operational absence data.
- Roster PDF and GHKA memo export utilities.

## Important legacy behavior to preserve

- Request quotas, dates, weekends and time-zone semantics.
- Shift codes and modifier normalization.
- Staff directory identities and historical names.
- Roster lifecycle: Draft, Published, Amended and Closed.
- Immutable planned snapshot plus append-only amendments.
- Current/original/changes roster views.
- Weekly Monday–Sunday OFF evaluation across month/year boundaries.
- Effective-dated OFF policies and publication-time policy snapshots.
- Night-bundle, consecutive-work and post-night-rest guidance.
- GOFF opening balances, reservations, earns, uses, releases, reversals and adjustments.
- Idempotent official operations and revision conflict handling.
- The simplified Main/Amend workflow and empty-month upload protection from the latest October 2026 changes.

The detailed business contract is restated in `05_ROSTER_RULES_ENGINE.md`; implementation agents must also run compatibility fixtures derived from the legacy test suite.

## Recent `main` changes relevant to the replacement

The most recent commits inspected include:

- fail-closed protection against empty-month roster uploads;
- merged simplified roster release while preserving historical-month protection;
- simplified Main and Amend saving with staging verification;
- fast local roster editing;
- corrected public-holiday worked/non-working classification;
- unified Google admin login and hardened legacy mutations;
- faster V2 revisits and improved admin-session privacy;
- live roster snapshot projection and backward-compatible source resolution.

These changes show where previous migration attempts were fragile: authentication boundaries, roster source selection, partial/empty uploads, Google Sheets coercion, slow writes and duplicate lifecycle state.

## Technical debt not to copy

- Root-level application state and orchestration in `App.jsx`.
- Oversized page components mixing data access, domain rules and presentation.
- Client/localStorage identity selection.
- Privileged third-party access from any browser path.
- Full-dataset refresh after each write.
- Mutable Sheets cells as both planned and current truth.
- Manual Apps Script source assembly/deployment drift.
- Hard-coded GitHub Pages base path and manually versioned service-worker cache.
- Rollbacks that restore whole arrays rather than the failed entity.
- Local-only configuration used as though it were shared policy.

## Security baseline actions

The public repository contains tracked environment-style files such as `.env.local` and `src/.env`. Their contents were deliberately not read for this blueprint. Before reusing any credential or endpoint:

1. inventory tracked configuration files;
2. assume exposed secrets are compromised;
3. rotate any secret material;
4. remove secrets from current Git history where appropriate;
5. add secret scanning to the replacement repository; and
6. expose only a Supabase publishable key and public URL to the browser.

An Apps Script URL is not itself a secure authorization boundary. The replacement must enforce identity and authorization at Supabase.

## Reuse strategy

Reuse as specifications and test fixtures:

- domain semantics and acceptance tests;
- normalization edge cases;
- roster lifecycle terminology;
- selected date/holiday utilities after TypeScript port and review;
- visual concepts such as desktop side navigation, mobile header/bottom navigation and roster focus mode.

Rewrite behind new contracts:

- API layer;
- authentication and authorization;
- data model;
- state/query orchestration;
- roster persistence and conflict handling;
- rule configuration;
- document integration;
- PDF archive workflow;
- deployment and service worker.

Do not attempt a file-by-file transplant of the old application.

