# Requirements Traceability

| Requirement | Architecture source | Primary verification |
|---|---|---|
| Modular, maintainable app | 02, 08, 13 | dependency-boundary tests, PR review |
| New repo while legacy remains live | 01, 11, 12 | release/cutover checklist |
| Supabase-only operational backend | 02, 03, 09 | network/E2E audit; no Sheets write path |
| Migrate Sheets as-is | 03, 09 | raw hashes, row counts, reconciliation |
| January 2027 native roster | 00, 09, 11 | native period lifecycle UAT |
| Approved Google emails only | 04 | RLS denied tests for unapproved account |
| Persistent account/session | 04, 08 | reload/restart/sign-out E2E |
| Personal profile pages | 03, 08 | own/other/owner permission E2E |
| Courses/APC and documents | 03, 06, 08 | record CRUD, expiry and Drive link tests |
| Editable rules/calculations | 03, 05, 08 | version/impact/activation tests |
| No arbitrary executable formulas | 05 | schema rejects unsupported expression/code |
| Frosted modern UI | 08 | token/contrast/responsive visual review |
| Roster lifecycle preserved | 03, 05 | domain, DB and E2E lifecycle suite |
| Weekly OFF/PN/night/GOFF rules | 05 | legacy regression corpus |
| Drive as document storage | 06 | upload/search/permission/reconcile integration |
| Monthly PDF manual archive | 07 | snapshot/Drive golden and idempotency tests |
| Amendments create new PDF versions | 07 | v01/v02 retention test |
| Telegram only for owner | 07 | fixed-chat/non-owner denial tests |
| Telegram failure does not undo Drive | 07 | fault-injection integration test |
| Phone sharing remains possible | 07 | `protect_content=false`, device UAT |
| Safe multi-agent build | AGENTS, 13 | task/handoff/contract review |
| GitHub Pages later becomes live | 12 | preview, rename/domain cutover smoke tests |

## Traceability maintenance

Every task and PR should cite one or more rows from this table. When a requirement changes, update the relevant blueprint, acceptance tests and decision record together.

