# Delivery Roadmap

## Planning assumption

The window from 2026-11-03 to January 2027 is approximately eight weeks. It is achievable only with disciplined scope, early security/data decisions and weekly integrated increments. January readiness should prioritize a safe roster and migration core over optional analytics polish.

## Critical path

```text
Architecture decisions
  → repository + environments
  → auth/RLS + schema foundation
  → migration identity mapping
  → roster domain and persistence
  → owner workflows and rules
  → Drive/PDF/Telegram
  → rehearsal/UAT/security
  → final migration and URL cutover
```

## Week 0 — 3–7 November: owner review and foundation decisions

Deliver:

- approve this blueprint;
- choose replacement repository name;
- identify production/non-production Supabase projects;
- confirm owner email and initial approved users;
- confirm source workbook inventory access;
- decide Shared Drive vs delegated OAuth fallback;
- confirm January 2027 first native roster;
- create issue backlog from task templates.

Exit gate: all `BLOCKS FOUNDATION` questions resolved.

## Week 1 — 8–14 November: scaffold and security skeleton

Deliver:

- new TypeScript/Vite/React repository;
- CI, lint, tests, preview Pages deployment;
- local/non-production Supabase setup and migration pipeline;
- Google sign-in and redirect configuration;
- allowlist, owner/staff roles and session bootstrap;
- initial RLS negative tests;
- application shell/navigation/design tokens.

Exit gate: approved owner/staff sign in correctly; unapproved user reads nothing.

## Week 2 — 15–21 November: canonical data and migration rehearsal A

Deliver:

- staff/profile, request, rules and legacy import schemas;
- source workbook/tab inventory and immutable export manifest;
- first raw import and staff identity mapping tool/report;
- normalized historical request/roster transform;
- reconciliation report format;
- profile and approved-email administration UI.

Exit gate: first rehearsal loads from a clean non-production database with explained exceptions.

## Week 3 — 22–28 November: requests, records and document catalog

Deliver:

- request submission/admin lifecycle;
- professional records and record types;
- document metadata and Drive folder provisioning spike;
- owner/staff profile/record pages;
- audit event foundation;
- responsive and accessibility checks.

Exit gate: owner and staff self-service permissions pass end-to-end.

## Week 4 — 29 November–5 December: roster engine and draft workspace

Deliver:

- TypeScript port of semantic mapping, weekly OFF, sequences, staffing and GOFF projection;
- legacy regression fixtures;
- roster period/draft schema and revision/idempotency support;
- desktop draft grid and mobile read flow;
- issue panel and save-status model;
- versioned rule draft/validation UI.

Exit gate: January draft can be edited safely and rule corpus passes.

## Week 5 — 6–12 December: lifecycle and amendments

Deliver:

- atomic publish with planned snapshot and week snapshots;
- current/original/changes views;
- absence, replacement, swap, correction and reversal;
- GOFF ledger and opening-balance workflow;
- close/reopen reconciliation;
- multi-session conflict tests.

Exit gate: complete roster lifecycle passes database and E2E tests.

## Week 6 — 13–19 December: Drive, PDF and personal Telegram

Deliver:

- production-shaped Drive folder configuration in non-production folder;
- deterministic roster PDF and visual regression fixtures;
- immutable snapshot archive and retry/reconciliation;
- owner private Telegram send and delivery log;
- document search/navigation;
- operational integration runbook.

Exit gate: archived PDF can be found in Drive and sent to the owner's test/private chat without exposed secrets or duplicates.

## Week 7 — 20–27 December: rehearsal B, UAT and hardening

Deliver:

- clean full migration rehearsal using final scripts;
- owner UAT on desktop and phone;
- accessibility/security/performance review;
- rotate any legacy exposed credentials;
- backup and rollback rehearsal;
- freeze optional scope;
- production release candidate and go/no-go report.

Exit gate: every production acceptance gate is signed off or cutover is postponed.

## Cutover window — 28 December–4 January

Deliver:

- agreed legacy write freeze;
- final export/delta import and reconciliation;
- production smoke test;
- GitHub Pages/custom-domain switch;
- January 2027 roster enablement;
- legacy app and workbook labeled read-only;
- daily monitoring through first publication/amendment/archive.

Avoid a rushed holiday cutover if required reviewers are unavailable. A delayed cutover is safer than an unreconciled roster system.

## Scope protection

If schedule pressure occurs, defer in this order:

1. advanced analytics;
2. PWA/offline mutation support;
3. complex notification reminders;
4. document bulk automation;
5. decorative motion/dark mode.

Do not defer RLS, audit, revision conflicts, migration evidence, roster correctness, backup or rollback.

## Progress measures

Track weekly:

- acceptance criteria passed/total;
- open blockers by owner/agent/external dependency;
- migration reconciliation exceptions;
- RLS negative-test coverage;
- roster regression pass count;
- critical E2E pass rate;
- unresolved security/advisor findings;
- cutover readiness status.

