# Testing and Acceptance Strategy

## Principles

- Test domain rules independently from React and Supabase.
- Test RLS from both SQL and client perspectives, including denial cases.
- Test migrations from a clean database.
- Mock external services at unit/component level; use controlled non-production integrations for contract tests.
- Preserve representative legacy cases as regression fixtures.
- A green build without security and migration tests is not release-ready.

## Test layers

### Static checks

- TypeScript strict mode.
- ESLint and formatting.
- Dependency and secret scanning.
- Database migration lint/advisors.
- Generated Supabase types are current.

### Pure unit tests

- date normalization in Asia/Kuala_Lumpur;
- shift code/modifier parsing;
- weekly OFF across boundaries;
- lifecycle transition guards;
- planned/current composition;
- consecutive/night/rest rules;
- staffing counts;
- GOFF projections and balances;
- request quotas;
- rule-version schema validation;
- PDF naming/page-layout calculations.

### Database tests

Use pgTAP or equivalent for:

- tables, constraints, indexes and foreign keys;
- RLS allow/deny matrix;
- owner transfer and allowlist binding;
- idempotent operation log;
- expected-revision conflicts;
- atomic publish/amend/reverse/close/reopen;
- one-time GOFF entitlement/reservation uniqueness;
- append-only audit protections;
- raw import immutability.

### Component tests

- route guards and unapproved state;
- profile and record forms;
- roster cell selection/keyboard flow;
- issue navigation and focus restoration;
- persistent save/conflict states;
- rules draft/preview/activation;
- archive and Telegram button state machines;
- mobile sheets and navigation.

### Integration tests

- browser Supabase client under actual RLS;
- Google OAuth callback/session bootstrap in non-production;
- Edge Function authentication and owner checks;
- PDF generation from frozen payload;
- Drive upload/retry/reconciliation in a test folder;
- Telegram send using a non-sensitive test PDF and test bot/chat;
- import transform and reconciliation reports.

### End-to-end tests

Critical journeys:

1. Approved staff signs in, session persists, reads roster and updates allowed profile fields.
2. Unapproved account is denied all data.
3. Staff submits/withdraws request; owner reviews it.
4. Owner drafts January roster, resolves issues and publishes.
5. Owner creates linked absence/replacement amendment and reverses it.
6. Owner closes/reopens only under allowed conditions.
7. Owner archives PDF to Drive, sends to private Telegram and retries a simulated failure.
8. Owner edits a rule draft, previews impact and activates future effective version.
9. Two sessions create a revision conflict without silent overwrite.
10. Historical legacy period remains read-only and unchanged.

### Accessibility tests

- Automated axe checks on major routes.
- Keyboard-only roster and dialog journeys.
- Screen-reader spot checks for grid, save status and errors.
- 200% zoom and 375 px viewport.
- Contrast verification for all semantic tokens/states.
- Reduced-motion behavior.

### Performance/reliability tests

- Initial app shell and route bundle budgets defined during scaffold.
- Roster query/render using expected maximum staff × 31 days.
- No full application dataset refresh after a single mutation.
- Query plans confirm key roster/audit/profile indexes.
- Rapid draft-edit coalescing.
- Retry/backoff and unknown-outcome reconciliation.
- Drive/Telegram rate and timeout handling.

## Representative roster scenarios

The release suite must include:

- Policy A/B complete and short weeks;
- adjacent unpublished month provisional state;
- cross-year week completion;
- planned night amended to MC without changing required OFF;
- planned OFF displaced by duty or PN;
- PN transparent within a six-day sequence;
- seventh worked-day warning;
- valid/invalid night bundles;
- night followed by reset versus worked shift;
- linked replacement partial failure;
- later dependency blocking reversal;
- duplicate operation retry;
- close blocked by pending/failed operation;
- unknown shift mapping;
- negative GOFF default block and reasoned override.

## PDF golden tests

For deterministic fixtures:

- compare extracted text, page count, key coordinates/layout bounds and payload/PDF hashes where stable;
- visually inspect rendered page images for representative 28/29/30/31-day months and long staff names;
- confirm repeated headers, legend, version and footer;
- confirm amendment summary and predecessor reference;
- never compare only file size.

## Migration tests

- clean import and repeat import;
- duplicate source row;
- malformed date and Sheets auto-coercion;
- renamed/duplicate staff;
- blank versus zero/value;
- unknown shift/status;
- historical row checksum;
- delta after rehearsal;
- rollback preserves evidence.

## CI gates

Every pull request:

- format/lint/typecheck;
- unit/component tests;
- migration apply from clean local Supabase;
- database/RLS tests;
- production build;
- targeted E2E smoke for affected critical flows.

Main/release candidate additionally:

- full E2E suite;
- dependency/secret scan;
- database advisors;
- accessibility scan;
- migration reconciliation dry run where relevant;
- preview deployment smoke test.

## Production acceptance gates

- No critical/high unresolved security findings.
- All RLS negative tests pass.
- Owner completes UAT checklist.
- Source migration reconciliation is approved.
- January 2027 publication/amendment rehearsal passes.
- Drive archive and private Telegram send pass using production configuration and non-sensitive test data.
- Backup and rollback are demonstrated.
- GitHub Pages/OAuth redirect paths are verified from a clean browser and phone.
- Operational runbook and credential owners are confirmed.

