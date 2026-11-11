-- =============================================================================
-- Migration: 20261103162000_wave_b_identity_rls_foundation.sql
-- Workstream: Wave B — Canonical Identity, Allowlist, RLS Foundation & Bootstrap
-- Blueprint references:
--   - MODULAR_APP_BLUEPRINT/03_DATA_MODEL.md
--   - MODULAR_APP_BLUEPRINT/04_SECURITY_AUTHORIZATION.md
--   - MODULAR_APP_BLUEPRINT/decisions/ADR-006-separate-supabase-environments.md
--   - MODULAR_APP_BLUEPRINT/decisions/ADR-007-github-pages-routing-strategy.md
-- =============================================================================

-- 1. Extensions & Non-Exposed Schemas
create extension if not exists citext with schema extensions;

create schema if not exists private;
create schema if not exists legacy;

revoke all on schema private from public, anon, authenticated;
revoke all on schema legacy from public, anon, authenticated;

-- PostgREST does not expose `private`, and default function execute privileges
-- in `private` are revoked so only explicitly granted zero-arg RLS helpers run.
grant usage on schema private to authenticated, service_role;
grant usage on schema legacy to service_role;

alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated;

alter default privileges in schema legacy
  revoke all on tables from public, anon, authenticated;

-- =============================================================================
-- 2. Canonical Wave B Tables (`public`)
-- =============================================================================

-- 2.1 Operational Staff Directory (safe operational identity; never join by name)
create table public.staff_directory (
  id bigint generated always as identity primary key,
  staff_code text not null,
  roster_name text not null,
  display_name text not null,
  staff_group text not null,
  employment_status text not null default 'active',
  active boolean not null default true,
  start_date date null,
  end_date date null,
  source_system text not null default 'native',
  legacy_source_id text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint staff_directory_staff_code_key unique (staff_code),
  constraint staff_directory_staff_code_nonempty_chk check (btrim(staff_code) <> ''),
  constraint staff_directory_roster_name_nonempty_chk check (btrim(roster_name) <> ''),
  constraint staff_directory_display_name_nonempty_chk check (btrim(display_name) <> ''),
  constraint staff_directory_staff_group_nonempty_chk check (btrim(staff_group) <> ''),
  constraint staff_directory_employment_status_chk check (
    employment_status in ('active', 'inactive', 'on_leave', 'transferred', 'resigned')
  ),
  constraint staff_directory_source_system_chk check (
    source_system in ('native', 'legacy_sheets')
  ),
  constraint staff_directory_dates_order_chk check (
    end_date is null or start_date is null or end_date >= start_date
  )
);

comment on table public.staff_directory is
  'Operational staff directory safe for approved roster viewers. Separated from private contact details in public.staff_profiles.';

-- 2.2 Google OAuth Allowlist & Application Role Source
create table public.allowed_users (
  id bigint generated always as identity primary key,
  email extensions.citext not null,
  auth_user_id uuid null references auth.users(id) on delete set null,
  role text not null,
  status text not null default 'invited',
  staff_id bigint null references public.staff_directory(id) on delete restrict,
  invited_by uuid null references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  activated_at timestamptz null,
  revoked_at timestamptz null,
  revoked_by uuid null references auth.users(id) on delete set null,
  revocation_reason text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint allowed_users_email_key unique (email),
  constraint allowed_users_auth_user_id_key unique (auth_user_id),
  constraint allowed_users_email_normalized_chk check (
    btrim(email::text) <> ''
    and email::text = lower(btrim(email::text))
    and position('@' in email::text) > 1
  ),
  constraint allowed_users_role_chk check (role in ('owner', 'staff')),
  constraint allowed_users_status_chk check (
    status in ('invited', 'active', 'suspended', 'revoked')
  ),
  constraint allowed_users_activated_timestamp_chk check (
    status <> 'active' or activated_at is not null
  ),
  constraint allowed_users_revoked_timestamp_chk check (
    status <> 'revoked' or revoked_at is not null
  )
);

comment on table public.allowed_users is
  'Authoritative Google OAuth email allowlist and role binding. User-editable user_metadata is never trusted.';

-- 2.3 Private Staff Profiles (row-isolated personal/contact details)
create table public.staff_profiles (
  staff_id bigint primary key references public.staff_directory(id) on delete restrict,
  auth_user_id uuid null references auth.users(id) on delete set null,
  full_name text not null,
  email extensions.citext null,
  phone text null,
  registration_number text null,
  verification_status text not null default 'unverified',
  verified_at timestamptz null,
  verified_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint staff_profiles_auth_user_id_key unique (auth_user_id),
  constraint staff_profiles_full_name_nonempty_chk check (btrim(full_name) <> ''),
  constraint staff_profiles_email_normalized_chk check (
    email is null
    or (
      btrim(email::text) <> ''
      and email::text = lower(btrim(email::text))
      and position('@' in email::text) > 1
    )
  ),
  constraint staff_profiles_phone_chk check (
    phone is null or length(btrim(phone)) between 5 and 32
  ),
  constraint staff_profiles_registration_number_chk check (
    registration_number is null or btrim(registration_number) <> ''
  ),
  constraint staff_profiles_verification_status_chk check (
    verification_status in ('unverified', 'pending_review', 'verified')
  )
);

comment on table public.staff_profiles is
  'Personal/contact fields isolated from public.staff_directory so RLS enforces self-or-owner privacy.';

-- 2.4 Idempotency & Operation Recovery Log
create table public.operation_log (
  id bigint generated always as identity primary key,
  operation_id uuid not null,
  command_type text not null,
  actor_auth_user_id uuid null references auth.users(id) on delete set null,
  actor_staff_id bigint null references public.staff_directory(id) on delete restrict,
  request_hash text not null,
  status text not null,
  result_ref jsonb null,
  error_code text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint operation_log_operation_id_key unique (operation_id),
  constraint operation_log_command_type_nonempty_chk check (btrim(command_type) <> ''),
  constraint operation_log_request_hash_nonempty_chk check (btrim(request_hash) <> ''),
  constraint operation_log_status_chk check (
    status in ('queued', 'sending', 'completed', 'failed')
  )
);

comment on table public.operation_log is
  'Idempotency and recovery tracking for privileged or external multi-step operations.';

-- 2.5 Append-Only Privileged Audit Events
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_auth_user_id uuid null references auth.users(id) on delete set null,
  actor_staff_id bigint null references public.staff_directory(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  operation_id uuid null,
  before_summary jsonb null,
  after_summary jsonb null,
  reason text null,
  client_metadata jsonb null,
  created_at timestamptz not null default now(),
  constraint audit_events_action_nonempty_chk check (btrim(action) <> ''),
  constraint audit_events_entity_type_nonempty_chk check (btrim(entity_type) <> ''),
  constraint audit_events_entity_id_nonempty_chk check (btrim(entity_id) <> '')
);

comment on table public.audit_events is
  'Immutable append-only audit log for privileged actions and allowlist transitions.';

-- =============================================================================
-- 3. Critical Indexes & Invariant Constraints (03_DATA_MODEL.md)
-- =============================================================================

-- Staff directory operational and FK indexes
create index staff_directory_active_roster_name_idx
  on public.staff_directory (active, roster_name);
create index staff_directory_created_by_idx
  on public.staff_directory (created_by);
create index staff_directory_updated_by_idx
  on public.staff_directory (updated_by);

-- Allowlist launch single-owner invariant, active auth lookup, staff binding, and FK indexes
create unique index allowed_users_single_launch_owner_idx
  on public.allowed_users ((role))
  where role = 'owner' and status in ('invited', 'active', 'suspended');

create unique index allowed_users_nonrevoked_staff_id_idx
  on public.allowed_users (staff_id)
  where staff_id is not null and status in ('invited', 'active', 'suspended');

create index allowed_users_active_auth_user_id_idx
  on public.allowed_users (auth_user_id)
  where status = 'active';

create index allowed_users_staff_id_idx
  on public.allowed_users (staff_id);
create index allowed_users_invited_by_idx
  on public.allowed_users (invited_by);
create index allowed_users_revoked_by_idx
  on public.allowed_users (revoked_by);
create index allowed_users_created_by_idx
  on public.allowed_users (created_by);
create index allowed_users_updated_by_idx
  on public.allowed_users (updated_by);

-- Staff profiles FK indexes
create index staff_profiles_verified_by_idx
  on public.staff_profiles (verified_by);
create index staff_profiles_created_by_idx
  on public.staff_profiles (created_by);
create index staff_profiles_updated_by_idx
  on public.staff_profiles (updated_by);

-- Operation log recovery partial index + FK indexes
create index operation_log_recovery_idx
  on public.operation_log (actor_auth_user_id, created_at desc)
  where status in ('queued', 'sending', 'failed');
create index operation_log_actor_auth_user_id_idx
  on public.operation_log (actor_auth_user_id);
create index operation_log_actor_staff_id_idx
  on public.operation_log (actor_staff_id);

-- Audit events cursor index + entity/FK indexes
create index audit_events_cursor_idx
  on public.audit_events (created_at desc, id desc);
create index audit_events_entity_lookup_idx
  on public.audit_events (entity_type, entity_id, created_at desc);
create index audit_events_actor_auth_user_id_idx
  on public.audit_events (actor_auth_user_id);
create index audit_events_actor_staff_id_idx
  on public.audit_events (actor_staff_id);

-- =============================================================================
-- 4. Private Security Helpers (`private` schema, `search_path = ''`)
-- =============================================================================

create or replace function private.mask_email(p_email text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_clean text;
  v_at integer;
  v_local text;
  v_domain text;
begin
  if p_email is null then
    return null;
  end if;
  v_clean := lower(btrim(p_email));
  v_at := position('@' in v_clean);
  if v_at <= 1 then
    return '***';
  end if;
  v_local := substring(v_clean from 1 for v_at - 1);
  v_domain := substring(v_clean from v_at + 1);
  return substring(v_local from 1 for 1) || '***@' || v_domain;
end;
$$;

revoke all on function private.mask_email(text) from public, anon, authenticated;

create or replace function private.is_active_approved_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_users au
    where au.auth_user_id = (select auth.uid())
      and au.status = 'active'
  );
$$;

revoke all on function private.is_active_approved_user() from public, anon, authenticated;
grant execute on function private.is_active_approved_user() to authenticated, service_role;

create or replace function private.is_active_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_users au
    where au.auth_user_id = (select auth.uid())
      and au.status = 'active'
      and au.role = 'owner'
  );
$$;

revoke all on function private.is_active_owner() from public, anon, authenticated;
grant execute on function private.is_active_owner() to authenticated, service_role;

create or replace function private.current_active_staff_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select au.staff_id
  from public.allowed_users au
  where au.auth_user_id = (select auth.uid())
    and au.status = 'active'
  limit 1;
$$;

revoke all on function private.current_active_staff_id() from public, anon, authenticated;
grant execute on function private.current_active_staff_id() to authenticated, service_role;

create or replace function private.append_audit_event(
  p_actor_auth_user_id uuid,
  p_actor_staff_id bigint,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_operation_id uuid default null,
  p_before_summary jsonb default null,
  p_after_summary jsonb default null,
  p_reason text default null
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_audit_id bigint;
begin
  insert into public.audit_events (
    actor_auth_user_id,
    actor_staff_id,
    action,
    entity_type,
    entity_id,
    operation_id,
    before_summary,
    after_summary,
    reason
  )
  values (
    p_actor_auth_user_id,
    p_actor_staff_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_operation_id,
    p_before_summary,
    p_after_summary,
    p_reason
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;

revoke all on function private.append_audit_event(
  uuid, bigint, text, text, text, uuid, jsonb, jsonb, text
) from public, anon, authenticated;

-- =============================================================================
-- 5. Normalization, Column-Protection, Audit & Append-Only Triggers
-- =============================================================================

-- 5.1 Prevent UPDATE or DELETE on `public.audit_events` unconditionally
create or replace function private.prevent_audit_events_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'public.audit_events is append-only; % is prohibited.', tg_op
    using errcode = '42501';
end;
$$;

revoke all on function private.prevent_audit_events_mutation() from public, anon, authenticated;

create trigger trg_audit_events_immutable
  before update or delete on public.audit_events
  for each row
  execute function private.prevent_audit_events_mutation();

-- 5.2 Normalize & stamp `public.staff_directory`
create or replace function private.before_write_staff_directory()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := (select auth.uid());
  new.staff_code := btrim(new.staff_code);
  new.roster_name := btrim(new.roster_name);
  new.display_name := btrim(new.display_name);
  new.staff_group := btrim(new.staff_group);

  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(v_uid, new.created_by);
    new.updated_at := now();
    new.updated_by := coalesce(v_uid, new.updated_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(v_uid, new.updated_by);
  end if;

  return new;
end;
$$;

revoke all on function private.before_write_staff_directory() from public, anon, authenticated;

create trigger trg_staff_directory_before_write
  before insert or update on public.staff_directory
  for each row
  execute function private.before_write_staff_directory();

-- 5.3 Normalize & stamp `public.allowed_users`
create or replace function private.before_write_allowed_users()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := (select auth.uid());
  if new.email is not null then
    new.email := lower(btrim(new.email::text))::extensions.citext;
  end if;

  if new.status = 'active' and new.activated_at is null then
    new.activated_at := now();
  end if;

  if new.status = 'revoked' then
    new.revoked_at := coalesce(new.revoked_at, now());
    new.revoked_by := coalesce(new.revoked_by, v_uid);
  end if;

  if tg_op = 'INSERT' then
    new.invited_at := coalesce(new.invited_at, now());
    new.invited_by := coalesce(v_uid, new.invited_by);
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(v_uid, new.created_by);
    new.updated_at := now();
    new.updated_by := coalesce(v_uid, new.updated_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(v_uid, new.updated_by);
  end if;

  return new;
end;
$$;

revoke all on function private.before_write_allowed_users() from public, anon, authenticated;

create trigger trg_allowed_users_before_write
  before insert or update on public.allowed_users
  for each row
  execute function private.before_write_allowed_users();

-- 5.4 Normalize, stamp & guard self-service column updates on `public.staff_profiles`
create or replace function private.before_write_staff_profiles()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := (select auth.uid());

  if new.email is not null then
    new.email := lower(btrim(new.email::text))::extensions.citext;
  end if;

  if new.phone is not null then
    new.phone := nullif(btrim(new.phone), '');
  end if;

  if new.registration_number is not null then
    new.registration_number := nullif(btrim(new.registration_number), '');
  end if;

  if tg_op = 'UPDATE' then
    -- Non-owner browser sessions may only update permitted self-service contact fields (`phone`).
    if current_user in ('authenticated', 'anon') and not (select private.is_active_owner()) then
      if new.staff_id is distinct from old.staff_id
        or new.auth_user_id is distinct from old.auth_user_id
        or new.full_name is distinct from old.full_name
        or (new.email::text is distinct from old.email::text)
        or new.registration_number is distinct from old.registration_number
        or new.verification_status is distinct from old.verification_status
        or new.verified_at is distinct from old.verified_at
        or new.verified_by is distinct from old.verified_by
      then
        raise exception 'Staff self-service updates may only modify permitted contact fields.'
          using errcode = '42501';
      end if;
    end if;

    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(v_uid, new.updated_by);
  else
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(v_uid, new.created_by);
    new.updated_at := now();
    new.updated_by := coalesce(v_uid, new.updated_by);
  end if;

  return new;
end;
$$;

revoke all on function private.before_write_staff_profiles() from public, anon, authenticated;

create trigger trg_staff_profiles_before_write
  before insert or update on public.staff_profiles
  for each row
  execute function private.before_write_staff_profiles();

-- 5.5 Redacted audit triggers for privileged identity & allowlist changes
create or replace function private.audit_allowed_users_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_uid uuid;
  v_actor_staff_id bigint;
  v_action text;
begin
  v_actor_uid := coalesce((select auth.uid()), new.updated_by, new.auth_user_id);
  v_actor_staff_id := (select private.current_active_staff_id());

  if tg_op = 'INSERT' then
    perform private.append_audit_event(
      p_actor_auth_user_id => v_actor_uid,
      p_actor_staff_id => v_actor_staff_id,
      p_action => 'allowlist.invited',
      p_entity_type => 'allowed_users',
      p_entity_id => new.id::text,
      p_before_summary => null,
      p_after_summary => jsonb_build_object(
        'masked_email', private.mask_email(new.email::text),
        'role', new.role,
        'status', new.status,
        'staff_id', new.staff_id,
        'auth_bound', (new.auth_user_id is not null)
      ),
      p_reason => null
    );
    return new;
  end if;

  if old.status is distinct from new.status
    or old.role is distinct from new.role
    or old.staff_id is distinct from new.staff_id
    or old.auth_user_id is distinct from new.auth_user_id
    or (old.email::text is distinct from new.email::text)
  then
    v_action := case
      when old.status = 'invited' and new.status = 'active' then 'allowlist.activated'
      when new.status = 'suspended' and old.status <> 'suspended' then 'allowlist.suspended'
      when new.status = 'revoked' and old.status <> 'revoked' then 'allowlist.revoked'
      else 'allowlist.updated'
    end;

    perform private.append_audit_event(
      p_actor_auth_user_id => v_actor_uid,
      p_actor_staff_id => coalesce(v_actor_staff_id, new.staff_id),
      p_action => v_action,
      p_entity_type => 'allowed_users',
      p_entity_id => new.id::text,
      p_before_summary => jsonb_build_object(
        'masked_email', private.mask_email(old.email::text),
        'role', old.role,
        'status', old.status,
        'staff_id', old.staff_id,
        'auth_bound', (old.auth_user_id is not null)
      ),
      p_after_summary => jsonb_build_object(
        'masked_email', private.mask_email(new.email::text),
        'role', new.role,
        'status', new.status,
        'staff_id', new.staff_id,
        'auth_bound', (new.auth_user_id is not null)
      ),
      p_reason => new.revocation_reason
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_allowed_users_changes() from public, anon, authenticated;

create trigger trg_allowed_users_audit
  after insert or update on public.allowed_users
  for each row
  execute function private.audit_allowed_users_changes();

create or replace function private.audit_staff_directory_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_uid uuid;
  v_actor_staff_id bigint;
  v_action text;
begin
  v_actor_uid := coalesce((select auth.uid()), new.updated_by);
  v_actor_staff_id := (select private.current_active_staff_id());

  if tg_op = 'INSERT' then
    perform private.append_audit_event(
      p_actor_auth_user_id => v_actor_uid,
      p_actor_staff_id => v_actor_staff_id,
      p_action => 'staff_directory.created',
      p_entity_type => 'staff_directory',
      p_entity_id => new.id::text,
      p_before_summary => null,
      p_after_summary => jsonb_build_object(
        'staff_code', new.staff_code,
        'staff_group', new.staff_group,
        'employment_status', new.employment_status,
        'active', new.active
      ),
      p_reason => null
    );
    return new;
  end if;

  if old.staff_code is distinct from new.staff_code
    or old.roster_name is distinct from new.roster_name
    or old.display_name is distinct from new.display_name
    or old.staff_group is distinct from new.staff_group
    or old.employment_status is distinct from new.employment_status
    or old.active is distinct from new.active
  then
    v_action := case
      when old.active = true and new.active = false then 'staff_directory.inactivated'
      else 'staff_directory.updated'
    end;

    perform private.append_audit_event(
      p_actor_auth_user_id => v_actor_uid,
      p_actor_staff_id => v_actor_staff_id,
      p_action => v_action,
      p_entity_type => 'staff_directory',
      p_entity_id => new.id::text,
      p_before_summary => jsonb_build_object(
        'staff_code', old.staff_code,
        'staff_group', old.staff_group,
        'employment_status', old.employment_status,
        'active', old.active
      ),
      p_after_summary => jsonb_build_object(
        'staff_code', new.staff_code,
        'staff_group', new.staff_group,
        'employment_status', new.employment_status,
        'active', new.active
      ),
      p_reason => null
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_staff_directory_changes() from public, anon, authenticated;

create trigger trg_staff_directory_audit
  after insert or update on public.staff_directory
  for each row
  execute function private.audit_staff_directory_changes();

create or replace function private.audit_staff_profiles_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_uid uuid;
  v_actor_staff_id bigint;
begin
  v_actor_uid := coalesce((select auth.uid()), new.updated_by);
  v_actor_staff_id := (select private.current_active_staff_id());

  if tg_op = 'INSERT' then
    perform private.append_audit_event(
      p_actor_auth_user_id => v_actor_uid,
      p_actor_staff_id => v_actor_staff_id,
      p_action => 'staff_profile.created',
      p_entity_type => 'staff_profiles',
      p_entity_id => new.staff_id::text,
      p_before_summary => null,
      p_after_summary => jsonb_build_object(
        'staff_id', new.staff_id,
        'verification_status', new.verification_status,
        'auth_bound', (new.auth_user_id is not null)
      ),
      p_reason => null
    );
    return new;
  end if;

  if old.full_name is distinct from new.full_name
    or (old.email::text is distinct from new.email::text)
    or old.phone is distinct from new.phone
    or old.registration_number is distinct from new.registration_number
    or old.verification_status is distinct from new.verification_status
    or old.auth_user_id is distinct from new.auth_user_id
  then
    -- Redact raw phone numbers and emails from audit payloads (04_SECURITY_AUTHORIZATION.md).
    perform private.append_audit_event(
      p_actor_auth_user_id => v_actor_uid,
      p_actor_staff_id => coalesce(v_actor_staff_id, new.staff_id),
      p_action => 'staff_profile.updated',
      p_entity_type => 'staff_profiles',
      p_entity_id => new.staff_id::text,
      p_before_summary => jsonb_build_object(
        'verification_status', old.verification_status,
        'auth_bound', (old.auth_user_id is not null)
      ),
      p_after_summary => jsonb_build_object(
        'verification_status', new.verification_status,
        'auth_bound', (new.auth_user_id is not null),
        'phone_changed', (old.phone is distinct from new.phone),
        'registration_changed', (old.registration_number is distinct from new.registration_number)
      ),
      p_reason => null
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_staff_profiles_changes() from public, anon, authenticated;

create trigger trg_staff_profiles_audit
  after insert or update on public.staff_profiles
  for each row
  execute function private.audit_staff_profiles_changes();

-- =============================================================================
-- 6. Session Bootstrap RPC (`public.bootstrap_my_session()`)
-- =============================================================================

create or replace function public.bootstrap_my_session()
returns table (
  access_status text,
  role text,
  staff_id bigint,
  staff_code text,
  display_name text,
  roster_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_verified_email text;
  v_email_confirmed_at timestamptz;
  v_allow_row public.allowed_users%rowtype;
  v_dir_staff_code text;
  v_dir_display_name text;
  v_dir_roster_name text;
begin
  v_uid := (select auth.uid());

  if v_uid is null then
    return query
    select
      'unauthenticated'::text,
      null::text,
      null::bigint,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  -- Authoritative email check directly from auth.users (never trust user_metadata).
  select lower(btrim(u.email)), u.email_confirmed_at
    into v_verified_email, v_email_confirmed_at
  from auth.users u
  where u.id = v_uid;

  if v_verified_email is null or v_verified_email = '' or v_email_confirmed_at is null then
    return query
    select
      'unapproved'::text,
      null::text,
      null::bigint,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  -- 1. Check if this auth_user_id is already bound in public.allowed_users.
  select *
    into v_allow_row
  from public.allowed_users au
  where au.auth_user_id = v_uid
  for update;

  if not found then
    -- 2. Otherwise look up normalized email for initial invitation binding.
    select *
      into v_allow_row
    from public.allowed_users au
    where au.email operator(extensions.=) v_verified_email::extensions.citext
    for update;

    if not found then
      return query
      select
        'unapproved'::text,
        null::text,
        null::bigint,
        null::text,
        null::text,
        null::text;
      return;
    end if;

    -- Refuse silent takeover if bound to a different auth_user_id.
    if v_allow_row.auth_user_id is not null and v_allow_row.auth_user_id <> v_uid then
      return query
      select
        'unapproved'::text,
        null::text,
        null::bigint,
        null::text,
        null::text,
        null::text;
      return;
    end if;

    if v_allow_row.status in ('suspended', 'revoked') then
      return query
      select
        v_allow_row.status,
        null::text,
        null::bigint,
        null::text,
        null::text,
        null::text;
      return;
    end if;

    -- Safely bind only invited + unbound rows (`04_SECURITY_AUTHORIZATION.md`).
    if v_allow_row.status <> 'invited' or v_allow_row.auth_user_id is not null then
      return query
      select
        'unapproved'::text,
        null::text,
        null::bigint,
        null::text,
        null::text,
        null::text;
      return;
    end if;

    update public.allowed_users
    set
      auth_user_id = v_uid,
      status = 'active',
      activated_at = coalesce(activated_at, now()),
      updated_at = now(),
      updated_by = v_uid
    where id = v_allow_row.id
    returning * into v_allow_row;

    if v_allow_row.staff_id is not null then
      update public.staff_profiles
      set
        auth_user_id = v_uid,
        updated_at = now(),
        updated_by = v_uid
      where public.staff_profiles.staff_id = v_allow_row.staff_id
        and public.staff_profiles.auth_user_id is null;
    end if;
  else
    -- Already bound to v_uid: enforce live status immediately even with unexpired JWT.
    if v_allow_row.status in ('suspended', 'revoked') then
      return query
      select
        v_allow_row.status,
        null::text,
        null::bigint,
        null::text,
        null::text,
        null::text;
      return;
    end if;

    if v_allow_row.status = 'invited' then
      if v_allow_row.email operator(extensions.=) v_verified_email::extensions.citext then
        update public.allowed_users
        set
          status = 'active',
          activated_at = coalesce(activated_at, now()),
          updated_at = now(),
          updated_by = v_uid
        where id = v_allow_row.id
        returning * into v_allow_row;
      else
        return query
        select
          'unapproved'::text,
          null::text,
          null::bigint,
          null::text,
          null::text,
          null::text;
        return;
      end if;
    end if;
  end if;

  if v_allow_row.status <> 'active' then
    return query
    select
      'unapproved'::text,
      null::text,
      null::bigint,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  if v_allow_row.staff_id is not null then
    select sd.staff_code, sd.display_name, sd.roster_name
      into v_dir_staff_code, v_dir_display_name, v_dir_roster_name
    from public.staff_directory sd
    where sd.id = v_allow_row.staff_id;
  end if;

  return query
  select
    'active'::text,
    v_allow_row.role,
    v_allow_row.staff_id,
    v_dir_staff_code,
    coalesce(
      v_dir_display_name,
      case when v_allow_row.role = 'owner' then 'Roster Administrator' else 'Approved Staff' end
    ),
    v_dir_roster_name;
end;
$$;

revoke all on function public.bootstrap_my_session() from public, anon;
grant execute on function public.bootstrap_my_session() to authenticated, service_role;

comment on function public.bootstrap_my_session() is
  'Verifies caller confirmed auth.users email against public.allowed_users, binds invited unbound accounts atomically, and returns minimal role/directory session state.';

-- =============================================================================
-- 7. Explicit Privilege Grants & Row Level Security Policies
-- =============================================================================

-- Revoke broad default table privileges first (zero anonymous access; no hard-delete grants)
revoke all on table public.staff_directory from public, anon, authenticated;
revoke all on table public.allowed_users from public, anon, authenticated;
revoke all on table public.staff_profiles from public, anon, authenticated;
revoke all on table public.operation_log from public, anon, authenticated;
revoke all on table public.audit_events from public, anon, authenticated;

grant select, insert, update on table public.staff_directory to authenticated;
grant select, insert, update on table public.allowed_users to authenticated;
grant select, insert, update on table public.staff_profiles to authenticated;
grant select on table public.operation_log to authenticated;
grant select on table public.audit_events to authenticated;

grant all on table public.staff_directory to service_role;
grant all on table public.allowed_users to service_role;
grant all on table public.staff_profiles to service_role;
grant all on table public.operation_log to service_role;
grant select, insert on table public.audit_events to service_role;

grant usage on all sequences in schema public to authenticated, service_role;

-- Enable RLS on every exposed table in `public`
alter table public.staff_directory enable row level security;
alter table public.allowed_users enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.operation_log enable row level security;
alter table public.audit_events enable row level security;

-- 7.1 `public.allowed_users` policies (unified per action to avoid multiple_permissive_policies)
create policy "allowed_users_select_self_or_owner"
  on public.allowed_users
  for select
  to authenticated
  using (
    (select private.is_active_owner())
    or (
      auth_user_id = (select auth.uid())
      and status = 'active'
    )
  );

create policy "allowed_users_insert_owner"
  on public.allowed_users
  for insert
  to authenticated
  with check ((select private.is_active_owner()));

create policy "allowed_users_update_owner"
  on public.allowed_users
  for update
  to authenticated
  using ((select private.is_active_owner()))
  with check ((select private.is_active_owner()));

-- 7.2 `public.staff_directory` policies
create policy "staff_directory_select_approved"
  on public.staff_directory
  for select
  to authenticated
  using (
    (select private.is_active_owner())
    or (
      (select private.is_active_approved_user())
      and (
        active = true
        or id = (select private.current_active_staff_id())
      )
    )
  );

create policy "staff_directory_insert_owner"
  on public.staff_directory
  for insert
  to authenticated
  with check ((select private.is_active_owner()));

create policy "staff_directory_update_owner"
  on public.staff_directory
  for update
  to authenticated
  using ((select private.is_active_owner()))
  with check ((select private.is_active_owner()));

-- 7.3 `public.staff_profiles` policies
create policy "staff_profiles_select_self_or_owner"
  on public.staff_profiles
  for select
  to authenticated
  using (
    (select private.is_active_owner())
    or (
      (select private.is_active_approved_user())
      and staff_id = (select private.current_active_staff_id())
    )
  );

create policy "staff_profiles_insert_owner"
  on public.staff_profiles
  for insert
  to authenticated
  with check ((select private.is_active_owner()));

create policy "staff_profiles_update_self_or_owner"
  on public.staff_profiles
  for update
  to authenticated
  using (
    (select private.is_active_owner())
    or (
      (select private.is_active_approved_user())
      and staff_id = (select private.current_active_staff_id())
    )
  )
  with check (
    (select private.is_active_owner())
    or (
      (select private.is_active_approved_user())
      and staff_id = (select private.current_active_staff_id())
    )
  );

-- 7.4 `public.operation_log` policies
create policy "operation_log_select_self_or_owner"
  on public.operation_log
  for select
  to authenticated
  using (
    (select private.is_active_owner())
    or (
      (select private.is_active_approved_user())
      and actor_auth_user_id = (select auth.uid())
    )
  );

-- 7.5 `public.audit_events` policies (owner-only read; append-only enforced by trigger + grants)
create policy "audit_events_select_owner"
  on public.audit_events
  for select
  to authenticated
  using ((select private.is_active_owner()));
