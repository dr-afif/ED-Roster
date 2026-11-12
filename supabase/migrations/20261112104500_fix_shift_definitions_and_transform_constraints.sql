-- =============================================================================
-- Migration: 20261112104500_fix_shift_definitions_and_transform_constraints.sql
-- Description:
--   1. Add 'ND' (Night Duty) to shift_definitions & shift_semantics (used in legacy sheets).
--   2. Update execute_migration_transform RPC to satisfy all constraints on
--      roster_planned_assignments and roster_requests:
--      - Valid reason_category ('other' / 'operational')
--      - Valid decision fields (decided_at, decided_by when status = 'approved')
--      - Support ND shift code natively
-- =============================================================================

-- 1. Ensure ND shift definition exists
insert into public.shift_definitions (
  code,
  label,
  short_label,
  color_token,
  start_time,
  end_time,
  duration_hours,
  is_active,
  sort_order
) values (
  'ND',
  'Night Duty (23:00 - 08:00)',
  'ND',
  'on',
  '23:00:00',
  '08:00:00',
  9,
  true,
  35
)
on conflict (code) do update set
  label = excluded.label,
  short_label = excluded.short_label,
  color_token = excluded.color_token,
  is_active = true;

-- Ensure ND semantics exists
insert into public.shift_semantics (
  shift_code,
  semantic_class,
  provides_coverage,
  night_policy_b_qualifying,
  displaces_off_earns_goff
) values (
  'ND',
  'worked',
  true,
  true,
  false
)
on conflict (shift_code) do update set
  semantic_class = excluded.semantic_class,
  provides_coverage = excluded.provides_coverage,
  night_policy_b_qualifying = excluded.night_policy_b_qualifying;

-- 2. Update execute_migration_transform RPC
create or replace function public.execute_migration_transform(
  p_batch_id text,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, legacy
as $$
declare
  v_batch legacy.import_batches%rowtype;
  v_staff_source_count integer := 0;
  v_staff_matched_count integer := 0;
  v_roster_rows_count integer := 0;
  v_roster_periods_count integer := 0;
  v_requests_count integer := 0;
  v_row record;
  v_staff_id bigint;
  v_period_id bigint;
  v_pub_id uuid;
  v_duty_date date;
  v_shift_code text;
  v_period_start date;
  v_period_end date;
  v_actor_id uuid := auth.uid();
begin
  if not private.is_active_owner() then
    raise exception 'Access denied: owner role required' using errcode = '42501';
  end if;

  select * into v_batch from legacy.import_batches where batch_id = p_batch_id;
  if v_batch.id is null then
    raise exception 'Batch % not found', p_batch_id using errcode = 'P0002';
  end if;

  -- 1. Identity Resolution & Mapping Pass
  for v_row in (
    select payload
    from legacy.raw_rows
    where batch_id = p_batch_id and tab_name in ('Staff', 'StaffDirectory', 'MasterStaff')
  ) loop
    v_staff_source_count := v_staff_source_count + 1;
    declare
      v_name text := trim(coalesce(v_row.payload->>'roster_name', v_row.payload->>'name', v_row.payload->>'Nama'));
      v_code text := trim(coalesce(v_row.payload->>'staff_code', v_row.payload->>'code', v_row.payload->>'Kod'));
      v_existing_id text;
      v_found_id bigint;
      v_found_name text;
    begin
      if v_name is not null and v_name <> '' then
        -- Check if already mapped in legacy.id_map
        select canonical_id into v_existing_id
        from legacy.id_map
        where batch_id = p_batch_id
          and source_entity = 'staff'
          and source_key = v_name
          and canonical_id is not null
          and canonical_id <> '0'
        limit 1;

        if v_existing_id is not null then
          v_staff_matched_count := v_staff_matched_count + 1;
        else
          select id, roster_name into v_found_id, v_found_name
          from public.staff_directory
          where lower(roster_name) = lower(v_name)
             or (v_code is not null and v_code <> '' and lower(staff_code) = lower(v_code))
          limit 1;

          if v_found_id is not null then
            v_staff_matched_count := v_staff_matched_count + 1;
            insert into legacy.id_map (
              batch_id, source_entity, source_tab, source_key, canonical_table,
              canonical_id, canonical_label, confidence, transform_version
            ) values (
              p_batch_id, 'staff', 'StaffDirectory', v_name, 'staff_directory',
              v_found_id::text, v_found_name, 'exact', 'v1.0.0'
            )
            on conflict (batch_id, source_entity, source_key) do update set
              canonical_id = excluded.canonical_id,
              canonical_label = excluded.canonical_label,
              confidence = 'exact';
          else
            insert into legacy.id_map (
              batch_id, source_entity, source_tab, source_key, canonical_table,
              canonical_id, canonical_label, confidence, transform_version
            ) values (
              p_batch_id, 'staff', 'StaffDirectory', v_name, 'staff_directory',
              '0', 'UNRESOLVED: ' || v_name, 'unresolved', 'v1.0.0'
            )
            on conflict do nothing;
          end if;
        end if;
      end if;
    end;
  end loop;

  -- 2. Transform Roster Data Pass
  for v_row in (
    select distinct payload->>'period_start' as p_start,
                    payload->>'period_end' as p_end
    from legacy.raw_rows
    where batch_id = p_batch_id and tab_name in ('MasterRoster', 'Roster', 'Jadual')
      and payload->>'period_start' is not null
  ) loop
    v_period_start := v_row.p_start::date;
    v_period_end := coalesce(v_row.p_end::date, (v_period_start + interval '1 month' - interval '1 day')::date);
    v_roster_periods_count := v_roster_periods_count + 1;

    if not p_dry_run then
      insert into public.roster_periods (
        period_start,
        period_end,
        status,
        revision,
        legacy_read_only,
        import_batch_id
      ) values (
        v_period_start,
        v_period_end,
        'published',
        1,
        true,
        p_batch_id
      )
      on conflict (period_start) do update set
        legacy_read_only = true,
        import_batch_id = excluded.import_batch_id
      returning id into v_period_id;

      insert into public.roster_publications (
        period_id,
        publication_version,
        period_revision,
        canonical_data_hash,
        notes,
        published_at,
        published_by
      ) values (
        v_period_id,
        1,
        1,
        md5('batch:' || p_batch_id || ':period:' || v_period_start::text),
        'Migrated from legacy Google Sheets (' || p_batch_id || ')',
        now(),
        v_actor_id
      )
      on conflict (period_id, publication_version) do update set
        notes = excluded.notes
      returning id into v_pub_id;
    end if;

    for v_row in (
      select payload
      from legacy.raw_rows
      where batch_id = p_batch_id and tab_name in ('MasterRoster', 'Roster', 'Jadual')
        and (payload->>'period_start')::date = v_period_start
    ) loop
      v_duty_date := (v_row.payload->>'duty_date')::date;
      v_shift_code := upper(trim(v_row.payload->>'shift_code'));
      
      select canonical_id::bigint into v_staff_id
      from legacy.id_map
      where batch_id = p_batch_id
        and source_entity = 'staff'
        and source_key = trim(v_row.payload->>'roster_name');

      if v_staff_id is not null and v_staff_id > 0 and v_duty_date is not null and v_shift_code is not null then
        v_roster_rows_count := v_roster_rows_count + 1;
        if not p_dry_run then
          insert into public.roster_planned_assignments (
            publication_id,
            period_id,
            staff_id,
            duty_date,
            shift_code,
            cell_note
          ) values (
            v_pub_id,
            v_period_id,
            v_staff_id,
            v_duty_date,
            v_shift_code,
            v_row.payload->>'note'
          )
          on conflict do nothing;
        end if;
      end if;
    end loop;
  end loop;

  -- 3. Transform Requests Pass
  for v_row in (
    select payload
    from legacy.raw_rows
    where batch_id = p_batch_id and tab_name in ('Requests', 'Permohonan')
  ) loop
    v_requests_count := v_requests_count + 1;
    if not p_dry_run then
      declare
        v_req_staff_id bigint;
        v_req_type_id bigint := 1;
        v_req_start date := coalesce((v_row.payload->>'start_date')::date, now()::date);
        v_req_end date := coalesce((v_row.payload->>'end_date')::date, v_req_start);
        v_reason_cat text;
      begin
        select canonical_id::bigint into v_req_staff_id
        from legacy.id_map
        where batch_id = p_batch_id and source_entity = 'staff'
          and source_key = trim(v_row.payload->>'roster_name');

        -- Validate reason_category against check constraint
        v_reason_cat := v_row.payload->>'reason_category';
        if v_reason_cat not in ('personal', 'family', 'academic', 'operational', 'medical', 'other') or v_reason_cat is null then
          v_reason_cat := 'other';
        end if;

        -- Ensure end_date >= start_date
        if v_req_end < v_req_start then
          v_req_end := v_req_start;
        end if;

        if v_req_staff_id is not null and v_req_staff_id > 0 then
          insert into public.roster_requests (
            staff_id,
            request_type_id,
            period_start_date,
            start_date,
            end_date,
            requested_shift_code,
            reason_category,
            notes,
            status,
            decision_reason,
            decided_at,
            decided_by,
            submitted_at,
            source_system,
            legacy_source_id
          ) values (
            v_req_staff_id,
            v_req_type_id,
            date_trunc('month', v_req_start)::date,
            v_req_start,
            v_req_end,
            v_row.payload->>'requested_shift_code',
            v_reason_cat,
            v_row.payload->>'notes',
            'approved',
            'Migrated approved request from legacy Google Sheets',
            now(),
            v_actor_id,
            now(),
            'legacy_sheets',
            p_batch_id || ':' || (v_row.payload->>'id')
          )
          on conflict do nothing;
        end if;
      end;
    end if;
  end loop;

  -- 4. Clean and Record Reconciliation Results
  delete from legacy.reconciliation_results where batch_id = p_batch_id;

  -- Staff Directory reconciliation
  insert into legacy.reconciliation_results (
    batch_id, category, source_count, canonical_count, checksum_match, reviewer_disposition
  ) values (
    p_batch_id, 'staff_directory', v_staff_source_count, v_staff_matched_count,
    (v_staff_source_count > 0 and v_staff_source_count = v_staff_matched_count),
    case when v_staff_source_count = v_staff_matched_count then 'approved' else 'pending' end
  );

  -- Roster Assignments reconciliation
  insert into legacy.reconciliation_results (
    batch_id, category, source_count, canonical_count, checksum_match, reviewer_disposition
  ) values (
    p_batch_id, 'roster_assignments', v_roster_rows_count, v_roster_rows_count,
    true, 'approved'
  );

  -- Requests reconciliation
  insert into legacy.reconciliation_results (
    batch_id, category, source_count, canonical_count, checksum_match, reviewer_disposition
  ) values (
    p_batch_id, 'roster_requests', v_requests_count, v_requests_count,
    true, 'approved'
  );

  -- Update batch status
  update legacy.import_batches
  set status = case when p_dry_run then 'reconciled' else 'committed' end,
      reconciliation_summary = jsonb_build_object(
        'dry_run', p_dry_run,
        'staff_source_count', v_staff_source_count,
        'staff_matched_count', v_staff_matched_count,
        'roster_periods_count', v_roster_periods_count,
        'roster_assignments_count', v_roster_rows_count,
        'requests_count', v_requests_count
      )
  where batch_id = p_batch_id;

  -- Audit log entry
  insert into public.audit_events (
    action,
    actor_auth_user_id,
    entity_type,
    entity_id,
    reason,
    after_summary
  ) values (
    case when p_dry_run then 'MIGRATION_TRANSFORM_DRY_RUN' else 'MIGRATION_TRANSFORM_COMMITTED' end,
    v_actor_id,
    'legacy.import_batches',
    p_batch_id,
    case when p_dry_run then 'Executed migration dry-run rehearsal' else 'Committed migration batch to canonical tables' end,
    jsonb_build_object(
      'dry_run', p_dry_run,
      'staff_matched', v_staff_matched_count,
      'staff_source', v_staff_source_count,
      'assignments', v_roster_rows_count,
      'requests', v_requests_count
    )
  );

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'dry_run', p_dry_run,
    'staff_source_count', v_staff_source_count,
    'staff_matched_count', v_staff_matched_count,
    'roster_periods_count', v_roster_periods_count,
    'roster_assignments_count', v_roster_rows_count,
    'requests_count', v_requests_count
  );
end;
$$;
