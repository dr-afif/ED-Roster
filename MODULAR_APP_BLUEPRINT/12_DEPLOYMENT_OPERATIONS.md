# Deployment and Operations

## Environment model

### Local

- Local Supabase stack with synthetic fixtures.
- Local Vite server.
- No live Sheets, Drive or Telegram credentials.
- External integrations mocked by default.

### Non-production

- Separate Supabase project or properly isolated preview branch.
- Dedicated Google Drive test root folder.
- Telegram disabled by default or separate test bot/chat.
- Preview GitHub Pages URL.
- Masked/approved data only.

### Production

- Dedicated Supabase project and secrets.
- Production Drive root/shared drive.
- Owner's private Telegram chat.
- Public GitHub Pages URL/custom domain.
- Monitoring, backups and incident owner.

A staging Google Sheet is not part of this environment model.

## CI/CD pipeline

Pull request:

1. install exact lockfile dependencies;
2. lint/typecheck/test;
3. start clean local Supabase and apply migrations;
4. run database/RLS tests;
5. build frontend;
6. run relevant browser tests;
7. publish preview where supported.

Main/release:

1. repeat full gates;
2. apply reviewed database migrations before frontend features that require them;
3. deploy Edge Functions;
4. set/verify secrets without printing values;
5. deploy Pages artifact;
6. run smoke tests and record release manifest.

Use feature flags for additive rollout, but never use a flag to bypass authorization.

## Database migration discipline

- One ordered migration owner at a time.
- Generate migrations through the supported Supabase workflow; do not invent timestamps.
- Apply from a clean database in CI.
- Use additive/expand-contract changes during active rollout.
- Do not combine schema change, destructive data rewrite and unrelated UI work in one PR.
- Backfill in bounded batches with progress/audit.
- Run security/performance advisors before release.
- Production data fixes are versioned scripts with a dry-run/report mode.

## GitHub Pages development arrangement

- Keep `dr-afif/REQUEST-APP` live.
- Develop/deploy the replacement from a new repository and separate Pages URL.
- Configure Supabase Site URL/allowed redirects and Google OAuth for both approved non-production and production URLs.
- Parameterize Vite base path, router basename/hash strategy, manifest start URL and service-worker scope.

## Recommended public URL cutover

The safest option is a custom domain because it decouples the public address from repository names:

1. validate replacement at preview URL;
2. attach the custom domain to the replacement Pages deployment;
3. update OAuth/Supabase allowed URLs;
4. switch DNS/Pages association;
5. retain legacy repository under its old Pages URL for rollback.

## Repository rename cutover alternative

If retaining the original `.../REQUEST-APP/` Pages path is required:

1. freeze deployments;
2. archive/rename the old repository to a clearly labeled legacy name;
3. rename the replacement repository to `REQUEST-APP`;
4. update Vite base, router, manifest and service worker;
5. update GitHub Pages settings;
6. update Supabase Site URL/redirect allowlist;
7. update Google OAuth authorized origins/redirects where applicable;
8. rebuild and deploy from the renamed repository;
9. test sign-in, refresh/deep links, PWA cache and phone access;
10. retain a documented reversal sequence.

Repository renaming is a release operation, not a casual final step. GitHub redirects do not replace explicit OAuth and service-worker verification.

## Configuration inventory

Browser build-time:

- Supabase project URL;
- Supabase publishable key;
- application base URL/path;
- environment label and safe feature flags.

Server-side secrets:

- Supabase secret/service key where a function truly requires bypass;
- Google credential material and scopes;
- production Drive IDs/configuration;
- Telegram bot token and owner chat ID;
- migration-only source credentials.

Never use a production secret in GitHub Pages build variables.

## Backups

- Supabase automated backups according to project plan.
- manual pre-cutover database snapshot/export.
- immutable migration manifests/source export hashes.
- verified legacy workbook backup.
- Drive catalog export with file IDs/hashes.
- release manifest containing Git commit, migration versions, function versions and configuration hashes.

Test restore/recovery steps before cutover; backup existence alone is not evidence of recoverability.

## Monitoring

Track:

- Auth failures and unapproved sign-in attempts without logging tokens;
- Edge Function error rate/latency;
- database errors, slow queries and deadlocks;
- failed/pending operation log count;
- roster revision conflicts;
- Drive upload and reconciliation failures;
- Telegram delivery failures;
- migration reconciliation status;
- client error correlation IDs.

Alerts should identify action required, not expose personal data.

## Operational runbooks required

- suspend/revoke an approved user and revoke sessions;
- transfer owner role safely;
- rotate Supabase/Google/Telegram credentials;
- recover a stuck roster operation;
- reconcile unknown Drive upload outcome;
- retry or intentionally resend Telegram delivery;
- close/reopen a period;
- add/map a new shift code;
- restore/repoint the legacy application;
- incident response for exposed credentials or document sharing.

## Rollback principle

Frontend rollback, database rollback and data reconciliation are separate decisions. Prefer forward-fix/additive migrations. Never run destructive schema rollback merely to match an old frontend while preserving newer records is possible.

