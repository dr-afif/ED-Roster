# Canonical Data Model

## Modeling rules

- Use lowercase snake_case.
- Use `bigint generated always as identity` for internal high-write IDs.
- Use UUID operation/snapshot identifiers where the client creates the ID or the value crosses systems.
- Use `timestamptz` for instants, `date` for roster dates and month-start dates.
- Use `text` plus check constraints for evolving status vocabularies unless a stable Postgres enum is justified.
- Index every foreign key.
- Add `created_at`, `created_by`, `updated_at` and `updated_by` where mutation is allowed.
- Prefer append-only events over status-history mutation.
- Preserve legacy source identifiers and import batch IDs.

## Schema exposure

### `public`

Contains tables/views intentionally reachable through the Data API. Every table has RLS enabled. Grants and RLS are both required.

### `private`

Contains internal integration configuration without credentials, policy helper functions and staging procedures. It is not exposed through the Data API. Credentials remain Edge Function secrets, not database rows.

### `legacy`

Contains immutable raw import evidence, mappings and reconciliation results. It is not exposed to normal clients.

## Identity and staff

### `allowed_users`

Purpose: invitation/allowlist and application role source.

Key fields:

- `id bigint identity primary key`
- `email citext unique not null`
- `auth_user_id uuid unique null references auth.users(id)`
- `role text check (role in ('owner','staff'))`
- `status text check (status in ('invited','active','suspended','revoked'))`
- `staff_id bigint null references staff_directory(id)`
- `invited_by uuid`, `invited_at`, `activated_at`, `revoked_at`
- audit timestamps

Constraints:

- exactly one active owner at launch, enforced by a partial unique index on the launch-owner marker or by a guarded owner-transfer RPC;
- normalized email uniqueness;
- a bound `auth_user_id` cannot be reused.

### `staff_directory`

Purpose: operational identity safe to show to other approved users and rosters.

Key fields:

- `id bigint identity primary key`
- `staff_code text unique not null`
- `roster_name text not null`
- `display_name text not null`
- `staff_group text` such as MO or specialist
- `employment_status text`
- `active boolean`
- `start_date date`, `end_date date`
- `source_system text`

Never use names as foreign keys. Historical display names may be copied into immutable snapshot lines for audit readability.

### `staff_profiles`

Purpose: personal/contact details with stricter access.

Key fields:

- `staff_id bigint primary key references staff_directory(id)`
- `auth_user_id uuid unique null references auth.users(id)`
- `full_name text`
- `email citext`
- `phone text`
- `registration_number text null`
- `emergency_contact` fields only if explicitly approved later
- profile audit fields

Staff may read/update approved fields on their own row. Owner may manage all. Fields requiring verification use a review status rather than accepting silent self-edit.

## Professional records and documents

### `record_type_definitions`

- stable key such as `course` or `annual_practicing_certificate`;
- label, required fields, renewal behavior, default visibility;
- active flag and display order.

### `professional_records`

- `id bigint identity primary key`
- `staff_id` FK
- `record_type_id` FK
- `title`, `issuer`, `reference_number`
- `issue_date`, `expiry_date`
- `status` (`draft`, `current`, `expired`, `superseded`, `cancelled`)
- `verification_status` and `verified_by/at`
- non-sensitive notes
- source/import fields and audit fields

Suggested indexes: `(staff_id, record_type_id, expiry_date)` and a partial index on `expiry_date` where status is `current`.

### `document_records`

- `id bigint identity primary key`
- optional `staff_id`, `professional_record_id`, `roster_snapshot_id`
- `document_category`
- `drive_file_id text unique not null`
- `drive_parent_id text not null`
- `file_name`, `mime_type`, `size_bytes`
- `sha256 text`
- `drive_web_view_link` optional cached convenience link
- `source_system`, `uploaded_by`, `uploaded_at`
- `visibility` (`owner`, `self_and_owner`, `all_staff`)
- `status` (`active`, `superseded`, `missing`, `archived`)

The stable Drive file ID is authoritative; path and web link may change.

## Requests and leave

### `request_types`

Configures request categories, allowed fields, lead-time constraints, display order and active state. Business algorithms remain in code; versioned parameters are stored here or in rule versions.

### `roster_requests`

- `id bigint identity primary key`
- `public_id uuid unique`
- `staff_id`, `period_id` optional, `request_type_id`
- target date/range and optional requested shift
- structured reason category and minimal free text
- `status` (`draft`, `submitted`, `approved`, `rejected`, `withdrawn`, `superseded`)
- `submitted_at`, `decided_at`, `decided_by`
- `source_system`, `legacy_source_id`
- audit fields

### `request_status_events`

Append-only status transitions with actor, time, reason and previous/new status. The current status on `roster_requests` is a cached projection updated in the same transaction.

### `leave_records`

Stores administrative leave/absence records without diagnoses. Link to roster amendments when an operational absence changes a published roster.

### `public_holidays`

Effective calendar records keyed by date and jurisdiction, with source and override audit. Do not overwrite historical definitions without versioned evidence.

## Roster configuration

### `shift_definitions`

- `code text primary key`
- label, short label, color token, sort order
- active/effective dates
- optional staffing bucket and display metadata

### `shift_semantics`

Versioned classification per shift code:

- consecutive behavior: `worked`, `transparent`, `reset`, `unknown`;
- provides staffing coverage;
- Policy-B night qualification;
- can displace normal OFF and earn GOFF;
- expected predecessor/follower group;
- modifier inheritance behavior.

### `rule_sets` and `rule_versions`

`rule_sets` defines a stable rule family. `rule_versions` contains:

- integer version;
- lifecycle `draft`, `active`, `retired`;
- `effective_from date` and optional `effective_to`;
- validated `config jsonb` with `schema_version`;
- `config_hash`;
- change summary, reason, actor and approval time.

Unique constraints prevent overlapping active effective ranges for a rule family. Weekly OFF effective dates must be Mondays.

### `staffing_thresholds`

Effective-dated minimum staffing by day type, shift bucket and optional staff group. Published/amended previews store the threshold version used.

## Roster lifecycle

### `roster_periods`

- `id bigint identity primary key`
- `period_start date unique` constrained to first day of month
- `status` (`draft`, `published`, `amended`, `closed`)
- `revision bigint not null default 0`
- `active_rule_version_id`
- publication/close metadata
- `legacy_read_only boolean`
- unique `(extract(year from period_start), extract(month ...))` is redundant if `period_start` is unique

### `roster_draft_assignments`

- `period_id`, `staff_id`, `duty_date` unique
- `shift_code`
- cell note/category if approved
- `row_revision`
- last editor/time

Only valid while the period is Draft. Rapid edits use atomic upsert and expected revision.

### `roster_publications`

One immutable record per publication/republication lineage:

- `id uuid primary key`
- `period_id`
- publication version and period revision
- rule/config IDs and checksums
- published by/time
- canonical data hash
- optional predecessor publication ID

Reopening does not mutate a publication snapshot.

### `roster_planned_assignments`

Immutable lines copied from the draft during publication:

- publication ID, period ID, staff ID, duty date;
- planned shift code;
- historical roster/display name;
- semantic/rule version references;
- unique `(publication_id, staff_id, duty_date)`.

### `roster_amendment_events`

Append-only event header:

- `id uuid primary key`
- `period_id`, `operation_id unique`, `event_type`
- reason category, public operational text, private note reference if needed
- actor/time, expected and resulting revision
- `reverses_event_id` optional
- state (`pending`, `confirmed`, `reversed`, `failed`)

### `roster_amendment_lines`

- event ID, staff ID, duty date;
- previous current shift and proposed current shift;
- planned shift copied for audit;
- staffing/GOFF impact metadata;
- unique line ordinal and source-cell constraint.

A database view or stable RPC composes current roster as planned assignments plus ordered active amendment lines. Do not persist an independently mutable current roster table unless it is a transactionally maintained projection with reconciliation tests.

### `weekly_off_snapshots`

Shared Monday-start week records containing locked rule version, completeness, planned night qualification, required OFF and publication calculation. Assignment ownership remains with monthly periods.

### `roster_issue_acknowledgements`

Records warning type, person/date context, rule version, acknowledged reason, actor/time and source command. Acknowledgement never changes the calculated warning result.

## GOFF ledger

### `goff_ledger_entries`

Append-only double-entry-like event stream per staff member:

- `id bigint identity primary key`
- `public_id uuid unique`
- `staff_id`, `period_id`
- `entry_type` (`opening`, `pending_earn`, `earn`, `reserve`, `release`, `use`, `adjustment`, `reversal`)
- `units integer` constrained to whole days and signed according to type
- source amendment/publication/snapshot IDs
- `operation_id`
- `reverses_entry_id` optional
- actor/time and required reason where applicable

Uniqueness on the source entitlement prevents duplicate earn/reserve effects. Balances are calculated from entries or a tested transactionally maintained projection, never from mutable roster cells.

### `goff_commencement`

Singleton/one active record containing commencement date, reconciliation status and owner confirmation. Production GOFF actions remain disabled until every applicable staff member has a confirmed opening entry.

## Snapshot, delivery and audit

### `roster_snapshots`

- `id uuid primary key`
- `period_id`, `publication_id`, source revision
- integer snapshot version unique per period
- type (`initial`, `amendment`, `final`, `manual`)
- reason and predecessor snapshot ID
- canonical payload JSON/hash or stable payload reference
- PDF hash, Drive file/folder IDs, file name
- generation status and error fields
- generated/archived actor and times

Unique `(period_id, source_revision)` prevents two archives of the same canonical revision unless an explicit new rendition type is approved.

### `roster_snapshot_deliveries`

- `id bigint identity primary key`
- snapshot ID
- channel fixed to `telegram_owner`
- idempotency key
- Telegram chat/message IDs
- status, attempt count, sent by/time, last error

Normal send uses unique `(snapshot_id, channel)`. An explicit resend creates a new delivery attempt linked to the earlier one.

### `operation_log`

Stores idempotency key, command type, actor, request hash, status, result reference and timestamps. Partial index active/failed operations for recovery views.

### `audit_events`

Append-only record for privileged changes:

- actor auth/staff IDs;
- action and entity type/ID;
- correlation/operation ID;
- before/after summaries with sensitive fields redacted;
- reason, timestamp, client/session metadata within privacy limits.

Clients receive owner-only audit data through RLS-protected views/RPCs. No client role receives update/delete access.

## Legacy import evidence

### `legacy.import_batches`

Source spreadsheet ID, export timestamp, tab manifest, file hashes, importer version, status and reconciliation summary.

### `legacy.raw_rows`

Batch ID, sheet/tab name, 1-based source row number, raw JSON payload and row hash. Immutable after a completed batch.

### `legacy.id_map`

Maps source entity/tab/key to canonical table/ID with transform version.

### `legacy.reconciliation_results`

Stores row counts, unique-key counts, null/error counts, business totals, checksums and reviewer disposition.

## Critical indexes

At minimum:

- every foreign key column;
- `allowed_users (auth_user_id) where status = 'active'`;
- `staff_directory (active, roster_name)`;
- `professional_records (staff_id, record_type_id, expiry_date)`;
- `roster_requests (staff_id, status, submitted_at desc)`;
- `roster_periods (period_start)`;
- draft/planned assignment `(period_id, duty_date, staff_id)` and `(period_id, staff_id, duty_date)` according to query path;
- amendment lines `(staff_id, duty_date, event_id)`;
- issue acknowledgements `(period_id, staff_id, duty_date)`;
- ledger `(staff_id, created_at, id)` plus partial active reservation/pending indexes;
- snapshots `(period_id, snapshot_version desc)`;
- operation log partial `(actor, created_at)` where status is queued/sending/failed;
- audit cursor `(created_at desc, id desc)`.

Final indexes must be justified by captured query plans rather than added indiscriminately.

## Data retention and deletion

- Roster publications, amendments, ledger entries, snapshots and audit events are never hard-deleted through the app.
- Staff are inactivated; historical foreign keys remain.
- Professional records may be superseded, with explicit retention policy determined by the owner/institution.
- Raw migration evidence remains retained at least through post-cutover acceptance and backup policy approval.
- Auth deletion must follow session revocation and record retention rules; deleting an auth account must not orphan staff history.

