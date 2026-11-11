-- =============================================================================
-- Migration: 20261111100000_wave_c_requests_records_schema.sql
-- Description: Wave C Requests, Leave, Professional Records, and Public Holidays
-- Target: Supabase Staging (`hgrutigkgnrcjhcjxabs`)
-- Author: Antigravity Pair Programmer
-- Invariants:
--   - Strict Row Level Security on all public tables
--   - Zero unindexed foreign keys
--   - Multi-tenant/role safety: Staff see only own requests/records and active directory
--   - Owner administers requests, leave, directory, and allowlist
--   - Immutable status transitions appended to request_status_events
--   - No medical diagnoses stored in operational leave or request tables
-- =============================================================================

-- =============================================================================
-- 1. Table Definitions
-- =============================================================================

-- 1.1 Request Types (configuration for roster requests & leave categories)
create table if not exists public.request_types (
  id bigint generated always as identity primary key,
  code text not null,
  label text not null,
  description text null,
  category text not null,
  requires_dates boolean not null default true,
  requires_shift_code boolean not null default false,
  max_days_per_request integer not null default 14,
  min_lead_days integer not null default 0,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint request_types_code_key unique (code),
  constraint request_types_code_chk check (btrim(code) <> '' and code = lower(btrim(code))),
  constraint request_types_label_chk check (btrim(label) <> ''),
  constraint request_types_category_chk check (
    category in ('leave', 'shift_preference', 'swap', 'administrative')
  ),
  constraint request_types_max_days_chk check (max_days_per_request between 1 and 365),
  constraint request_types_min_lead_chk check (min_lead_days >= 0)
);

comment on table public.request_types is
  'Configurable categories and constraints for workforce requests and leave.';

-- 1.2 Roster Requests (core staff request submissions)
create table if not exists public.roster_requests (
  id bigint generated always as identity primary key,
  public_id uuid not null default gen_random_uuid(),
  staff_id bigint not null references public.staff_directory(id) on delete restrict,
  request_type_id bigint not null references public.request_types(id) on delete restrict,
  period_start_date date null,
  start_date date not null,
  end_date date not null,
  requested_shift_code text null,
  reason_category text not null default 'personal',
  notes text null,
  status text not null default 'active',
  decision_reason text null,
  decided_at timestamptz null,
  decided_by uuid null references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  source_system text not null default 'native',
  legacy_source_id text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint roster_requests_public_id_key unique (public_id),
  constraint roster_requests_dates_order_chk check (end_date >= start_date),
  constraint roster_requests_reason_category_chk check (
    reason_category in ('personal', 'family', 'academic', 'operational', 'medical', 'other')
  ),
  constraint roster_requests_status_chk check (
    status in ('active', 'draft', 'submitted', 'approved', 'rejected', 'withdrawn', 'superseded')
  ),
  constraint roster_requests_source_system_chk check (
    source_system in ('native', 'legacy_sheets')
  ),
  constraint roster_requests_decision_timestamp_chk check (
    (status in ('approved', 'rejected') and decided_at is not null and decided_by is not null)
    or (status not in ('approved', 'rejected'))
  )
);

comment on table public.roster_requests is
  'Staff roster requests and leave applications. Does not store confidential clinical diagnoses.';

-- 1.3 Request Status Events (immutable append-only lifecycle transitions)
create table if not exists public.request_status_events (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.roster_requests(id) on delete cascade,
  actor_auth_user_id uuid null references auth.users(id) on delete set null,
  actor_staff_id bigint null references public.staff_directory(id) on delete set null,
  previous_status text null,
  new_status text not null,
  reason text null,
  created_at timestamptz not null default now(),
  constraint request_status_events_status_chk check (
    new_status in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn', 'superseded')
  )
);

comment on table public.request_status_events is
  'Append-only audit trail of roster request status transitions.';

-- 1.4 Leave Records (administrative absence ledger)
create table if not exists public.leave_records (
  id bigint generated always as identity primary key,
  staff_id bigint not null references public.staff_directory(id) on delete restrict,
  request_id bigint null references public.roster_requests(id) on delete set null,
  start_date date not null,
  end_date date not null,
  leave_type text not null,
  status text not null default 'approved',
  approved_by uuid null references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),
  operational_note text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint leave_records_dates_order_chk check (end_date >= start_date),
  constraint leave_records_type_chk check (
    leave_type in ('annual', 'emergency', 'cme', 'unpaid', 'maternity', 'paternity', 'hospitalization', 'other')
  ),
  constraint leave_records_status_chk check (
    status in ('pending', 'approved', 'cancelled')
  )
);

comment on table public.leave_records is
  'Administrative staff leave ledger. Pure operational dates and types; diagnostic details strictly omitted.';

-- 1.5 Record Type Definitions (professional credentials catalog)
create table if not exists public.record_type_definitions (
  id bigint generated always as identity primary key,
  code text not null,
  label text not null,
  issuer_type text not null,
  requires_reference_number boolean not null default true,
  requires_expiry boolean not null default true,
  default_validity_years integer null,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint record_type_definitions_code_key unique (code),
  constraint record_type_definitions_code_chk check (btrim(code) <> '' and code = lower(btrim(code))),
  constraint record_type_definitions_label_chk check (btrim(label) <> ''),
  constraint record_type_definitions_issuer_type_chk check (
    issuer_type in ('statutory', 'professional_body', 'institution', 'hospital')
  ),
  constraint record_type_definitions_validity_chk check (
    default_validity_years is null or default_validity_years between 1 and 10
  )
);

comment on table public.record_type_definitions is
  'Catalog of professional credentials, certifications, and licenses.';

-- 1.6 Professional Records (staff credentials and certifications)
create table if not exists public.professional_records (
  id bigint generated always as identity primary key,
  staff_id bigint not null references public.staff_directory(id) on delete restrict,
  record_type_id bigint not null references public.record_type_definitions(id) on delete restrict,
  title text not null,
  issuer text not null,
  reference_number text null,
  issue_date date null,
  expiry_date date null,
  status text not null default 'current',
  verification_status text not null default 'unverified',
  verified_by uuid null references auth.users(id) on delete set null,
  verified_at timestamptz null,
  verification_notes text null,
  source_system text not null default 'native',
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint professional_records_title_chk check (btrim(title) <> ''),
  constraint professional_records_issuer_chk check (btrim(issuer) <> ''),
  constraint professional_records_dates_chk check (
    expiry_date is null or issue_date is null or expiry_date >= issue_date
  ),
  constraint professional_records_status_chk check (
    status in ('draft', 'current', 'expired', 'superseded', 'cancelled')
  ),
  constraint professional_records_verification_status_chk check (
    verification_status in ('unverified', 'pending_review', 'verified', 'rejected')
  ),
  constraint professional_records_source_system_chk check (
    source_system in ('native', 'legacy_sheets')
  )
);

comment on table public.professional_records is
  'Staff professional qualifications, APC registrations, and resuscitation certifications.';

-- 1.7 Public Holidays (statutory calendar)
create table if not exists public.public_holidays (
  id bigint generated always as identity primary key,
  holiday_date date not null,
  name text not null,
  jurisdiction text not null default 'federal_and_selangor',
  is_state_specific boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint public_holidays_holiday_date_key unique (holiday_date),
  constraint public_holidays_name_chk check (btrim(name) <> '')
);

comment on table public.public_holidays is
  'Statutory Malaysian public holidays for roster planning.';

-- =============================================================================
-- 2. Indexes for Foreign Keys and Query Performance
-- =============================================================================

-- Request Types
create index request_types_category_sort_idx
  on public.request_types (category, sort_order)
  where active = true;
create index request_types_created_by_idx
  on public.request_types (created_by);
create index request_types_updated_by_idx
  on public.request_types (updated_by);

-- Roster Requests
create index roster_requests_staff_id_idx
  on public.roster_requests (staff_id, start_date desc);
create index roster_requests_request_type_id_idx
  on public.roster_requests (request_type_id);
create index roster_requests_status_period_idx
  on public.roster_requests (status, period_start_date);
create index roster_requests_decided_by_idx
  on public.roster_requests (decided_by);
create index roster_requests_created_by_idx
  on public.roster_requests (created_by);
create index roster_requests_updated_by_idx
  on public.roster_requests (updated_by);

-- Request Status Events
create index request_status_events_request_id_idx
  on public.request_status_events (request_id, created_at desc);
create index request_status_events_actor_auth_user_id_idx
  on public.request_status_events (actor_auth_user_id);
create index request_status_events_actor_staff_id_idx
  on public.request_status_events (actor_staff_id);

-- Leave Records
create index leave_records_staff_dates_idx
  on public.leave_records (staff_id, start_date desc);
create index leave_records_request_id_idx
  on public.leave_records (request_id);
create index leave_records_approved_by_idx
  on public.leave_records (approved_by);
create index leave_records_created_by_idx
  on public.leave_records (created_by);
create index leave_records_updated_by_idx
  on public.leave_records (updated_by);

-- Record Type Definitions
create index record_type_definitions_sort_idx
  on public.record_type_definitions (sort_order)
  where active = true;
create index record_type_definitions_created_by_idx
  on public.record_type_definitions (created_by);
create index record_type_definitions_updated_by_idx
  on public.record_type_definitions (updated_by);

-- Professional Records
create index professional_records_staff_type_idx
  on public.professional_records (staff_id, record_type_id, expiry_date desc);
create index professional_records_record_type_id_idx
  on public.professional_records (record_type_id);
create index professional_records_verified_by_idx
  on public.professional_records (verified_by);
create index professional_records_created_by_idx
  on public.professional_records (created_by);
create index professional_records_updated_by_idx
  on public.professional_records (updated_by);

-- Public Holidays
create index public_holidays_date_idx
  on public.public_holidays (holiday_date);
create index public_holidays_created_by_idx
  on public.public_holidays (created_by);

-- =============================================================================
-- 3. Row Level Security Policies
-- =============================================================================

alter table public.request_types enable row level security;
alter table public.roster_requests enable row level security;
alter table public.request_status_events enable row level security;
alter table public.leave_records enable row level security;
alter table public.record_type_definitions enable row level security;
alter table public.professional_records enable row level security;
alter table public.public_holidays enable row level security;

-- 3.1 Request Types Policies
-- Active staff and owner can read active request types; owner manages all
create policy "request_types_select"
  on public.request_types
  for select
  to authenticated
  using (
    (active = true and private.is_active_approved_user())
    or private.is_active_owner()
  );

create policy "request_types_insert_owner"
  on public.request_types
  for insert
  to authenticated
  with check (private.is_active_owner());

create policy "request_types_update_owner"
  on public.request_types
  for update
  to authenticated
  using (private.is_active_owner())
  with check (private.is_active_owner());

create policy "request_types_delete_owner"
  on public.request_types
  for delete
  to authenticated
  using (private.is_active_owner());

-- 3.2 Roster Requests Policies
-- Staff can read own requests or active/submitted/approved requests on the calendar; Owner can read all
create policy "roster_requests_select"
  on public.roster_requests
  for select
  to authenticated
  using (
    private.is_active_owner()
    or (
      private.is_active_approved_user()
      and (
        staff_id = private.current_active_staff_id()
        or status in ('active', 'submitted', 'approved')
      )
    )
  );

-- Staff can insert own requests; Owner can insert any
create policy "roster_requests_insert"
  on public.roster_requests
  for insert
  to authenticated
  with check (
    private.is_active_owner()
    or (
      private.is_active_approved_user()
      and staff_id = private.current_active_staff_id()
      and status in ('active', 'draft', 'submitted')
    )
  );

-- Staff can update own active/draft/submitted requests; Owner can manage all
create policy "roster_requests_update"
  on public.roster_requests
  for update
  to authenticated
  using (
    private.is_active_owner()
    or (
      private.is_active_approved_user()
      and staff_id = private.current_active_staff_id()
      and status in ('active', 'draft', 'submitted')
    )
  )
  with check (
    private.is_active_owner()
    or (
      private.is_active_approved_user()
      and staff_id = private.current_active_staff_id()
      and status in ('active', 'draft', 'submitted', 'withdrawn', 'superseded')
    )
  );

-- Direct deletion of active/draft/submitted requests by owner or author
create policy "roster_requests_delete"
  on public.roster_requests
  for delete
  to authenticated
  using (
    private.is_active_owner()
    or (
      private.is_active_approved_user()
      and staff_id = private.current_active_staff_id()
      and status in ('active', 'draft', 'submitted')
    )
  );

-- 3.3 Request Status Events Policies
-- Staff can read events for own requests; Owner can read all
create policy "request_status_events_select"
  on public.request_status_events
  for select
  to authenticated
  using (
    private.is_active_owner()
    or exists (
      select 1
      from public.roster_requests rr
      where rr.id = request_status_events.request_id
        and rr.staff_id = private.current_active_staff_id()
    )
  );

-- Events are inserted via trigger or owner; direct client mutations restricted
create policy "request_status_events_insert"
  on public.request_status_events
  for insert
  to authenticated
  with check (
    private.is_active_owner()
    or exists (
      select 1
      from public.roster_requests rr
      where rr.id = request_status_events.request_id
        and rr.staff_id = private.current_active_staff_id()
    )
  );

-- 3.4 Leave Records Policies
-- Staff can read own leave records; Owner manages all
create policy "leave_records_select"
  on public.leave_records
  for select
  to authenticated
  using (
    (staff_id = private.current_active_staff_id())
    or private.is_active_owner()
  );

create policy "leave_records_insert_owner"
  on public.leave_records
  for insert
  to authenticated
  with check (private.is_active_owner());

create policy "leave_records_update_owner"
  on public.leave_records
  for update
  to authenticated
  using (private.is_active_owner())
  with check (private.is_active_owner());

create policy "leave_records_delete_owner"
  on public.leave_records
  for delete
  to authenticated
  using (private.is_active_owner());

-- 3.5 Record Type Definitions Policies
create policy "record_type_definitions_select"
  on public.record_type_definitions
  for select
  to authenticated
  using (
    (active = true and private.is_active_approved_user())
    or private.is_active_owner()
  );

create policy "record_type_definitions_insert_owner"
  on public.record_type_definitions
  for insert
  to authenticated
  with check (private.is_active_owner());

create policy "record_type_definitions_update_owner"
  on public.record_type_definitions
  for update
  to authenticated
  using (private.is_active_owner())
  with check (private.is_active_owner());

create policy "record_type_definitions_delete_owner"
  on public.record_type_definitions
  for delete
  to authenticated
  using (private.is_active_owner());

-- 3.6 Professional Records Policies
-- Staff can read own; Owner can read all
create policy "professional_records_select"
  on public.professional_records
  for select
  to authenticated
  using (
    (staff_id = private.current_active_staff_id())
    or private.is_active_owner()
  );

create policy "professional_records_insert"
  on public.professional_records
  for insert
  to authenticated
  with check (
    (
      staff_id = private.current_active_staff_id()
      and verification_status = 'unverified'
      and private.is_active_approved_user()
    )
    or private.is_active_owner()
  );

create policy "professional_records_update"
  on public.professional_records
  for update
  to authenticated
  using (
    (staff_id = private.current_active_staff_id() and verification_status = 'unverified')
    or private.is_active_owner()
  )
  with check (
    (
      staff_id = private.current_active_staff_id()
      and verification_status in ('unverified', 'pending_review')
    )
    or private.is_active_owner()
  );

create policy "professional_records_delete"
  on public.professional_records
  for delete
  to authenticated
  using (
    (staff_id = private.current_active_staff_id() and verification_status = 'unverified')
    or private.is_active_owner()
  );

-- 3.7 Public Holidays Policies
create policy "public_holidays_select"
  on public.public_holidays
  for select
  to authenticated
  using (private.is_active_approved_user() or private.is_active_owner());

create policy "public_holidays_insert_owner"
  on public.public_holidays
  for insert
  to authenticated
  with check (private.is_active_owner());

create policy "public_holidays_update_owner"
  on public.public_holidays
  for update
  to authenticated
  using (private.is_active_owner())
  with check (private.is_active_owner());

create policy "public_holidays_delete_owner"
  on public.public_holidays
  for delete
  to authenticated
  using (private.is_active_owner());

-- =============================================================================
-- 4. Triggers & Automated Lifecycle Auditing
-- =============================================================================

-- 4.1 Trigger to log status transitions on roster_requests
create or replace function private.trg_roster_request_status_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.request_status_events (
      request_id,
      actor_auth_user_id,
      actor_staff_id,
      previous_status,
      new_status,
      reason
    ) values (
      new.id,
      (select auth.uid()),
      private.current_active_staff_id(),
      null,
      new.status,
      'Initial submission'
    );
  elsif (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    insert into public.request_status_events (
      request_id,
      actor_auth_user_id,
      actor_staff_id,
      previous_status,
      new_status,
      reason
    ) values (
      new.id,
      (select auth.uid()),
      private.current_active_staff_id(),
      old.status,
      new.status,
      coalesce(new.decision_reason, 'Status changed')
    );
  end if;
  return new;
end;
$$;

revoke all on function private.trg_roster_request_status_audit() from public, anon, authenticated;

drop trigger if exists trg_roster_requests_status_event on public.roster_requests;
create trigger trg_roster_requests_status_event
  after insert or update on public.roster_requests
  for each row execute function private.trg_roster_request_status_audit();

-- 4.2 Auto-update updated_at timestamp trigger function
create or replace function private.trg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;

revoke all on function private.trg_set_updated_at() from public, anon, authenticated;

create trigger trg_request_types_updated_at
  before update on public.request_types
  for each row execute function private.trg_set_updated_at();

create trigger trg_roster_requests_updated_at
  before update on public.roster_requests
  for each row execute function private.trg_set_updated_at();

create trigger trg_leave_records_updated_at
  before update on public.leave_records
  for each row execute function private.trg_set_updated_at();

create trigger trg_record_type_definitions_updated_at
  before update on public.record_type_definitions
  for each row execute function private.trg_set_updated_at();

create trigger trg_professional_records_updated_at
  before update on public.professional_records
  for each row execute function private.trg_set_updated_at();

-- =============================================================================
-- 5. Privileged Procedures (`public` RPCs for Owner & Staff)
-- =============================================================================

-- 5.1 Decide Roster Request (Owner only, creates leave record when approved)
create or replace function public.decide_roster_request(
  p_request_id bigint,
  p_decision text,
  p_decision_reason text default null
)
returns public.roster_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.roster_requests%rowtype;
  v_req_type public.request_types%rowtype;
begin
  if not private.is_active_owner() then
    raise exception 'Unauthorized: Only an active owner may decide roster requests.'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision: must be approved or rejected.'
      using errcode = '22023';
  end if;

  select * into v_req
  from public.roster_requests
  where id = p_request_id;

  if not found then
    raise exception 'Roster request % not found.', p_request_id
      using errcode = 'P0002';
  end if;

  if v_req.status in ('approved', 'rejected', 'withdrawn') then
    raise exception 'Request % cannot be decided because it is currently in state %.', p_request_id, v_req.status
      using errcode = '22000';
  end if;

  update public.roster_requests
  set status = p_decision,
      decided_at = now(),
      decided_by = (select auth.uid()),
      decision_reason = btrim(p_decision_reason)
  where id = p_request_id
  returning * into v_req;

  -- If approved and category is leave, create corresponding administrative leave record
  select * into v_req_type
  from public.request_types
  where id = v_req.request_type_id;

  if (p_decision = 'approved' and v_req_type.category = 'leave') then
    insert into public.leave_records (
      staff_id,
      request_id,
      start_date,
      end_date,
      leave_type,
      status,
      approved_by,
      approved_at,
      operational_note
    ) values (
      v_req.staff_id,
      v_req.id,
      v_req.start_date,
      v_req.end_date,
      case
        when v_req_type.code in ('annual_leave', 'emergency_leave', 'cme_leave') then
          replace(v_req_type.code, '_leave', '')
        else 'other'
      end,
      'approved',
      (select auth.uid()),
      now(),
      coalesce(p_decision_reason, 'Approved roster request #' || v_req.id::text)
    );
  end if;

  perform private.append_audit_event(
    p_actor_auth_user_id := (select auth.uid()),
    p_actor_staff_id := private.current_active_staff_id(),
    p_action := 'request.decided',
    p_entity_type := 'roster_requests',
    p_entity_id := p_request_id::text,
    p_operation_id := null,
    p_before_summary := jsonb_build_object('status', 'submitted'),
    p_after_summary := jsonb_build_object('status', p_decision, 'decision_reason', p_decision_reason),
    p_reason := p_decision_reason
  );

  return v_req;
end;
$$;

revoke all on function public.decide_roster_request(bigint, text, text) from public, anon;
grant execute on function public.decide_roster_request(bigint, text, text) to authenticated, service_role;

-- 5.2 Admin Create & Link Staff Member (Owner only)
create or replace function public.admin_create_staff_member(
  p_email text,
  p_role text,
  p_staff_code text,
  p_roster_name text,
  p_display_name text,
  p_staff_group text,
  p_phone text default null,
  p_registration_number text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id bigint;
  v_normalized_email extensions.citext;
  v_existing_allowed_id bigint;
begin
  if not private.is_active_owner() then
    raise exception 'Unauthorized: Only an active owner may create staff members.'
      using errcode = '42501';
  end if;

  v_normalized_email := lower(btrim(p_email))::extensions.citext;

  if p_role not in ('owner', 'staff') then
    raise exception 'Invalid role: must be owner or staff.'
      using errcode = '22023';
  end if;

  -- 1. Create or retrieve operational staff directory record
  insert into public.staff_directory (
    staff_code,
    roster_name,
    display_name,
    staff_group,
    employment_status,
    active,
    created_by,
    updated_by
  ) values (
    btrim(p_staff_code),
    btrim(p_roster_name),
    btrim(p_display_name),
    btrim(p_staff_group),
    'active',
    true,
    (select auth.uid()),
    (select auth.uid())
  )
  returning id into v_staff_id;

  -- 2. Create corresponding staff profile
  insert into public.staff_profiles (
    staff_id,
    full_name,
    email,
    phone,
    registration_number,
    verification_status,
    created_by,
    updated_by
  ) values (
    v_staff_id,
    btrim(p_display_name),
    v_normalized_email,
    nullif(btrim(p_phone), ''),
    nullif(btrim(p_registration_number), ''),
    'unverified',
    (select auth.uid()),
    (select auth.uid())
  );

  -- 3. Upsert allowlist entry
  select id into v_existing_allowed_id
  from public.allowed_users
  where email = v_normalized_email;

  if found then
    update public.allowed_users
    set staff_id = v_staff_id,
        role = p_role,
        updated_at = now(),
        updated_by = (select auth.uid())
    where id = v_existing_allowed_id;
  else
    insert into public.allowed_users (
      email,
      role,
      status,
      staff_id,
      invited_by,
      created_by,
      updated_by
    ) values (
      v_normalized_email,
      p_role,
      'invited',
      v_staff_id,
      (select auth.uid()),
      (select auth.uid()),
      (select auth.uid())
    );
  end if;

  perform private.append_audit_event(
    p_actor_auth_user_id := (select auth.uid()),
    p_actor_staff_id := private.current_active_staff_id(),
    p_action := 'staff.created',
    p_entity_type := 'staff_directory',
    p_entity_id := v_staff_id::text,
    p_operation_id := null,
    p_before_summary := null,
    p_after_summary := jsonb_build_object('staff_code', p_staff_code, 'email', private.mask_email(v_normalized_email::text)),
    p_reason := 'Owner invited and registered new staff member'
  );

  return v_staff_id;
end;
$$;

revoke all on function public.admin_create_staff_member(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_staff_member(text, text, text, text, text, text, text, text) to authenticated, service_role;

-- 5.3 Admin Update Allowlist Status (Owner only)
create or replace function public.admin_update_allowlist_status(
  p_allowed_user_id bigint,
  p_new_status text,
  p_reason text default null
)
returns public.allowed_users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.allowed_users%rowtype;
  v_old_status text;
begin
  if not private.is_active_owner() then
    raise exception 'Unauthorized: Only an active owner may update allowlist status.'
      using errcode = '42501';
  end if;

  if p_new_status not in ('active', 'suspended', 'revoked') then
    raise exception 'Invalid status: must be active, suspended, or revoked.'
      using errcode = '22023';
  end if;

  select * into v_user
  from public.allowed_users
  where id = p_allowed_user_id;

  if not found then
    raise exception 'Allowed user % not found.', p_allowed_user_id
      using errcode = 'P0002';
  end if;

  if (v_user.role = 'owner' and p_new_status in ('suspended', 'revoked')) then
    raise exception 'Cannot suspend or revoke the active owner account.'
      using errcode = '22000';
  end if;

  v_old_status := v_user.status;

  update public.allowed_users
  set status = p_new_status,
      activated_at = case when p_new_status = 'active' and activated_at is null then now() else activated_at end,
      revoked_at = case when p_new_status = 'revoked' then now() else null end,
      revoked_by = case when p_new_status = 'revoked' then (select auth.uid()) else null end,
      revocation_reason = case when p_new_status = 'revoked' then btrim(p_reason) else null end,
      updated_at = now(),
      updated_by = (select auth.uid())
  where id = p_allowed_user_id
  returning * into v_user;

  perform private.append_audit_event(
    p_actor_auth_user_id := (select auth.uid()),
    p_actor_staff_id := private.current_active_staff_id(),
    p_action := 'allowlist.' || p_new_status,
    p_entity_type := 'allowed_users',
    p_entity_id := p_allowed_user_id::text,
    p_operation_id := null,
    p_before_summary := jsonb_build_object('status', v_old_status),
    p_after_summary := jsonb_build_object('status', p_new_status),
    p_reason := p_reason
  );

  return v_user;
end;
$$;

revoke all on function public.admin_update_allowlist_status(bigint, text, text) from public, anon;
grant execute on function public.admin_update_allowlist_status(bigint, text, text) to authenticated, service_role;

-- =============================================================================
-- 6. Canonical Seed Data
-- =============================================================================

-- 6.1 Request Types
insert into public.request_types (code, label, description, category, requires_dates, requires_shift_code, max_days_per_request, min_lead_days, active, sort_order)
values
  ('off', 'OFF', 'Day Off', 'shift_preference', true, false, 1, 0, true, 1),
  ('am', 'AM', 'Morning Shift', 'shift_preference', true, false, 1, 0, true, 2),
  ('pm', 'PM', 'Evening Shift', 'shift_preference', true, false, 1, 0, true, 3),
  ('on', 'ON', 'Night Shift', 'shift_preference', true, false, 1, 0, true, 4),
  ('al', 'AL', 'Annual Leave', 'leave', true, false, 1, 0, true, 5),
  ('hka', 'HKA', 'Gantian HKA', 'leave', true, false, 1, 0, true, 6),
  ('ghka', 'GHKA', 'Gantian HKA', 'leave', true, false, 1, 0, true, 7),
  ('course', 'COURSE', 'CME / Training Course', 'leave', true, false, 1, 0, true, 8),
  ('annual_leave', 'Annual Leave', 'Planned annual leave quota for Medical Officers and staff', 'leave', true, false, 14, 14, true, 10),
  ('preferred_off', 'Preferred Day Off', 'Preferred non-duty rest day request', 'shift_preference', true, false, 2, 7, true, 20),
  ('cme_leave', 'CME / Conference Leave', 'Approved continuous medical education, courses or exams', 'leave', true, false, 7, 14, true, 30),
  ('shift_swap', 'Mutual Shift Swap', 'Mutual shift exchange with an agreed colleague', 'swap', true, true, 1, 2, true, 40),
  ('emergency_leave', 'Emergency / Compassionate Leave', 'Unplanned emergency absence', 'leave', true, false, 3, 0, true, 50)
on conflict (code) do nothing;

-- 6.2 Record Type Definitions
insert into public.record_type_definitions (code, label, issuer_type, requires_reference_number, requires_expiry, default_validity_years, sort_order, active)
values
  ('apc', 'Annual Practicing Certificate (APC)', 'statutory', true, true, 1, 10, true),
  ('full_mmc_registration', 'MMC Full Medical Registration', 'statutory', true, false, null, 20, true),
  ('bls', 'Basic Life Support (BLS)', 'professional_body', true, true, 2, 30, true),
  ('acls', 'Advanced Cardiac Life Support (ACLS)', 'professional_body', true, true, 2, 40, true),
  ('atls', 'Advanced Trauma Life Support (ATLS)', 'professional_body', true, true, 4, 50, true)
on conflict (code) do nothing;

-- 6.3 Public Holidays (2026/2027 Core Malaysian Federal & Selangor)
insert into public.public_holidays (holiday_date, name, jurisdiction, is_state_specific)
values
  ('2026-12-25', 'Christmas Day', 'federal_and_selangor', false),
  ('2027-01-01', 'New Year''s Day', 'federal_and_selangor', false),
  ('2027-01-22', 'Thaipusam', 'federal_and_selangor', true),
  ('2027-02-06', 'Chinese New Year (Day 1)', 'federal_and_selangor', false),
  ('2027-02-07', 'Chinese New Year (Day 2)', 'federal_and_selangor', false),
  ('2027-03-10', 'Hari Raya Aidilfitri (Day 1)', 'federal_and_selangor', false),
  ('2027-03-11', 'Hari Raya Aidilfitri (Day 2)', 'federal_and_selangor', false),
  ('2027-05-01', 'Labour Day', 'federal_and_selangor', false),
  ('2027-05-20', 'Wesak Day', 'federal_and_selangor', false),
  ('2027-06-07', 'Agong''s Birthday', 'federal_and_selangor', false),
  ('2027-08-31', 'National Day (Merdeka)', 'federal_and_selangor', false),
  ('2027-09-16', 'Malaysia Day', 'federal_and_selangor', false),
  ('2027-10-29', 'Deepavali', 'federal_and_selangor', false),
  ('2027-12-25', 'Christmas Day', 'federal_and_selangor', false)
on conflict (holiday_date) do nothing;

-- 6.4 Auto-link launch owner if staff_directory record is not yet present
do $$
declare
  v_owner_record public.allowed_users%rowtype;
  v_staff_id bigint;
begin
  select * into v_owner_record
  from public.allowed_users
  where role = 'owner' and status = 'active' and staff_id is null
  limit 1;

  if found then
    insert into public.staff_directory (
      staff_code,
      roster_name,
      display_name,
      staff_group,
      employment_status,
      active
    ) values (
      'MO-ADMIN',
      'Dr Afif',
      'Dr Muhammad Afif',
      'Emergency Physician',
      'active',
      true
    ) returning id into v_staff_id;

    insert into public.staff_profiles (
      staff_id,
      auth_user_id,
      full_name,
      email,
      phone,
      registration_number,
      verification_status
    ) values (
      v_staff_id,
      v_owner_record.auth_user_id,
      'Dr Muhammad Afif',
      v_owner_record.email,
      null,
      null,
      'verified'
    );

    update public.allowed_users
    set staff_id = v_staff_id
    where id = v_owner_record.id;
  end if;
end;
$$;
