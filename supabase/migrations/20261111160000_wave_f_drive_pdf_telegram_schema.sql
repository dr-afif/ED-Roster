-- Migration: Wave F Documents Archive, Deterministic PDF Snapshots & Personal Telegram Delivery
-- Idempotent schema, RLS policies, and RPCs for ED-Roster

-- 1. DOCUMENT RECORDS TABLE
create table if not exists public.document_records (
    id bigint generated always as identity primary key,
    staff_id bigint references public.staff_directory(id) on delete set null,
    professional_record_id bigint references public.professional_records(id) on delete set null,
    roster_snapshot_id uuid,
    document_category text not null check (document_category in ('roster_pdf', 'course_certificate', 'apc', 'policy', 'general', 'archive')),
    drive_file_id text unique not null,
    drive_parent_id text not null,
    file_name text not null,
    mime_type text not null default 'application/pdf',
    size_bytes bigint not null default 0,
    sha256 text not null,
    drive_web_view_link text,
    source_system text not null default 'resq',
    uploaded_by uuid references auth.users(id),
    uploaded_at timestamptz not null default now(),
    visibility text not null default 'all_staff' check (visibility in ('owner', 'self_and_owner', 'all_staff')),
    status text not null default 'active' check (status in ('active', 'superseded', 'missing', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.document_records is 'Controlled metadata catalog for documents archived in Google Drive.';

-- 2. ROSTER SNAPSHOTS TABLE
create table if not exists public.roster_snapshots (
    id uuid primary key default gen_random_uuid(),
    period_id bigint not null references public.roster_periods(id) on update cascade,
    publication_id bigint references public.roster_publications(id) on update cascade,
    source_revision bigint not null,
    snapshot_version integer not null,
    snapshot_type text not null check (snapshot_type in ('initial', 'amendment', 'final', 'manual')),
    reason text,
    predecessor_snapshot_id uuid references public.roster_snapshots(id),
    canonical_payload jsonb not null,
    canonical_hash text not null,
    pdf_sha256 text,
    drive_file_id text,
    drive_parent_id text,
    file_name text not null,
    status text not null default 'archived' check (status in ('requested', 'rendering', 'archived', 'failed')),
    error_message text,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    constraint roster_snapshots_period_rev unique (period_id, source_revision),
    constraint roster_snapshots_period_ver unique (period_id, snapshot_version)
);

comment on table public.roster_snapshots is 'Immutable versioned roster snapshots with frozen canonical data and PDF hashes.';

-- Foreign key link back from document_records to roster_snapshots
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'document_records_roster_snapshot_fkey'
  ) then
    alter table public.document_records
      add constraint document_records_roster_snapshot_fkey
      foreign key (roster_snapshot_id) references public.roster_snapshots(id)
      on delete set null;
  end if;
end $$;

-- 3. ROSTER SNAPSHOT DELIVERIES TABLE
create table if not exists public.roster_snapshot_deliveries (
    id bigint generated always as identity primary key,
    snapshot_id uuid not null references public.roster_snapshots(id) on update cascade on delete cascade,
    channel text not null default 'telegram_owner' check (channel in ('telegram_owner')),
    idempotency_key uuid not null unique,
    telegram_chat_id text not null,
    telegram_message_id text,
    status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
    attempt_count integer not null default 0,
    sent_by uuid references auth.users(id),
    sent_at timestamptz,
    last_error text,
    created_at timestamptz not null default now(),
    constraint uq_snapshot_channel unique (snapshot_id, channel)
);

comment on table public.roster_snapshot_deliveries is 'Audit log for outbound Telegram deliveries to the owner private chat.';

-- 4. INDEXES
create index if not exists idx_document_records_staff on public.document_records(staff_id);
create index if not exists idx_document_records_category on public.document_records(document_category);
create index if not exists idx_document_records_status on public.document_records(status);
create index if not exists idx_roster_snapshots_period on public.roster_snapshots(period_id);
create index if not exists idx_roster_snapshots_ver on public.roster_snapshots(period_id, snapshot_version);
create index if not exists idx_snapshot_deliveries_snap on public.roster_snapshot_deliveries(snapshot_id);

-- 5. ROW LEVEL SECURITY
alter table public.document_records enable row level security;
alter table public.roster_snapshots enable row level security;
alter table public.roster_snapshot_deliveries enable row level security;

-- Policies for document_records
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'document_records' and policyname = 'document_records_select') then
    create policy document_records_select on public.document_records
      for select to authenticated
      using (
        private.is_active_owner()
        or (private.is_active_approved_user() and visibility = 'all_staff')
        or (private.is_active_approved_user() and visibility = 'self_and_owner' and staff_id = private.current_active_staff_id())
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'document_records' and policyname = 'document_records_admin_all') then
    create policy document_records_admin_all on public.document_records
      for all to authenticated
      using (private.is_active_owner())
      with check (private.is_active_owner());
  end if;

  -- Policies for roster_snapshots
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_snapshots' and policyname = 'roster_snapshots_select') then
    create policy roster_snapshots_select on public.roster_snapshots
      for select to authenticated
      using (private.is_active_approved_user());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_snapshots' and policyname = 'roster_snapshots_admin_all') then
    create policy roster_snapshots_admin_all on public.roster_snapshots
      for all to authenticated
      using (private.is_active_owner())
      with check (private.is_active_owner());
  end if;

  -- Policies for roster_snapshot_deliveries (owner only)
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_snapshot_deliveries' and policyname = 'snapshot_deliveries_admin_all') then
    create policy snapshot_deliveries_admin_all on public.roster_snapshot_deliveries
      for all to authenticated
      using (private.is_active_owner())
      with check (private.is_active_owner());
  end if;
end $$;

-- 6. RPC: create_or_get_roster_snapshot
create or replace function public.create_or_get_roster_snapshot(
    p_period_id bigint,
    p_source_revision bigint,
    p_canonical_payload jsonb,
    p_canonical_hash text,
    p_pdf_sha256 text,
    p_drive_file_id text,
    p_drive_parent_id text,
    p_file_name text,
    p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_existing record;
  v_period record;
  v_publication record;
  v_next_version integer;
  v_snapshot_type text;
  v_prev_snapshot_id uuid;
  v_new_snapshot record;
begin
  if not private.is_active_owner() then
    raise exception 'Unauthorized: Only department owners can archive roster snapshots.';
  end if;

  -- 1. Check if snapshot already exists for this exact revision (Idempotency)
  select * into v_existing
  from public.roster_snapshots
  where period_id = p_period_id and source_revision = p_source_revision;

  if found then
    return to_jsonb(v_existing);
  end if;

  -- 2. Verify period
  select * into v_period
  from public.roster_periods
  where id = p_period_id;

  if not found then
    raise exception 'Period ID % not found.', p_period_id;
  end if;

  if v_period.status not in ('published', 'amended', 'closed') then
    raise exception 'Cannot create snapshot for roster in status: % (must be published, amended, or closed).', v_period.status;
  end if;

  -- 3. Get active publication
  select * into v_publication
  from public.roster_publications
  where period_id = p_period_id
  order by publication_version desc
  limit 1;

  -- 4. Calculate next snapshot version
  select coalesce(max(snapshot_version), 0) + 1 into v_next_version
  from public.roster_snapshots
  where period_id = p_period_id;

  -- 5. Determine snapshot type and predecessor
  if v_next_version = 1 then
    v_snapshot_type := 'initial';
    v_prev_snapshot_id := null;
  else
    v_snapshot_type := 'amendment';
    select id into v_prev_snapshot_id
    from public.roster_snapshots
    where period_id = p_period_id
    order by snapshot_version desc
    limit 1;
  end if;

  -- 6. Insert snapshot
  insert into public.roster_snapshots (
    period_id,
    publication_id,
    source_revision,
    snapshot_version,
    snapshot_type,
    reason,
    predecessor_snapshot_id,
    canonical_payload,
    canonical_hash,
    pdf_sha256,
    drive_file_id,
    drive_parent_id,
    file_name,
    status,
    created_by
  ) values (
    p_period_id,
    v_publication.id,
    p_source_revision,
    v_next_version,
    v_snapshot_type,
    p_reason,
    v_prev_snapshot_id,
    p_canonical_payload,
    p_canonical_hash,
    p_pdf_sha256,
    p_drive_file_id,
    p_drive_parent_id,
    p_file_name,
    'archived',
    auth.uid()
  )
  returning * into v_new_snapshot;

  -- 7. Register in document_records
  insert into public.document_records (
    roster_snapshot_id,
    document_category,
    drive_file_id,
    drive_parent_id,
    file_name,
    mime_type,
    size_bytes,
    sha256,
    drive_web_view_link,
    source_system,
    uploaded_by,
    visibility,
    status
  ) values (
    v_new_snapshot.id,
    'roster_pdf',
    p_drive_file_id,
    p_drive_parent_id,
    p_file_name,
    'application/pdf',
    coalesce((p_canonical_payload->>'size_bytes')::bigint, 45000),
    p_pdf_sha256,
    concat('https://drive.google.com/file/d/', p_drive_file_id, '/view'),
    'resq',
    auth.uid(),
    'all_staff',
    'active'
  )
  on conflict (drive_file_id) do nothing;

  -- 8. Audit event
  perform private.append_audit_event(
    auth.uid(),
    private.current_active_staff_id(),
    'roster_snapshot.archived',
    'roster_snapshots',
    v_new_snapshot.id::text,
    null,
    null,
    jsonb_build_object(
      'period_id', p_period_id,
      'snapshot_version', v_next_version,
      'snapshot_type', v_snapshot_type,
      'file_name', p_file_name,
      'pdf_sha256', p_pdf_sha256
    ),
    coalesce(p_reason, 'Archived roster snapshot to document catalog')
  );

  return to_jsonb(v_new_snapshot);
end;
$$;

-- 7. RPC: record_snapshot_delivery
create or replace function public.record_snapshot_delivery(
    p_snapshot_id uuid,
    p_idempotency_key uuid,
    p_telegram_chat_id text,
    p_telegram_message_id text default null,
    p_status text default 'sent',
    p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_delivery record;
begin
  if not private.is_active_owner() then
    raise exception 'Unauthorized: Only department owners can record snapshot deliveries.';
  end if;

  insert into public.roster_snapshot_deliveries (
    snapshot_id,
    channel,
    idempotency_key,
    telegram_chat_id,
    telegram_message_id,
    status,
    attempt_count,
    sent_by,
    sent_at,
    last_error
  ) values (
    p_snapshot_id,
    'telegram_owner',
    p_idempotency_key,
    p_telegram_chat_id,
    p_telegram_message_id,
    p_status,
    1,
    auth.uid(),
    case when p_status = 'sent' then now() else null end,
    p_error
  )
  on conflict (snapshot_id, channel) do update set
    attempt_count = roster_snapshot_deliveries.attempt_count + 1,
    telegram_message_id = coalesce(excluded.telegram_message_id, roster_snapshot_deliveries.telegram_message_id),
    status = excluded.status,
    sent_at = case when excluded.status = 'sent' then now() else roster_snapshot_deliveries.sent_at end,
    last_error = excluded.last_error
  returning * into v_delivery;

  return to_jsonb(v_delivery);
end;
$$;
