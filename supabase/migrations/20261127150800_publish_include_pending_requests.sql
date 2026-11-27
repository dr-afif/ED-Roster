-- =============================================================================
-- Migration: Snapshot unassigned active/submitted/approved roster_requests
-- into roster_planned_assignments when publishing a draft roster period.
-- =============================================================================

create or replace function public.publish_roster_period(
    p_period_id bigint,
    p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
    v_period record;
    v_publication_id uuid;
    v_next_version integer;
    v_draft_count integer;
    v_request_count integer;
    v_total_count integer;
    v_data_hash text;
begin
    -- 1. Enforce Owner role
    if not private.is_active_owner() then
        raise exception 'Access denied: Sole Roster Administrator role required to publish rosters.';
    end if;

    -- 2. Verify period existence and status
    select * into v_period
    from public.roster_periods
    where id = p_period_id;

    if not found then
        raise exception 'Roster period % not found.', p_period_id;
    end if;

    if v_period.status <> 'draft' then
        raise exception 'Only draft roster periods can be published. Current status is "%".', v_period.status;
    end if;

    -- 3. Verify that draft assignments or pending requests exist
    select count(*) into v_draft_count
    from public.roster_draft_assignments
    where period_id = p_period_id;

    select count(*) into v_request_count
    from (
        select distinct on (rr.staff_id, rr.start_date)
            rr.staff_id,
            rr.start_date
        from public.roster_requests rr
        join public.shift_definitions sd
          on sd.code = upper(trim(coalesce(rr.requested_shift_code, 'OFF')))
        where rr.status in ('active', 'submitted', 'approved')
          and rr.start_date >= v_period.period_start
          and rr.start_date <= v_period.period_end
          and not exists (
              select 1
              from public.roster_draft_assignments rda
              where rda.period_id = p_period_id
                and rda.staff_id = rr.staff_id
                and rda.duty_date = rr.start_date
          )
        order by rr.staff_id, rr.start_date, rr.submitted_at desc, rr.id desc
    ) pending_reqs;

    v_total_count := v_draft_count + v_request_count;

    if v_total_count = 0 then
        raise exception 'Cannot publish empty roster. Please assign shifts before publishing.';
    end if;

    -- 4. Calculate next publication version
    select coalesce(max(publication_version), 0) + 1 into v_next_version
    from public.roster_publications
    where period_id = p_period_id;

    -- 5. Calculate data hash
    v_data_hash := md5(concat('period:', p_period_id, ':rev:', v_period.revision, ':count:', v_total_count, ':ts:', now()));

    -- 6. Insert immutable publication record
    insert into public.roster_publications (
        period_id,
        publication_version,
        period_revision,
        rule_version_id,
        canonical_data_hash,
        notes,
        published_by
    )
    values (
        p_period_id,
        v_next_version,
        v_period.revision + 1,
        v_period.active_rule_version_id,
        v_data_hash,
        p_notes,
        auth.uid()
    )
    returning id into v_publication_id;

    -- 7a. Snapshot explicit draft assignments into immutable planned assignments
    insert into public.roster_planned_assignments (
        publication_id,
        period_id,
        staff_id,
        duty_date,
        shift_code,
        cell_note
    )
    select
        v_publication_id,
        period_id,
        staff_id,
        duty_date,
        shift_code,
        cell_note
    from public.roster_draft_assignments
    where period_id = p_period_id;

    -- 7b. Snapshot unassigned pending requests into immutable planned assignments
    insert into public.roster_planned_assignments (
        publication_id,
        period_id,
        staff_id,
        duty_date,
        shift_code,
        cell_note
    )
    select distinct on (rr.staff_id, rr.start_date)
        v_publication_id,
        p_period_id,
        rr.staff_id,
        rr.start_date,
        upper(trim(coalesce(rr.requested_shift_code, 'OFF'))),
        null
    from public.roster_requests rr
    join public.shift_definitions sd
      on sd.code = upper(trim(coalesce(rr.requested_shift_code, 'OFF')))
    where rr.status in ('active', 'submitted', 'approved')
      and rr.start_date >= v_period.period_start
      and rr.start_date <= v_period.period_end
      and not exists (
          select 1
          from public.roster_draft_assignments rda
          where rda.period_id = p_period_id
            and rda.staff_id = rr.staff_id
            and rda.duty_date = rr.start_date
      )
    order by rr.staff_id, rr.start_date, rr.submitted_at desc, rr.id desc;

    -- 8. Update period status to published
    update public.roster_periods
    set
        status = 'published',
        revision = revision + 1,
        published_at = now(),
        published_by = auth.uid(),
        updated_at = now()
    where id = p_period_id;

    -- 9. Append audit log
    insert into public.audit_events (
        action,
        actor_auth_user_id,
        entity_type,
        entity_id,
        reason,
        after_summary
    )
    values (
        'roster_published',
        auth.uid(),
        'roster_periods',
        p_period_id::text,
        coalesce(p_notes, 'Official roster publication'),
        jsonb_build_object('publication_id', v_publication_id, 'version', v_next_version, 'assignment_count', v_total_count)
    );

    return v_publication_id;
end;
$$;
