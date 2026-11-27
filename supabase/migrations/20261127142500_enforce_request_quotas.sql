-- =============================================================================
-- Migration: Enforce request daily, monthly, and weekend quotas server-side
-- in submit_roster_request (while preserving owner/admin override).
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
  v_is_owner boolean;
  v_clean_code text;
  v_clean_notes text;
  v_request_type_id bigint;
  v_existing public.roster_requests%rowtype;
  v_result public.roster_requests%rowtype;
  v_rule_config jsonb;
  v_window_open boolean;
  v_cutoff_day integer;
  v_today_day integer;
  v_current_ym text;
  v_override_ym text;
  v_daily_off_limit integer;
  v_on1_daily_limit integer;
  v_monthly_limit integer;
  v_weekend_limit integer;
  v_off_group_codes text[] := array['OFF', 'GOFF', 'AL', 'MC', 'EL', 'HKA', 'GHKA', 'COURSE'];
  v_is_off_group boolean;
  v_is_weekend boolean;
  v_daily_usage integer;
  v_monthly_usage integer;
  v_weekend_usage integer;
  v_month_start date;
  v_month_end date;
begin
  v_is_owner := (select private.is_active_owner());

  if not v_is_owner then
    select coalesce(rv.config, '{}'::jsonb)
    into v_rule_config
    from public.rule_versions rv
    where rv.status = 'active'
    order by rv.version desc, rv.id desc
    limit 1;

    v_window_open := coalesce((v_rule_config->>'request_window_open')::boolean, true);
    v_cutoff_day := coalesce((v_rule_config->>'request_cutoff_day')::integer, 25);
    v_today_day := extract(day from (now() at time zone 'Asia/Kuala_Lumpur'))::integer;
    v_current_ym := to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM');
    v_override_ym := nullif(trim(coalesce(v_rule_config->>'request_window_override_month', '')), '');

    if not v_window_open or (v_today_day > v_cutoff_day and coalesce(v_override_ym, '') <> v_current_ym) then
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
  end if;

  -- Serialize concurrent submissions for the same target date before checking quotas
  perform pg_advisory_xact_lock(hashtext('roster_request_date:' || p_request_date::text));

  if not v_is_owner then
    v_daily_off_limit := coalesce((v_rule_config->>'request_daily_off_limit')::integer, 3);
    v_on1_daily_limit := coalesce((v_rule_config->>'request_on1_daily_limit')::integer, 1);
    v_monthly_limit := coalesce((v_rule_config->>'request_monthly_limit')::integer, 10);
    v_weekend_limit := coalesce((v_rule_config->>'request_weekend_limit')::integer, 4);

    v_is_off_group := v_clean_code = any(v_off_group_codes);
    v_is_weekend := extract(dow from p_request_date) in (0, 6);
    v_month_start := date_trunc('month', p_request_date)::date;
    v_month_end := (date_trunc('month', p_request_date) + interval '1 month')::date;

    -- 1. Daily group limit (OFF / Leave or ON1 Night Duty)
    if v_is_off_group then
      select count(*)::integer
      into v_daily_usage
      from public.roster_requests rr
      where rr.start_date = p_request_date
        and rr.status in ('active', 'submitted', 'approved')
        and upper(coalesce(rr.requested_shift_code, 'OFF')) = any(v_off_group_codes)
        and (p_edit_request_id is null or rr.id <> p_edit_request_id)
        and not (
          rr.staff_id = p_staff_id
          and rr.start_date = p_request_date
          and rr.status in ('active', 'submitted')
        );

      if v_daily_usage >= v_daily_off_limit then
        raise exception 'Limit reached for group ''OFF / Leave'' (% slots) on this date.', v_daily_off_limit
          using errcode = 'P0001';
      end if;
    elsif v_clean_code = 'ON1' then
      select count(*)::integer
      into v_daily_usage
      from public.roster_requests rr
      where rr.start_date = p_request_date
        and rr.status in ('active', 'submitted', 'approved')
        and upper(coalesce(rr.requested_shift_code, '')) = 'ON1'
        and (p_edit_request_id is null or rr.id <> p_edit_request_id)
        and not (
          rr.staff_id = p_staff_id
          and rr.start_date = p_request_date
          and rr.status in ('active', 'submitted')
        );

      if v_daily_usage >= v_on1_daily_limit then
        raise exception 'Limit reached for group ''ON1 Night Duty'' (% slots) on this date.', v_on1_daily_limit
          using errcode = 'P0001';
      end if;
    end if;

    -- 2. Monthly total limit
    select count(*)::integer
    into v_monthly_usage
    from public.roster_requests rr
    where rr.staff_id = p_staff_id
      and rr.status in ('active', 'submitted', 'approved')
      and rr.start_date >= v_month_start
      and rr.start_date < v_month_end
      and (p_edit_request_id is null or rr.id <> p_edit_request_id)
      and not (
        rr.staff_id = p_staff_id
        and rr.start_date = p_request_date
        and rr.status in ('active', 'submitted')
      );

    if v_monthly_usage >= v_monthly_limit then
      raise exception 'Monthly request limit reached (% requests allowed per month).', v_monthly_limit
        using errcode = 'P0001';
    end if;

    -- 3. Monthly weekend leave limit
    if v_is_weekend and v_is_off_group then
      select count(*)::integer
      into v_weekend_usage
      from public.roster_requests rr
      where rr.staff_id = p_staff_id
        and rr.status in ('active', 'submitted', 'approved')
        and rr.start_date >= v_month_start
        and rr.start_date < v_month_end
        and extract(dow from rr.start_date) in (0, 6)
        and upper(coalesce(rr.requested_shift_code, 'OFF')) = any(v_off_group_codes)
        and (p_edit_request_id is null or rr.id <> p_edit_request_id)
        and not (
          rr.staff_id = p_staff_id
          and rr.start_date = p_request_date
          and rr.status in ('active', 'submitted')
        );

      if v_weekend_usage >= v_weekend_limit then
        raise exception 'Monthly weekend leave limit reached (% weekend leave requests allowed per month).', v_weekend_limit
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- Shift or date changed on edit: supersede the edited request
  if p_edit_request_id is not null then
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
