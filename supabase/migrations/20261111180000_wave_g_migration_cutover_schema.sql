-- =============================================================================
-- Migration: 20261111180000_wave_g_migration_cutover_schema.sql
-- Workstream: Wave G — Google Sheets Migration Engine, Historical Rehearsal & Cutover Tooling
-- Blueprint references:
--   - MODULAR_APP_BLUEPRINT/03_DATA_MODEL.md (legacy schema & import evidence)
--   - MODULAR_APP_BLUEPRINT/04_SECURITY_AUTHORIZATION.md (owner-only migration boundary)
--   - MODULAR_APP_BLUEPRINT/09_MIGRATION_CUTOVER.md (pipeline, identity reconciliation & safety gates)
--   - MODULAR_APP_BLUEPRINT/decisions/ADR-002-sheets-import-not-dual-write.md
-- =============================================================================

-- 1. Ensure Legacy Schema & Extensions
create schema if not exists legacy;
revoke all on schema legacy from public, anon, authenticated;
grant usage on schema legacy to authenticated, service_role;

-- 2. Enhance Canonical Roster Periods with Migration Provenance
alter table public.roster_periods
  add column if not exists legacy_read_only boolean not null default false,
  add column if not exists import_batch_id text null;

create index if not exists idx_roster_periods_import_batch on public.roster_periods(import_batch_id);

-- =============================================================================
-- 3. Legacy Import Evidence Tables (legacy schema)
-- =============================================================================

-- 3.1 legacy.import_batches
-- Source spreadsheet ID, export timestamp, tab manifest, file hashes, importer version, status, and reconciliation summary.
create table if not exists legacy.import_batches (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null unique,
  source_spreadsheet_id text not null,
  source_label text not null default 'Google Sheets Master Workbook',
  export_timestamp timestamptz not null default now(),
  tab_manifest jsonb not null default '[]'::jsonb,
  file_hashes jsonb not null default '{}'::jsonb,
  importer_version text not null default 'v1.0.0',
  status text not null check (status in ('staged', 'validating', 'reconciled', 'committed', 'rolled_back')) default 'staged',
  reconciliation_summary jsonb not null default '{}'::jsonb,
  notes text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create index if not exists idx_legacy_import_batches_created on legacy.import_batches(created_at desc);

-- 3.2 legacy.raw_rows
-- Batch ID, sheet/tab name, 1-based source row number, raw JSON payload, and row hash. Immutable after ingest.
create table if not exists legacy.raw_rows (
  id bigint generated always as identity primary key,
  batch_id text not null references legacy.import_batches(batch_id) on delete cascade,
  tab_name text not null,
  row_number integer not null,
  payload jsonb not null,
  row_hash text not null,
  created_at timestamptz not null default now(),
  constraint uq_raw_rows_batch_tab_row unique (batch_id, tab_name, row_number)
);

create index if not exists idx_legacy_raw_rows_lookup on legacy.raw_rows(batch_id, tab_name);

-- 3.3 legacy.id_map
-- Maps source entity/tab/key to canonical table/ID with transform version and confidence score.
create table if not exists legacy.id_map (
  id bigint generated always as identity primary key,
  batch_id text not null references legacy.import_batches(batch_id) on delete cascade,
  source_entity text not null, -- 'staff', 'request', 'shift', 'rule'
  source_tab text not null,
  source_key text not null,    -- e.g. 'Dr Siti' or 'MO-02'
  canonical_table text not null, -- 'staff_directory'
  canonical_id text not null,
  canonical_label text not null,
  confidence text not null check (confidence in ('exact', 'high', 'manual_approved', 'unresolved', 'collision')) default 'unresolved',
  transform_version text not null default 'v1.0.0',
  notes text null,
  created_at timestamptz not null default now(),
  constraint uq_legacy_id_map_batch_entity_key unique (batch_id, source_entity, source_key)
);

create index if not exists idx_legacy_id_map_lookup on legacy.id_map(batch_id, source_entity);

-- 3.4 legacy.reconciliation_results
-- Stores row counts, unique-key counts, null/error counts, business totals, checksums, and reviewer disposition.
create table if not exists legacy.reconciliation_results (
  id bigint generated always as identity primary key,
  batch_id text not null references legacy.import_batches(batch_id) on delete cascade,
  period_start date null,
  category text not null, -- 'staff_directory', 'roster_assignments', 'roster_requests', 'holidays', 'rules'
  source_count integer not null default 0,
  canonical_count integer not null default 0,
  duplicate_count integer not null default 0,
  error_count integer not null default 0,
  checksum_match boolean not null default false,
  discrepancies jsonb not null default '[]'::jsonb,
  reviewer_disposition text not null check (reviewer_disposition in ('pending', 'approved', 'flagged', 'rejected')) default 'pending',
  disposition_notes text null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint uq_legacy_recon_batch_cat_period unique (batch_id, category, period_start)
);

create index if not exists idx_legacy_reconciliation_batch on legacy.reconciliation_results(batch_id);

-- =============================================================================
-- 4. Row Level Security on Legacy Tables (Owner-Only Access)
-- =============================================================================

alter table legacy.import_batches enable row level security;
alter table legacy.raw_rows enable row level security;
alter table legacy.id_map enable row level security;
alter table legacy.reconciliation_results enable row level security;

-- Policies for legacy.import_batches
create policy import_batches_admin_all on legacy.import_batches
  for all to authenticated
  using (private.is_active_owner())
  with check (private.is_active_owner());

-- Policies for legacy.raw_rows
create policy raw_rows_admin_all on legacy.raw_rows
  for all to authenticated
  using (private.is_active_owner())
  with check (private.is_active_owner());

-- Policies for legacy.id_map
create policy id_map_admin_all on legacy.id_map
  for all to authenticated
  using (private.is_active_owner())
  with check (private.is_active_owner());

-- Policies for legacy.reconciliation_results
create policy reconciliation_results_admin_all on legacy.reconciliation_results
  for all to authenticated
  using (private.is_active_owner())
  with check (private.is_active_owner());

-- =============================================================================
-- 5. Stored Procedures & Operational RPCs for Migration
-- =============================================================================

-- 5.1 RPC: get_migration_batches
create or replace function public.get_migration_batches()
returns jsonb
language plpgsql
security definer
set search_path = public, private, legacy
as $$
declare
  v_result jsonb;
begin
  if not private.is_active_owner() then
    raise exception 'Access denied: owner role required' using errcode = '42501';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'batch_id', b.batch_id,
      'source_spreadsheet_id', b.source_spreadsheet_id,
      'source_label', b.source_label,
      'export_timestamp', b.export_timestamp,
      'tab_manifest', b.tab_manifest,
      'file_hashes', b.file_hashes,
      'importer_version', b.importer_version,
      'status', b.status,
      'reconciliation_summary', b.reconciliation_summary,
      'notes', b.notes,
      'created_at', b.created_at,
      'raw_row_count', coalesce(r.raw_count, 0)
    ) order by b.created_at desc
  )
  into v_result
  from legacy.import_batches b
  left join (
    select batch_id, count(*) as raw_count
    from legacy.raw_rows
    group by batch_id
  ) r on r.batch_id = b.batch_id;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- 5.2 RPC: create_migration_batch
create or replace function public.create_migration_batch(
  p_batch_id text,
  p_source_spreadsheet_id text,
  p_source_label text default 'Google Sheets Master Workbook',
  p_tab_manifest jsonb default '[]'::jsonb,
  p_file_hashes jsonb default '{}'::jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, legacy
as $$
declare
  v_batch legacy.import_batches%rowtype;
begin
  if not private.is_active_owner() then
    raise exception 'Access denied: owner role required' using errcode = '42501';
  end if;

  insert into legacy.import_batches (
    batch_id,
    source_spreadsheet_id,
    source_label,
    tab_manifest,
    file_hashes,
    notes,
    created_by
  ) values (
    p_batch_id,
    p_source_spreadsheet_id,
    p_source_label,
    p_tab_manifest,
    p_file_hashes,
    p_notes,
    auth.uid()
  )
  on conflict (batch_id) do update set
    source_spreadsheet_id = excluded.source_spreadsheet_id,
    source_label = excluded.source_label,
    tab_manifest = excluded.tab_manifest,
    file_hashes = excluded.file_hashes,
    notes = coalesce(excluded.notes, legacy.import_batches.notes)
  returning * into v_batch;

  -- Audit log entry
  insert into public.audit_events (
    actor_auth_user_id,
    action,
    entity_name,
    entity_id,
    details
  ) values (
    auth.uid(),
    'MIGRATION_BATCH_CREATED',
    'legacy.import_batches',
    v_batch.batch_id,
    jsonb_build_object(
      'source_spreadsheet_id', v_batch.source_spreadsheet_id,
      'status', v_batch.status,
      'tabs_count', jsonb_array_length(v_batch.tab_manifest)
    )
  );

  return to_jsonb(v_batch);
end;
$$;

-- 5.3 RPC: stage_raw_rows
create or replace function public.stage_raw_rows(
  p_batch_id text,
  p_tab_name text,
  p_rows jsonb -- array of { row_number: int, payload: object, row_hash: text }
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, legacy
as $$
declare
  v_inserted_count integer := 0;
  v_item jsonb;
begin
  if not private.is_active_owner() then
    raise exception 'Access denied: owner role required' using errcode = '42501';
  end if;

  for v_item in select * from jsonb_array_elements(p_rows)
  loop
    insert into legacy.raw_rows (
      batch_id,
      tab_name,
      row_number,
      payload,
      row_hash
    ) values (
      p_batch_id,
      p_tab_name,
      (v_item->>'row_number')::integer,
      (v_item->'payload'),
      coalesce(v_item->>'row_hash', md5((v_item->'payload')::text))
    )
    on conflict (batch_id, tab_name, row_number) do update set
      payload = excluded.payload,
      row_hash = excluded.row_hash;

    v_inserted_count := v_inserted_count + 1;
  end loop;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'tab_name', p_tab_name,
    'staged_rows', v_inserted_count
  );
end;
$$;

-- 5.4 RPC: get_migration_batch_details
create or replace function public.get_migration_batch_details(
  p_batch_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, legacy
as $$
declare
  v_batch jsonb;
  v_tabs jsonb;
  v_id_maps jsonb;
  v_reconciliation jsonb;
begin
  if not private.is_active_owner() then
    raise exception 'Access denied: owner role required' using errcode = '42501';
  end if;

  select to_jsonb(b) into v_batch
  from legacy.import_batches b
  where b.batch_id = p_batch_id;

  if v_batch is null then
    raise exception 'Batch % not found', p_batch_id using errcode = 'P0002';
  end if;

  -- Summarize tabs and row counts
  select jsonb_agg(
    jsonb_build_object(
      'tab_name', tab_name,
      'row_count', count(*)
    ) order by tab_name
  )
  into v_tabs
  from legacy.raw_rows
  where batch_id = p_batch_id
  group by tab_name;

  -- Get ID mappings
  select jsonb_agg(
    jsonb_build_object(
      'id', id,
      'source_entity', source_entity,
      'source_tab', source_tab,
      'source_key', source_key,
      'canonical_table', canonical_table,
      'canonical_id', canonical_id,
      'canonical_label', canonical_label,
      'confidence', confidence,
      'notes', notes
    ) order by source_key
  )
  into v_id_maps
  from legacy.id_map
  where batch_id = p_batch_id;

  -- Get reconciliation results
  select jsonb_agg(
    jsonb_build_object(
      'id', id,
      'period_start', period_start,
      'category', category,
      'source_count', source_count,
      'canonical_count', canonical_count,
      'duplicate_count', duplicate_count,
      'error_count', error_count,
      'checksum_match', checksum_match,
      'discrepancies', discrepancies,
      'reviewer_disposition', reviewer_disposition,
      'disposition_notes', disposition_notes
    ) order by category, period_start
  )
  into v_reconciliation
  from legacy.reconciliation_results
  where batch_id = p_batch_id;

  return jsonb_build_object(
    'batch', v_batch,
    'tabs', coalesce(v_tabs, '[]'::jsonb),
    'id_maps', coalesce(v_id_maps, '[]'::jsonb),
    'reconciliation', coalesce(v_reconciliation, '[]'::jsonb)
  );
end;
$$;

-- 5.5 RPC: save_id_mapping
create or replace function public.save_id_mapping(
  p_batch_id text,
  p_source_entity text,
  p_source_tab text,
  p_source_key text,
  p_canonical_table text,
  p_canonical_id text,
  p_canonical_label text,
  p_confidence text default 'manual_approved',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, legacy
as $$
declare
  v_map legacy.id_map%rowtype;
begin
  if not private.is_active_owner() then
    raise exception 'Access denied: owner role required' using errcode = '42501';
  end if;

  insert into legacy.id_map (
    batch_id,
    source_entity,
    source_tab,
    source_key,
    canonical_table,
    canonical_id,
    canonical_label,
    confidence,
    notes
  ) values (
    p_batch_id,
    p_source_entity,
    p_source_tab,
    p_source_key,
    p_canonical_table,
    p_canonical_id,
    p_canonical_label,
    p_confidence,
    p_notes
  )
  on conflict (batch_id, source_entity, source_key) do update set
    canonical_id = excluded.canonical_id,
    canonical_label = excluded.canonical_label,
    confidence = excluded.confidence,
    notes = coalesce(excluded.notes, legacy.id_map.notes)
  returning * into v_map;

  return to_jsonb(v_map);
end;
$$;

-- 5.6 RPC: update_reconciliation_disposition
create or replace function public.update_reconciliation_disposition(
  p_result_id bigint,
  p_disposition text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, legacy
as $$
declare
  v_res legacy.reconciliation_results%rowtype;
begin
  if not private.is_active_owner() then
    raise exception 'Access denied: owner role required' using errcode = '42501';
  end if;

  update legacy.reconciliation_results
  set
    reviewer_disposition = p_disposition,
    disposition_notes = coalesce(p_notes, disposition_notes),
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_result_id
  returning * into v_res;

  if v_res.id is null then
    raise exception 'Reconciliation result % not found', p_result_id using errcode = 'P0002';
  end if;

  return to_jsonb(v_res);
end;
$$;

-- 5.7 RPC: revert_migration_batch
create or replace function public.revert_migration_batch(
  p_batch_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, legacy
as $$
declare
  v_deleted_periods integer := 0;
begin
  if not private.is_active_owner() then
    raise exception 'Access denied: owner role required' using errcode = '42501';
  end if;

  update public.roster_periods
  set status = 'archived'
  where import_batch_id = p_batch_id and legacy_read_only = true;
  get diagnostics v_deleted_periods = row_count;

  update legacy.import_batches
  set status = 'rolled_back'
  where batch_id = p_batch_id;

  insert into public.audit_events (
    actor_auth_user_id,
    action,
    entity_name,
    entity_id,
    details
  ) values (
    auth.uid(),
    'MIGRATION_BATCH_REVERTED',
    'legacy.import_batches',
    p_batch_id,
    jsonb_build_object(
      'reverted_periods', v_deleted_periods
    )
  );

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'rolled_back',
    'reverted_periods', v_deleted_periods
  );
end;
$$;

-- 5.8 RPC: execute_migration_transform
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
begin
  if not private.is_active_owner() then
    raise exception 'Access denied: owner role required' using errcode = '42501';
  end if;

  select * into v_batch from legacy.import_batches where batch_id = p_batch_id;
  if v_batch.id is null then
    raise exception 'Batch % not found', p_batch_id using errcode = 'P0002';
  end if;

  -- 1. Identity Resolution & Mapping Pass
  -- Read raw rows from 'Staff' or 'StaffDirectory' tab if present
  for v_row in (
    select payload
    from legacy.raw_rows
    where batch_id = p_batch_id and tab_name in ('Staff', 'StaffDirectory', 'MasterStaff')
  ) loop
    v_staff_source_count := v_staff_source_count + 1;
    declare
      v_name text := trim(coalesce(v_row.payload->>'roster_name', v_row.payload->>'name', v_row.payload->>'Nama'));
      v_code text := trim(coalesce(v_row.payload->>'staff_code', v_row.payload->>'code', v_row.payload->>'Kod'));
      v_found_id bigint;
      v_found_name text;
    begin
      if v_name is not null and v_name <> '' then
        -- Attempt match against canonical staff_directory
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
          -- Insert unresolved mapping for owner review
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
    end;
  end loop;

  -- 2. Transform Roster Data Pass
  -- Process raw rows from 'MasterRoster' or 'Roster' tab
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
      -- Upsert historical period marked as legacy_read_only
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

      -- Create frozen publication milestone
      insert into public.roster_publications (
        period_id,
        publication_version,
        period_revision,
        canonical_data_hash,
        notes
      ) values (
        v_period_id,
        1,
        1,
        md5('batch:' || p_batch_id || ':period:' || v_period_start::text),
        'Migrated from legacy Google Sheets (' || p_batch_id || ')'
      )
      on conflict (period_id, publication_version) do update set
        notes = excluded.notes
      returning id into v_pub_id;

      -- Load planned assignments from raw rows for this period
      for v_row in (
        select payload
        from legacy.raw_rows
        where batch_id = p_batch_id and tab_name in ('MasterRoster', 'Roster', 'Jadual')
          and (payload->>'period_start')::date = v_period_start
      ) loop
        v_duty_date := (v_row.payload->>'duty_date')::date;
        v_shift_code := upper(trim(v_row.payload->>'shift_code'));
        
        -- Resolve staff
        select canonical_id::bigint into v_staff_id
        from legacy.id_map
        where batch_id = p_batch_id
          and source_entity = 'staff'
          and source_key = trim(v_row.payload->>'roster_name');

        if v_staff_id is not null and v_staff_id > 0 and v_duty_date is not null and v_shift_code is not null then
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

          v_roster_rows_count := v_roster_rows_count + 1;
        end if;
      end loop;
    end if;
  end loop;

  -- 3. Transform Requests Pass
  -- Process raw rows from 'Requests' tab
  for v_row in (
    select payload
    from legacy.raw_rows
    where batch_id = p_batch_id and tab_name in ('Requests', 'Permohonan')
  ) loop
    v_requests_count := v_requests_count + 1;
    if not p_dry_run then
      declare
        v_req_staff_id bigint;
        v_req_type_id bigint := 1; -- default general request
      begin
        select canonical_id::bigint into v_req_staff_id
        from legacy.id_map
        where batch_id = p_batch_id and source_entity = 'staff'
          and source_key = trim(v_row.payload->>'roster_name');

        if v_req_staff_id is not null and v_req_staff_id > 0 then
          insert into public.roster_requests (
            staff_id,
            request_type_id,
            start_date,
            end_date,
            requested_shift_code,
            reason_category,
            notes,
            status,
            source_system,
            legacy_source_id
          ) values (
            v_req_staff_id,
            v_req_type_id,
            coalesce((v_row.payload->>'start_date')::date, now()::date),
            coalesce((v_row.payload->>'end_date')::date, now()::date),
            v_row.payload->>'requested_shift_code',
            coalesce(v_row.payload->>'reason_category', 'legacy_import'),
            v_row.payload->>'notes',
            coalesce(v_row.payload->>'status', 'approved'),
            'legacy_sheets',
            p_batch_id || ':' || (v_row.payload->>'id')
          )
          on conflict do nothing;
        end if;
      end;
    end if;
  end loop;

  -- 4. Record Reconciliation Results
  -- Staff Directory reconciliation
  insert into legacy.reconciliation_results (
    batch_id, category, source_count, canonical_count, checksum_match, reviewer_disposition
  ) values (
    p_batch_id, 'staff_directory', v_staff_source_count, v_staff_matched_count,
    (v_staff_source_count > 0 and v_staff_source_count = v_staff_matched_count),
    case when v_staff_source_count = v_staff_matched_count then 'approved' else 'pending' end
  )
  on conflict (batch_id, category, period_start) do update set
    source_count = excluded.source_count,
    canonical_count = excluded.canonical_count,
    checksum_match = excluded.checksum_match;

  -- Roster Assignments reconciliation
  insert into legacy.reconciliation_results (
    batch_id, category, source_count, canonical_count, checksum_match, reviewer_disposition
  ) values (
    p_batch_id, 'roster_assignments', v_roster_rows_count, v_roster_rows_count,
    true, 'approved'
  )
  on conflict (batch_id, category, period_start) do update set
    source_count = excluded.source_count,
    canonical_count = excluded.canonical_count,
    checksum_match = excluded.checksum_match;

  -- Requests reconciliation
  insert into legacy.reconciliation_results (
    batch_id, category, source_count, canonical_count, checksum_match, reviewer_disposition
  ) values (
    p_batch_id, 'roster_requests', v_requests_count, v_requests_count,
    true, 'approved'
  )
  on conflict (batch_id, category, period_start) do update set
    source_count = excluded.source_count,
    canonical_count = excluded.canonical_count,
    checksum_match = excluded.checksum_match;

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
    actor_auth_user_id,
    action,
    entity_name,
    entity_id,
    details
  ) values (
    auth.uid(),
    case when p_dry_run then 'MIGRATION_TRANSFORM_DRY_RUN' else 'MIGRATION_TRANSFORM_COMMITTED' end,
    'legacy.import_batches',
    p_batch_id,
    jsonb_build_object(
      'dry_run', p_dry_run,
      'staff_matched', v_staff_matched_count,
      'roster_periods', v_roster_periods_count,
      'assignments', v_roster_rows_count,
      'requests', v_requests_count
    )
  );

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'dry_run', p_dry_run,
    'status', case when p_dry_run then 'reconciled' else 'committed' end,
    'staff_source_count', v_staff_source_count,
    'staff_matched_count', v_staff_matched_count,
    'roster_periods_count', v_roster_periods_count,
    'roster_assignments_count', v_roster_rows_count,
    'requests_count', v_requests_count
  );
end;
$$;

-- Grant execute privileges to authenticated (gated internally by private.is_active_owner)
grant execute on function public.get_migration_batches() to authenticated;
grant execute on function public.create_migration_batch(text, text, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.stage_raw_rows(text, text, jsonb) to authenticated;
grant execute on function public.get_migration_batch_details(text) to authenticated;
grant execute on function public.save_id_mapping(text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.update_reconciliation_disposition(bigint, text, text) to authenticated;
grant execute on function public.revert_migration_batch(text) to authenticated;
grant execute on function public.execute_migration_transform(text, boolean) to authenticated;
