-- Fair request queue & audit-preserving replacement RPC
-- 1. Deduplicate any pre-existing multiple active/submitted/approved requests
--    for the same (staff_id, start_date), keeping the most recent one active.
with ranked as (
  select
    id,
    row_number() over (
      partition by staff_id, start_date
      order by submitted_at desc, id desc
    ) as rn
  from public.roster_requests
  where status in ('active', 'submitted', 'approved')
)
update public.roster_requests rr
set
  status = 'superseded',
  decision_reason = 'Deduplicated during unique active request migration'
from ranked r
where rr.id = r.id
  and r.rn > 1;

-- 2. Enforce at most one active/submitted/approved request per staff member per date
create unique index if not exists roster_requests_one_active_per_staff_date_idx
  on public.roster_requests (staff_id, start_date)
  where status in ('active', 'submitted', 'approved');

-- 3. Atomic RPC to submit, replace, or edit a roster request:
--    - Comment-only edits update notes in-place (preserving submitted_at & id queue position).
--    - Shift/date edits or new submissions on a date with an existing active request
--      supersede the older row (preserving audit trail) and insert a new row with
--      submitted_at = now() so it enters at the end of the queue.
create or replace function public.submit_roster_request(
  p_staff_id bigint,
  p_request_date date,
  p_requested_shift_code text,
  p_notes text default null,
  p_edit_request_id bigint default null
)
returns public.roster_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_clean_code text;
  v_clean_notes text;
  v_request_type_id bigint;
  v_existing public.roster_requests%rowtype;
  v_result public.roster_requests%rowtype;
begin
  v_clean_code := upper(trim(coalesce(p_requested_shift_code, 'OFF')));
  if v_clean_code = '' then
    v_clean_code := 'OFF';
  end if;
  v_clean_notes := nullif(trim(coalesce(p_notes, '')), '');

  select rt.id
  into v_request_type_id
  from public.request_types rt
  where rt.active = true
    and lower(rt.code) = lower(v_clean_code)
  limit 1;

  if v_request_type_id is null then
    select rt.id
    into v_request_type_id
    from public.request_types rt
    where rt.active = true
    order by rt.id asc
    limit 1;
  end if;

  if v_request_type_id is null then
    raise exception 'No valid request type configured in system.';
  end if;

  if p_edit_request_id is not null then
    select *
    into v_existing
    from public.roster_requests rr
    where rr.id = p_edit_request_id;

    if not found then
      raise exception 'Request not found.';
    end if;

    -- Comment-only edit: update in-place so submitted_at and id queue position stay intact
    if v_existing.start_date = p_request_date
       and upper(coalesce(v_existing.requested_shift_code, '')) = v_clean_code then
      update public.roster_requests
      set
        notes = v_clean_notes,
        updated_by = (select auth.uid())
      where id = p_edit_request_id
      returning * into v_result;

      return v_result;
    end if;

    -- Shift or date changed: supersede the edited request
    update public.roster_requests
    set
      status = 'superseded',
      decision_reason = 'Replaced by edited request',
      updated_by = (select auth.uid())
    where id = p_edit_request_id
      and status in ('active', 'draft', 'submitted');
  end if;

  -- Supersede any existing active/submitted request by the same staff on the target date
  update public.roster_requests
  set
    status = 'superseded',
    decision_reason = 'Superseded by newer request',
    updated_by = (select auth.uid())
  where staff_id = p_staff_id
    and start_date = p_request_date
    and status in ('active', 'submitted')
    and (p_edit_request_id is null or id <> p_edit_request_id);

  insert into public.roster_requests (
    staff_id,
    start_date,
    end_date,
    requested_shift_code,
    request_type_id,
    notes,
    status,
    submitted_at,
    created_by,
    updated_by
  )
  values (
    p_staff_id,
    p_request_date,
    p_request_date,
    v_clean_code,
    v_request_type_id,
    v_clean_notes,
    'active',
    now(),
    (select auth.uid()),
    (select auth.uid())
  )
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.submit_roster_request(bigint, date, text, text, bigint) to authenticated;
