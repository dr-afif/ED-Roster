create table if not exists public.staff_service_periods (
  id bigint generated always as identity primary key,
  staff_id bigint not null references public.staff_directory(id) on delete cascade,
  start_date date not null,
  end_date date null,
  end_reason text null,
  end_comment text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_service_periods_dates_chk check ((end_date is null) or (end_date >= start_date)),
  constraint staff_service_periods_end_reason_check check (
    (end_reason is null) or (
      end_reason = any (array[
        'switched_department'::text,
        'masters_program'::text,
        'quit_hospital'::text,
        'transferred_hospital'::text,
        'extended_leave'::text,
        'other'::text
      ])
    )
  )
);

create index if not exists idx_staff_service_periods_staff_id
  on public.staff_service_periods using btree (staff_id);

alter table public.staff_service_periods enable row level security;

drop policy if exists staff_service_periods_select_approved on public.staff_service_periods;
create policy staff_service_periods_select_approved
  on public.staff_service_periods
  for select
  to authenticated
  using (
    (select private.is_active_owner() as is_active_owner)
    or (select private.is_active_approved_user() as is_active_approved_user)
  );

drop policy if exists staff_service_periods_write_owner on public.staff_service_periods;
create policy staff_service_periods_write_owner
  on public.staff_service_periods
  for all
  to authenticated
  using ((select private.is_active_owner() as is_active_owner))
  with check ((select private.is_active_owner() as is_active_owner));

insert into public.staff_service_periods (staff_id, start_date, end_date, end_reason, end_comment)
select
  sd.id,
  sd.start_date,
  sd.end_date,
  case
    when sd.end_date is not null then 'other'
    else null
  end,
  null
from public.staff_directory sd
where sd.start_date is not null
  and not exists (
    select 1 from public.staff_service_periods ssp where ssp.staff_id = sd.id
  );
