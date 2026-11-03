# Security and Authorization

## Security objective

Only approved Google identities may access the application. Staff may see shared operational roster data and their own private records. The sole owner may perform roster, policy, integration and audit administration. These rules must hold even if someone modifies browser code or calls the Supabase API directly.

## Authentication flow

1. User selects **Sign in with Google**.
2. Supabase Auth completes OAuth and returns to an allowlisted application URL.
3. The app obtains the session and calls a minimal bootstrap endpoint/RPC.
4. Bootstrap normalizes the verified email, finds an `allowed_users` row and safely binds the `auth_user_id` if invited and unbound.
5. If active, the app loads the user's staff/profile context.
6. If not approved, no application table is readable; the app explains that access is not approved and signs out.

Google's hosted-domain hint may improve account selection but is not authorization. The database allowlist is authoritative.

## Persistent session

Use Supabase's supported browser session persistence and automatic token refresh. Do not build custom password/PIN/session tokens. Requirements:

- session survives ordinary reloads and app restarts;
- explicit sign-out clears local session state and query caches;
- revoked/suspended users lose application access at the next request even if their JWT has not yet expired;
- sensitive owner commands re-check active role server-side;
- account-change and OAuth error paths are handled explicitly.

For strict owner operations, the server function should query current allowlist status instead of relying only on stale role claims.

## Role model

### `owner`

One active owner at launch. Can administer roster, rules, staff/records, integrations, migration and audit.

### `staff`

Can read shared published roster information and manage permitted self-service data.

No anonymous data access is required. Future roles need an ADR, RLS changes and negative authorization tests.

## RLS permission matrix

| Resource | Active staff | Owner | Unapproved/authenticated | Anonymous |
|---|---|---|---|---|
| Own allowlist/profile binding | Read own minimal status | Manage all | No app data | None |
| Staff directory operational fields | Read active directory | Manage | None | None |
| Private staff profile | Read/update permitted own fields | Manage all | None | None |
| Professional records | Read own; limited self-update if approved | Manage all | None | None |
| Own requests | Create/read/update permitted states | Manage all | None | None |
| Published roster/current changes | Read | Read/manage | None | None |
| Draft roster/private notes | None | Read/manage | None | None |
| Rules and thresholds | Read active public subset | Version/manage | None | None |
| Document metadata | By visibility and ownership | Manage | None | None |
| Audit and migration evidence | None | Read through controlled API | None | None |
| Integration configuration | None | Controlled status only | None | None |

Every RLS policy includes both authentication and ownership/role predicates. `TO authenticated` alone is not authorization.

## RLS implementation requirements

- Enable RLS on every table exposed through `public`.
- Use `(select auth.uid())` in policies so it is evaluated once.
- Index `auth_user_id`, `staff_id`, status and other policy predicate columns.
- Separate operational directory fields from private profile fields because RLS is row-based, not a substitute for column privacy.
- UPDATE policies require both `USING` and `WITH CHECK`.
- Views must use `security_invoker = true` where appropriate, or be hidden behind a carefully reviewed function.
- Any `security definer` helper must live in an unexposed schema, use `set search_path = ''`, validate the caller, return minimal information and have explicit execution grants.
- Do not use user-editable `user_metadata` for authorization.
- Do not rely solely on role values embedded in a long-lived JWT.

## Privileged functions

Critical functions verify:

1. a valid signed-in caller;
2. active allowlist status;
3. current owner role;
4. expected entity revision;
5. idempotency key and request hash;
6. input schema and business invariants.

Use a user-scoped Supabase client for ordinary RLS operations. A service/secret client is allowed only inside server-side functions for narrowly defined operations and must never be returned or logged.

## Secrets

Store these only as production Edge Function secrets or approved platform secret stores:

- Google service-account private key or OAuth client/refresh credentials;
- Google Drive root folder/shared-drive IDs if treated as configuration;
- Telegram bot token;
- owner's Telegram chat ID;
- Supabase secret/service-role key;
- migration-only source credentials.

The browser may receive only the Supabase URL, publishable key and intentionally public application configuration.

Secrets must have owners, rotation dates and a revocation procedure. Production and non-production secrets must differ.

## Personal and medical information

- Collect the minimum fields necessary for workforce administration.
- Do not solicit or store diagnoses in absence/MC notes.
- Show operational absence category to permitted roster viewers; keep administrative notes owner-only.
- Do not place personal document URLs in public roster payloads.
- Redact sensitive before/after values in general audit displays.
- Do not log OAuth tokens, phone numbers, document contents, private notes or full request payloads.

## Threats and controls

| Threat | Primary control |
|---|---|
| Unapproved user signs in with Google | Allowlist binding plus RLS deny by default |
| Staff changes browser role/UI | RLS and owner check inside RPC/Edge Function |
| Leaked publishable key | RLS; key grants no privileged bypass |
| Leaked server credential | Platform secret store, rotation, narrow scopes, monitoring |
| Duplicate publish/amendment/ledger action | Operation ID unique constraint and stored result |
| Stale editor overwrites newer roster | Expected revision conflict |
| Drive link shared beyond intended users | Drive permissions, metadata visibility and periodic audit |
| Telegram PDF forwarded | Owner-only destination; acknowledge that forwarding leaves app control |
| Formula/settings injection | Typed schema/limited expression DSL; no arbitrary code |
| Malicious imported sheet content | Treat imports as data, escape on rendering/export, validate transforms |
| Public repository secret exposure | Secret scanning, `.env` ignore policy, rotation and history review |

## Security tests required

- Anonymous receives no application rows.
- Authenticated but unapproved user receives no application rows.
- Staff cannot select another staff member's private profile, records or documents.
- Staff cannot mutate roster, rules, allowlist, audit or integration data.
- Owner can perform allowed commands but stale revision and duplicate operations are handled safely.
- Private notes never appear in staff roster responses.
- Edge Functions reject missing, expired and non-owner sessions.
- RLS is tested with pgTAP and through the actual client API.
- No production secret is present in frontend build artifacts.

## Security release gate

Production cutover is blocked until database advisors are clean or every warning is dispositioned, negative RLS tests pass, leaked legacy credentials have been rotated, and the Drive/Telegram credentials are confirmed absent from the browser bundle.

