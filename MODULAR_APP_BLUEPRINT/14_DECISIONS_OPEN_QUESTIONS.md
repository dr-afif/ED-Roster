# Decisions and Open Questions

## Locked decisions

| ID | Decision |
|---|---|
| D-001 | Build the replacement in a new repository while legacy remains live. |
| D-002 | Use a modular React SPA, not microservices and not another large single component. |
| D-003 | Supabase is the only operational application database after cutover. |
| D-004 | Google Sheets is a read-only migration/audit source; no normal dual-write. |
| D-005 | Import raw evidence plus normalized canonical data; historical periods are read-only. |
| D-006 | Google OAuth is gated by a database approved-email list and RLS. |
| D-007 | Launch with one owner/roster administrator and staff users. |
| D-008 | Google Drive stores documents; Supabase stores metadata/search/audit. |
| D-009 | Roster PDFs are manual, immutable, versioned Drive snapshots. |
| D-010 | Telegram sends only to the owner's private chat after archive. |
| D-011 | Rules/settings are typed and versioned; no arbitrary executable formulas. |
| D-012 | January 2027 is the intended first native period, subject to go/no-go gates. |
| D-013 | Use `hgrutigkgnrcjhcjxabs` for staging/testing and reserve `bubvwijyaqfbugsaedxp` for production. |
| D-014 | ADR-007: GitHub Pages SPA routing with HashRouter, Supabase PKCE OAuth, and parameterized base path. |

## Open questions — BLOCKS FOUNDATION

- Add approved Supabase management accounts/tool connections before agents perform managed database work.
- What is the owner's exact approved Google email?
- What are the initial approved staff emails and staff identity mapping source?
- What are the source spreadsheet IDs and authoritative tab inventory?
- Does the institution provide a Shared Drive, and can a service account be added with least privilege?
- If not, which dedicated Workspace user will authorize Drive access?
- Is 2027-01-01 confirmed as the first Supabase-native roster period?

## Open questions — BLOCKS PRODUCTION INTEGRATION

- Production Drive root/shared-drive/folder IDs.
- Google Cloud project and OAuth/service-account ownership.
- Telegram bot identity and owner's private chat ID.
- Final public URL: repository Pages path or custom domain.
- Credential owners and rotation contacts.
- Required institutional retention period for professional records and roster PDFs.

## Open questions — OWNER POLICY INPUT

- Which profile fields may staff self-edit versus owner-verify?
- Which professional record types are mandatory at launch beyond courses and annual practicing certificates?
- Expiry reminder windows and who sees them.
- Whether all approved staff may open roster PDFs from the app or only the owner.
- Whether staff may upload documents for verification or owner-only upload at launch.
- Final staffing thresholds and shift semantic inventory.
- GOFF commencement/opening balances for January 2027.

## Decision process

For a decision that changes architecture, security, data retention, external ownership or roster semantics:

1. Copy `templates/ADR.md` into `decisions/ADR-NNN-short-title.md`.
2. Record context, options, decision, consequences and migration impact.
3. Obtain owner approval where product/policy is involved.
4. Update the manifest and affected blueprint documents.
5. Link implementing tasks/PRs.

Do not delete superseded decisions; mark them Superseded and link the replacement ADR.

