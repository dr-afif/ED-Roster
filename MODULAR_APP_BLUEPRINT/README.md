# RESQ Modular App Blueprint

Status: architecture baseline for review  
Prepared: 2026-11-03 (Asia/Kuala_Lumpur)  
Legacy source: [`dr-afif/REQUEST-APP`](https://github.com/dr-afif/REQUEST-APP), `main` at `ff6b5119ae448e0dde2ff01243d394b6cd834573`

## Purpose

This folder is the source of truth for building the modular successor to the current RESQ/ED roster request application. It is written so that different AI coding agents—Codex, Claude, Antigravity, or others—can work on separate tasks without inventing incompatible architectures.

The target is a responsive React application with Supabase as the only application database, Google authentication restricted to approved email addresses, Google Drive as the document repository, immutable roster PDF archives, and a private Telegram delivery button for the owner.

The old Google Sheets data remains an immutable migration source and audit reference. The replacement application must not continue using Sheets as an operational backend after cutover.

## Locked direction

- Build in a new GitHub repository and keep the current application live during development.
- Use a modular SPA, not a new monolith.
- Use Supabase Auth, Postgres, Row Level Security, and Edge Functions.
- Import historical Sheets data into Supabase with a raw evidence layer plus normalized application tables.
- Treat imported historical rosters as read-only and do not reinterpret them under new rules.
- Target the January 2027 roster as the first Supabase-native roster, subject to rehearsal and acceptance gates.
- Store document metadata and searchable attributes in Supabase; store actual documents in a controlled Google Drive hierarchy.
- Generate immutable, versioned roster PDFs manually from the roster page.
- Send an archived PDF only to the owner's private Telegram bot chat on request.
- Preserve the proven roster lifecycle, amendment, weekly OFF, GOFF, and audit rules from the current application unless an approved architecture decision changes them.

## Reading order for builders

1. `AGENTS.md` — mandatory working rules.
2. `project-manifest.yaml` — machine-readable project facts and assumptions.
3. `00_PRODUCT_VISION_SCOPE.md` — goals, users, release boundaries.
4. `01_LEGACY_BASELINE.md` — what exists and what must be preserved.
5. `02_TARGET_ARCHITECTURE.md` — system and module boundaries.
6. `03_DATA_MODEL.md` — canonical database contract.
7. `04_SECURITY_AUTHORIZATION.md` — authentication, allowlist, RLS and secrets.
8. `05_ROSTER_RULES_ENGINE.md` — roster invariants and editable-rule boundaries.
9. `06_GOOGLE_DRIVE_DOCUMENTS.md` — Drive organization and document catalog.
10. `07_PDF_TELEGRAM_WORKFLOW.md` — snapshot, archive and personal delivery.
11. `08_FRONTEND_UX.md` — routes, modules, UI system and accessibility.
12. `09_MIGRATION_CUTOVER.md` — Sheets import, reconciliation and launch.
13. `10_TESTING_ACCEPTANCE.md` — test layers and release gates.
14. `11_DELIVERY_ROADMAP.md` — implementation sequence and January target.
15. `12_DEPLOYMENT_OPERATIONS.md` — environments, GitHub Pages and rollback.
16. `13_MULTI_AGENT_WORKFLOW.md` — parallel work protocol and handoffs.
17. `14_DECISIONS_OPEN_QUESTIONS.md` — locked decisions and owner inputs.
18. `15_REQUIREMENTS_TRACEABILITY.md` — requirement-to-test mapping.

## Source-of-truth priority

When documents conflict, use this order:

1. An accepted ADR in `decisions/`.
2. Security and data invariants in documents 03–05.
3. This blueprint's locked direction.
4. Legacy product specification and tests from the baseline commit.
5. Existing legacy behavior.

Never silently choose between conflicting requirements. Record the conflict in `14_DECISIONS_OPEN_QUESTIONS.md` and create an ADR.

## Deliverable definition

The blueprint is complete enough to start implementation when:

- all open items marked `BLOCKS FOUNDATION` are resolved;
- the schema contract and permission matrix are owner-approved;
- the source Sheets inventory and January 2027 cutover date are confirmed;
- the Google Drive authentication model is selected;
- a new repository and Supabase non-production project exist; and
- the first implementation tasks are created from `templates/TASK_BRIEF.md`.

## External references

- [Supabase Auth with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth)
- [Supabase production secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase database testing](https://supabase.com/docs/guides/local-development/testing/overview)
- [Google Drive shared drives](https://developers.google.com/workspace/drive/api/guides/about-shareddrives)
- [Google Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Telegram `sendDocument`](https://core.telegram.org/bots/api#senddocument)

