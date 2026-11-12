-- =============================================================================
-- Migration: Public Holiday & GHKA Tracker Schema
-- Tables: ph_opening_balances, ph_memo_submissions
-- Data: Expanded 2025 & 2026 Selangor/Federal Public Holidays
-- RPCs: admin_upsert_ph_opening_balance, toggle_ph_memo_status
-- =============================================================================

-- 1. Insert 2025 and 2026 Selangor and Federal Public Holidays
insert into public.public_holidays (holiday_date, name, jurisdiction, is_state_specific)
values
  -- 2025
  ('2025-01-01', 'New Year''s Day', 'federal_and_selangor', false),
  ('2025-01-29', 'Chinese New Year (Day 1)', 'federal_and_selangor', false),
  ('2025-01-30', 'Chinese New Year (Day 2)', 'federal_and_selangor', false),
  ('2025-02-11', 'Thaipusam', 'federal_and_selangor', true),
  ('2025-03-18', 'Nuzul Al-Quran', 'federal_and_selangor', true),
  ('2025-03-31', 'Hari Raya Aidilfitri (Day 1)', 'federal_and_selangor', false),
  ('2025-04-01', 'Hari Raya Aidilfitri (Day 2)', 'federal_and_selangor', false),
  ('2025-05-01', 'Labour Day', 'federal_and_selangor', false),
  ('2025-05-12', 'Wesak Day', 'federal_and_selangor', false),
  ('2025-06-02', 'Agong''s Birthday', 'federal_and_selangor', false),
  ('2025-06-07', 'Hari Raya Haji', 'federal_and_selangor', false),
  ('2025-06-27', 'Awal Muharram', 'federal_and_selangor', false),
  ('2025-08-31', 'National Day', 'federal_and_selangor', false),
  ('2025-09-01', 'National Day Replacement', 'federal_and_selangor', false),
  ('2025-09-05', 'Maulidur Rasul', 'federal_and_selangor', false),
  ('2025-09-15', 'Hari Kelepasan Am Tambahan (Hari Malaysia Replacement)', 'federal_and_selangor', false),
  ('2025-09-16', 'Malaysia Day', 'federal_and_selangor', false),
  ('2025-10-20', 'Deepavali', 'federal_and_selangor', false),
  ('2025-12-11', 'Sultan of Selangor''s Birthday', 'federal_and_selangor', true),
  ('2025-12-25', 'Christmas Day', 'federal_and_selangor', false),

  -- 2026
  ('2026-01-01', 'New Year''s Day', 'federal_and_selangor', false),
  ('2026-02-01', 'Thaipusam', 'federal_and_selangor', true),
  ('2026-02-02', 'Thaipusam Holiday', 'federal_and_selangor', true),
  ('2026-02-17', 'Chinese New Year (Day 1)', 'federal_and_selangor', false),
  ('2026-02-18', 'Chinese New Year (Day 2)', 'federal_and_selangor', false),
  ('2026-03-07', 'Nuzul Al-Quran', 'federal_and_selangor', true),
  ('2026-03-20', 'Hari Raya Aidilfitri Holiday', 'federal_and_selangor', false),
  ('2026-03-21', 'Hari Raya Aidilfitri (Day 1)', 'federal_and_selangor', false),
  ('2026-03-22', 'Hari Raya Aidilfitri (Day 2)', 'federal_and_selangor', false),
  ('2026-03-23', 'Hari Raya Aidilfitri Holiday', 'federal_and_selangor', false),
  ('2026-05-01', 'Labour Day', 'federal_and_selangor', false),
  ('2026-05-27', 'Hari Raya Haji', 'federal_and_selangor', false),
  ('2026-05-31', 'Wesak Day', 'federal_and_selangor', false),
  ('2026-06-01', 'Agong''s Birthday', 'federal_and_selangor', false),
  ('2026-06-02', 'Wesak Day Holiday', 'federal_and_selangor', false),
  ('2026-06-17', 'Awal Muharram', 'federal_and_selangor', false),
  ('2026-08-25', 'Maulidur Rasul', 'federal_and_selangor', false),
  ('2026-08-31', 'National Day', 'federal_and_selangor', false),
  ('2026-09-01', 'Cuti Peristiwa Khas SUKMA 2026', 'selangor', true),
  ('2026-09-16', 'Malaysia Day', 'federal_and_selangor', false),
  ('2026-10-25', 'Cuti Peristiwa Jubli Perak 25 Tahun Sultan Selangor', 'selangor', true),
  ('2026-11-08', 'Deepavali', 'federal_and_selangor', false),
  ('2026-11-09', 'Deepavali Holiday', 'federal_and_selangor', false),
  ('2026-12-11', 'Sultan of Selangor''s Birthday', 'federal_and_selangor', true)
on conflict (holiday_date) do update
set name = excluded.name,
    jurisdiction = excluded.jurisdiction,
    is_state_specific = excluded.is_state_specific;

-- 2. Opening Balances for GHKA Tracker
create table if not exists public.ph_opening_balances (
  id bigint generated always as identity primary key,
  staff_id bigint not null references public.staff_directory(id) on delete cascade,
  year int not null check (year >= 2020 and year <= 2050),
  opening_balance int not null default 0 check (opening_balance >= 0),
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint ph_opening_balances_staff_year_key unique (staff_id, year)
);

create index if not exists ph_opening_balances_staff_idx on public.ph_opening_balances(staff_id);
create index if not exists ph_opening_balances_year_idx on public.ph_opening_balances(year);

comment on table public.ph_opening_balances is 'Opening carry-forward GHKA balances per staff member and year.';

-- 3. Memo Submission Tracking for GHKA Replacements
create table if not exists public.ph_memo_submissions (
  id bigint generated always as identity primary key,
  staff_id bigint not null references public.staff_directory(id) on delete cascade,
  holiday_date date null,
  replacement_date date not null,
  memo_month text not null,
  is_submitted boolean not null default true,
  submitted_at timestamptz null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ph_memo_submissions_staff_rep_date_key unique (staff_id, replacement_date)
);

create index if not exists ph_memo_submissions_staff_idx on public.ph_memo_submissions(staff_id);
create index if not exists ph_memo_submissions_month_idx on public.ph_memo_submissions(memo_month);

comment on table public.ph_memo_submissions is 'Tracks submission status of official GHKA claim memos.';

-- 4. Enable Row Level Security (RLS)
alter table public.ph_opening_balances enable row level security;
alter table public.ph_memo_submissions enable row level security;

-- Opening Balances Policies
create policy "ph_opening_balances_select_authenticated"
  on public.ph_opening_balances for select
  to authenticated
  using (true);

create policy "ph_opening_balances_owner_all"
  on public.ph_opening_balances for all
  to authenticated
  using ((select private.is_active_owner()))
  with check ((select private.is_active_owner()));

-- Memo Submissions Policies
create policy "ph_memo_submissions_select_authenticated"
  on public.ph_memo_submissions for select
  to authenticated
  using (true);

create policy "ph_memo_submissions_staff_insert"
  on public.ph_memo_submissions for insert
  to authenticated
  with check (
    staff_id = (select private.current_active_staff_id())
    or (select private.is_active_owner())
  );

create policy "ph_memo_submissions_staff_update"
  on public.ph_memo_submissions for update
  to authenticated
  using (
    staff_id = (select private.current_active_staff_id())
    or (select private.is_active_owner())
  )
  with check (
    staff_id = (select private.current_active_staff_id())
    or (select private.is_active_owner())
  );

create policy "ph_memo_submissions_staff_delete"
  on public.ph_memo_submissions for delete
  to authenticated
  using (
    staff_id = (select private.current_active_staff_id())
    or (select private.is_active_owner())
  );

-- 5. RPC: Admin Upsert Opening Balance
create or replace function public.admin_upsert_ph_opening_balance(
  p_staff_id bigint,
  p_year int,
  p_balance int,
  p_note text default null
)
returns public.ph_opening_balances
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_res public.ph_opening_balances;
begin
  if not private.is_active_owner() then
    raise exception 'Unauthorized: Only an active owner may update opening balances.'
      using errcode = '42501';
  end if;

  insert into public.ph_opening_balances (
    staff_id,
    year,
    opening_balance,
    note,
    updated_at,
    updated_by
  )
  values (
    p_staff_id,
    p_year,
    p_balance,
    p_note,
    now(),
    (select auth.uid())
  )
  on conflict (staff_id, year) do update
  set opening_balance = excluded.opening_balance,
      note = excluded.note,
      updated_at = now(),
      updated_by = (select auth.uid())
  returning * into v_res;

  return v_res;
end;
$$;

revoke all on function public.admin_upsert_ph_opening_balance(bigint, int, int, text) from public, anon, authenticated;
grant execute on function public.admin_upsert_ph_opening_balance(bigint, int, int, text) to authenticated, service_role;

-- 6. RPC: Toggle / Set Memo Status
create or replace function public.toggle_ph_memo_status(
  p_staff_id bigint,
  p_replacement_date date,
  p_holiday_date date default null,
  p_memo_month text default '',
  p_is_submitted boolean default true
)
returns public.ph_memo_submissions
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_res public.ph_memo_submissions;
  v_curr_staff_id bigint;
begin
  v_curr_staff_id := (select private.current_active_staff_id());

  if not (private.is_active_owner() or v_curr_staff_id = p_staff_id) then
    raise exception 'Unauthorized: Cannot toggle memo status for another staff member.'
      using errcode = '42501';
  end if;

  insert into public.ph_memo_submissions (
    staff_id,
    holiday_date,
    replacement_date,
    memo_month,
    is_submitted,
    submitted_at,
    updated_at
  )
  values (
    p_staff_id,
    p_holiday_date,
    p_replacement_date,
    coalesce(nullif(p_memo_month, ''), to_char(p_replacement_date, 'YYYY-MM')),
    p_is_submitted,
    case when p_is_submitted then now() else null end,
    now()
  )
  on conflict (staff_id, replacement_date) do update
  set is_submitted = excluded.is_submitted,
      holiday_date = coalesce(excluded.holiday_date, public.ph_memo_submissions.holiday_date),
      submitted_at = case when excluded.is_submitted then now() else null end,
      updated_at = now()
  returning * into v_res;

  return v_res;
end;
$$;

revoke all on function public.toggle_ph_memo_status(bigint, date, date, text, boolean) from public, anon, authenticated;
grant execute on function public.toggle_ph_memo_status(bigint, date, date, text, boolean) to authenticated, service_role;
