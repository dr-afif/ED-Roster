-- Migration: Wave D Roster Rules Engine, Versioned Configuration & Draft Workspace
-- Idempotent schema, RLS policies, and canonical seed data for ED-Roster

-- 1. SHIFT DEFINITIONS
create table if not exists public.shift_definitions (
    code text primary key,
    label text not null,
    short_label text not null,
    color_token text not null,
    sort_order integer not null default 100,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.shift_definitions is 'Canonical shift types, labels, color tokens and sorting order.';

-- 2. SHIFT SEMANTICS
create table if not exists public.shift_semantics (
    shift_code text primary key references public.shift_definitions(code) on update cascade on delete cascade,
    semantic_class text not null check (semantic_class in ('worked', 'transparent', 'reset', 'unknown')),
    provides_coverage boolean not null default false,
    night_policy_b_qualifying boolean not null default false,
    displaces_off_earns_goff boolean not null default false,
    modifier_inheritance text not null default 'inherit' check (modifier_inheritance in ('inherit', 'override', 'ignore')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.shift_semantics is 'Deterministic classification for weekly OFF, night sequences, consecutive work and staffing coverage.';

-- 3. RULE SETS
create table if not exists public.rule_sets (
    id text primary key,
    name text not null,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.rule_sets is 'Stable rule families for emergency department roster planning.';

-- 4. RULE VERSIONS
create table if not exists public.rule_versions (
    id bigint generated always as identity primary key,
    rule_set_id text not null references public.rule_sets(id) on update cascade on delete restrict,
    version integer not null,
    status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
    effective_from date not null,
    effective_to date,
    config jsonb not null,
    config_hash text not null,
    change_summary text not null,
    created_by uuid references auth.users(id),
    approved_at timestamptz,
    created_at timestamptz not null default now(),
    constraint rule_versions_unique_set_ver unique (rule_set_id, version)
);

comment on table public.rule_versions is 'Immutable versioned parameter configurations for deterministic roster rules.';

-- 5. STAFFING THRESHOLDS
create table if not exists public.staffing_thresholds (
    id bigint generated always as identity primary key,
    rule_version_id bigint not null references public.rule_versions(id) on delete cascade,
    day_type text not null check (day_type in ('weekday', 'weekend', 'holiday')),
    shift_bucket text not null check (shift_bucket in ('am', 'pm', 'night', 'total')),
    min_staff integer not null default 0,
    target_staff integer not null default 0,
    created_at timestamptz not null default now(),
    constraint staffing_thresholds_unique unique (rule_version_id, day_type, shift_bucket)
);

comment on table public.staffing_thresholds is 'Effective-dated minimum and target staffing counts per bucket and day type.';

-- 6. ROSTER PERIODS
create table if not exists public.roster_periods (
    id bigint generated always as identity primary key,
    period_start date not null unique check (extract(day from period_start) = 1),
    period_end date not null,
    status text not null default 'draft' check (status in ('draft', 'published', 'amended', 'closed')),
    revision bigint not null default 0,
    active_rule_version_id bigint references public.rule_versions(id),
    published_at timestamptz,
    published_by uuid references auth.users(id),
    closed_at timestamptz,
    closed_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.roster_periods is 'Monthly roster period lifecycle container anchored to the 1st of the month.';

-- 7. ROSTER DRAFT ASSIGNMENTS
create table if not exists public.roster_draft_assignments (
    id bigint generated always as identity primary key,
    period_id bigint not null references public.roster_periods(id) on delete cascade,
    staff_id bigint not null references public.staff_directory(id) on delete cascade,
    duty_date date not null,
    shift_code text not null references public.shift_definitions(code) on update cascade,
    cell_note text,
    row_revision bigint not null default 0,
    updated_by uuid references auth.users(id),
    updated_at timestamptz not null default now(),
    constraint draft_assignments_unique_cell unique (period_id, staff_id, duty_date)
);

comment on table public.roster_draft_assignments is 'Draft cell assignments editable only while period is in draft status.';

-- INDEXES
create index if not exists idx_shift_definitions_sort on public.shift_definitions(sort_order);
create index if not exists idx_rule_versions_lookup on public.rule_versions(rule_set_id, status, effective_from);
create index if not exists idx_staffing_thresholds_version on public.staffing_thresholds(rule_version_id);
create index if not exists idx_roster_periods_dates on public.roster_periods(period_start, period_end);
create index if not exists idx_draft_assignments_period on public.roster_draft_assignments(period_id, duty_date);
create index if not exists idx_draft_assignments_staff on public.roster_draft_assignments(staff_id, duty_date);

-- ROW LEVEL SECURITY
alter table public.shift_definitions enable row level security;
alter table public.shift_semantics enable row level security;
alter table public.rule_sets enable row level security;
alter table public.rule_versions enable row level security;
alter table public.staffing_thresholds enable row level security;
alter table public.roster_periods enable row level security;
alter table public.roster_draft_assignments enable row level security;

-- POLICIES: SHIFT DEFINITIONS & SEMANTICS
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shift_definitions' and policyname = 'shift_definitions_select') then
    create policy shift_definitions_select on public.shift_definitions for select to authenticated using (private.is_active_approved_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shift_definitions' and policyname = 'shift_definitions_admin_write') then
    create policy shift_definitions_admin_write on public.shift_definitions for all to authenticated using (private.is_active_owner()) with check (private.is_active_owner());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shift_semantics' and policyname = 'shift_semantics_select') then
    create policy shift_semantics_select on public.shift_semantics for select to authenticated using (private.is_active_approved_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shift_semantics' and policyname = 'shift_semantics_admin_write') then
    create policy shift_semantics_admin_write on public.shift_semantics for all to authenticated using (private.is_active_owner()) with check (private.is_active_owner());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rule_sets' and policyname = 'rule_sets_select') then
    create policy rule_sets_select on public.rule_sets for select to authenticated using (private.is_active_approved_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rule_sets' and policyname = 'rule_sets_admin_write') then
    create policy rule_sets_admin_write on public.rule_sets for all to authenticated using (private.is_active_owner()) with check (private.is_active_owner());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rule_versions' and policyname = 'rule_versions_select') then
    create policy rule_versions_select on public.rule_versions for select to authenticated using (private.is_active_approved_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rule_versions' and policyname = 'rule_versions_admin_write') then
    create policy rule_versions_admin_write on public.rule_versions for all to authenticated using (private.is_active_owner()) with check (private.is_active_owner());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'staffing_thresholds' and policyname = 'staffing_thresholds_select') then
    create policy staffing_thresholds_select on public.staffing_thresholds for select to authenticated using (private.is_active_approved_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'staffing_thresholds' and policyname = 'staffing_thresholds_admin_write') then
    create policy staffing_thresholds_admin_write on public.staffing_thresholds for all to authenticated using (private.is_active_owner()) with check (private.is_active_owner());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_periods' and policyname = 'roster_periods_select') then
    create policy roster_periods_select on public.roster_periods for select to authenticated using (private.is_active_approved_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_periods' and policyname = 'roster_periods_admin_write') then
    create policy roster_periods_admin_write on public.roster_periods for all to authenticated using (private.is_active_owner()) with check (private.is_active_owner());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_draft_assignments' and policyname = 'roster_draft_assignments_select') then
    create policy roster_draft_assignments_select on public.roster_draft_assignments for select to authenticated using (private.is_active_approved_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_draft_assignments' and policyname = 'roster_draft_assignments_admin_write') then
    create policy roster_draft_assignments_admin_write on public.roster_draft_assignments for all to authenticated using (private.is_active_owner()) with check (private.is_active_owner());
  end if;
end $$;

-- SEED CANONICAL SHIFT DEFINITIONS
insert into public.shift_definitions (code, label, short_label, color_token, sort_order)
values
  ('AM', 'Morning Shift (08:00 - 16:00)', 'AM', 'am', 10),
  ('PM', 'Evening Shift (16:00 - 23:00)', 'PM', 'pm', 20),
  ('ON', 'Night Duty (23:00 - 08:00)', 'ON', 'on', 30),
  ('ON1', 'Night Duty 1 (Bundle)', 'ON1', 'on', 31),
  ('ON2', 'Night Duty 2 (Bundle)', 'ON2', 'on', 32),
  ('NIGHT', 'Night Shift', 'NIGHT', 'on', 33),
  ('PN', 'Post Night (Transparent Rest)', 'PN', 'pn', 40),
  ('OFF', 'Rest Day (Weekly OFF)', 'OFF', 'off', 50),
  ('GOFF', 'Ganti OFF (Compensatory Rest)', 'GOFF', 'goff', 55),
  ('AL', 'Annual Leave', 'AL', 'al', 60),
  ('MC', 'Medical Certificate', 'MC', 'mc', 70),
  ('EL', 'Emergency Leave', 'EL', 'el', 75),
  ('HKA', 'Haji / Umrah / Special Leave', 'HKA', 'hka', 80),
  ('GHKA', 'Ganti HKA', 'GHKA', 'ghka', 85),
  ('COURSE', 'Official Training / Course', 'COURSE', 'course', 90)
on conflict (code) do update set
  label = excluded.label,
  short_label = excluded.short_label,
  color_token = excluded.color_token,
  sort_order = excluded.sort_order;

-- SEED SHIFT SEMANTICS
insert into public.shift_semantics (shift_code, semantic_class, provides_coverage, night_policy_b_qualifying, displaces_off_earns_goff)
values
  ('AM', 'worked', true, false, false),
  ('PM', 'worked', true, false, false),
  ('ON', 'worked', true, true, false),
  ('ON1', 'worked', true, true, false),
  ('ON2', 'worked', true, true, false),
  ('NIGHT', 'worked', true, true, false),
  ('PN', 'transparent', false, true, false),
  ('OFF', 'reset', false, false, false),
  ('GOFF', 'reset', false, false, false),
  ('AL', 'reset', false, false, false),
  ('MC', 'reset', false, false, false),
  ('EL', 'reset', false, false, false),
  ('HKA', 'reset', false, false, false),
  ('GHKA', 'reset', false, false, false),
  ('COURSE', 'reset', false, false, false)
on conflict (shift_code) do update set
  semantic_class = excluded.semantic_class,
  provides_coverage = excluded.provides_coverage,
  night_policy_b_qualifying = excluded.night_policy_b_qualifying,
  displaces_off_earns_goff = excluded.displaces_off_earns_goff;

-- SEED RULE SET
insert into public.rule_sets (id, name, description, is_active)
values (
  'ed_default',
  'Emergency Department Default Rules',
  'Standard Malaysian MOH ED scheduling policy with Policy-B weekly OFF and night bundle validation.',
  true
)
on conflict (id) do nothing;

-- SEED RULE VERSION 1 (Policy B, max 6 days, night sequence patterns)
insert into public.rule_versions (rule_set_id, version, status, effective_from, config, config_hash, change_summary, approved_at)
values (
  'ed_default',
  1,
  'active',
  '2026-01-01',
  '{
    "schema_version": 1,
    "weekly_off_policy": "policy_b",
    "max_consecutive_days": 6,
    "consecutive_warning_threshold": 7,
    "night_qualifying_codes": ["ON", "ON1", "ON2", "PN", "NIGHT"],
    "night_sequence_patterns": [
      ["ON1", "ON2", "PN"],
      ["ON1", "PN"],
      ["ON", "PN"],
      ["NIGHT", "PN"]
    ],
    "request_daily_off_limit": 3,
    "request_monthly_limit": 10,
    "request_weekend_limit": 4,
    "min_rest_hours_after_night": 24
  }'::jsonb,
  'sha256:v1-ed-default-baseline',
  'Initial baseline version with Policy B weekly OFF and Malaysian ED night bundle rules.',
  now()
)
on conflict (rule_set_id, version) do nothing;

-- SEED STAFFING THRESHOLDS FOR RULE VERSION 1
insert into public.staffing_thresholds (rule_version_id, day_type, shift_bucket, min_staff, target_staff)
select v.id, 'weekday', 'am', 6, 8 from public.rule_versions v where v.rule_set_id = 'ed_default' and v.version = 1
on conflict (rule_version_id, day_type, shift_bucket) do nothing;

insert into public.staffing_thresholds (rule_version_id, day_type, shift_bucket, min_staff, target_staff)
select v.id, 'weekday', 'pm', 6, 8 from public.rule_versions v where v.rule_set_id = 'ed_default' and v.version = 1
on conflict (rule_version_id, day_type, shift_bucket) do nothing;

insert into public.staffing_thresholds (rule_version_id, day_type, shift_bucket, min_staff, target_staff)
select v.id, 'weekday', 'night', 4, 5 from public.rule_versions v where v.rule_set_id = 'ed_default' and v.version = 1
on conflict (rule_version_id, day_type, shift_bucket) do nothing;

insert into public.staffing_thresholds (rule_version_id, day_type, shift_bucket, min_staff, target_staff)
select v.id, 'weekend', 'am', 5, 7 from public.rule_versions v where v.rule_set_id = 'ed_default' and v.version = 1
on conflict (rule_version_id, day_type, shift_bucket) do nothing;

insert into public.staffing_thresholds (rule_version_id, day_type, shift_bucket, min_staff, target_staff)
select v.id, 'weekend', 'pm', 5, 7 from public.rule_versions v where v.rule_set_id = 'ed_default' and v.version = 1
on conflict (rule_version_id, day_type, shift_bucket) do nothing;

insert into public.staffing_thresholds (rule_version_id, day_type, shift_bucket, min_staff, target_staff)
select v.id, 'weekend', 'night', 4, 4 from public.rule_versions v where v.rule_set_id = 'ed_default' and v.version = 1
on conflict (rule_version_id, day_type, shift_bucket) do nothing;

insert into public.staffing_thresholds (rule_version_id, day_type, shift_bucket, min_staff, target_staff)
select v.id, 'holiday', 'am', 5, 7 from public.rule_versions v where v.rule_set_id = 'ed_default' and v.version = 1
on conflict (rule_version_id, day_type, shift_bucket) do nothing;

insert into public.staffing_thresholds (rule_version_id, day_type, shift_bucket, min_staff, target_staff)
select v.id, 'holiday', 'pm', 5, 7 from public.rule_versions v where v.rule_set_id = 'ed_default' and v.version = 1
on conflict (rule_version_id, day_type, shift_bucket) do nothing;

insert into public.staffing_thresholds (rule_version_id, day_type, shift_bucket, min_staff, target_staff)
select v.id, 'holiday', 'night', 4, 4 from public.rule_versions v where v.rule_set_id = 'ed_default' and v.version = 1
on conflict (rule_version_id, day_type, shift_bucket) do nothing;

-- SEED JANUARY 2027 ROSTER PERIOD (Target first native roster)
insert into public.roster_periods (period_start, period_end, status, active_rule_version_id)
select '2027-01-01', '2027-01-31', 'draft', v.id
from public.rule_versions v
where v.rule_set_id = 'ed_default' and v.version = 1
on conflict (period_start) do nothing;
