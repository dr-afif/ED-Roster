-- =============================================================================
-- Migration: Enforce request submission window & cutoff day in submit_roster_request
-- =============================================================================

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
  v_rule_config jsonb;
  v_window_open boolean;
  v_cutoff_day integer;
  v_today_day integer;
begin
  if not (select private.is_active_owner()) then
    select coalesce(rv.config, '{}'::jsonb)
    into v_rule_config
    from public.rule_versions rv
    where rv.status = 'active'
    order by rv.version desc, rv.id desc
    limit 1;

    v_window_open := coalesce((v_rule_config->>'request_window_open')::boolean, true);
    v_cutoff_day := coalesce((v_rule_config->>'request_cutoff_day')::integer, 25);
    v_today_day := extract(day from (now() at time zone 'Asia/Kuala_Lumpur'))::integer;

    if not v_window_open or v_today_day > v_cutoff_day then
      raise exception 'Request submission window is currently closed.'
        using errcode = '42501';
    end if;
  end if;

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
