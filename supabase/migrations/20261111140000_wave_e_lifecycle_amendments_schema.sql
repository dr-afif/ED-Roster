-- Migration: Wave E Roster Lifecycle, Atomic Publication, Amendments & GOFF Ledger
-- Idempotent schema, RLS policies, and secure Postgres RPCs

-- 1. ROSTER PUBLICATIONS (Immutable publication records)
create table if not exists public.roster_publications (
    id uuid primary key default gen_random_uuid(),
    period_id bigint not null references public.roster_periods(id) on delete cascade,
    publication_version integer not null default 1,
    period_revision bigint not null default 0,
    rule_version_id bigint references public.rule_versions(id),
    canonical_data_hash text not null,
    notes text,
    published_at timestamptz not null default now(),
    published_by uuid references auth.users(id),
    constraint publications_unique_period_ver unique (period_id, publication_version)
);

comment on table public.roster_publications is 'Immutable official publication milestones locking planned schedule versions.';

-- 2. ROSTER PLANNED ASSIGNMENTS (Immutable snapshot of published assignments)
create table if not exists public.roster_planned_assignments (
    id bigint generated always as identity primary key,
    publication_id uuid not null references public.roster_publications(id) on delete cascade,
    period_id bigint not null references public.roster_periods(id) on delete cascade,
    staff_id bigint not null references public.staff_directory(id) on delete cascade,
    duty_date date not null,
    shift_code text not null references public.shift_definitions(code) on update cascade,
    cell_note text,
    created_at timestamptz not null default now(),
    constraint planned_unique_cell unique (publication_id, staff_id, duty_date)
);

comment on table public.roster_planned_assignments is 'Immutable snapshot of planned shifts frozen at publication time.';

-- 3. ROSTER AMENDMENT EVENTS (Header for operational modifications)
create table if not exists public.roster_amendment_events (
    id bigint generated always as identity primary key,
    period_id bigint not null references public.roster_periods(id) on delete cascade,
    category text not null check (category in ('absence_only', 'absence_plus_replacement', 'shift_swap', 'admin_correction', 'reversal')),
    reason text not null,
    status text not null default 'active' check (status in ('active', 'reversed')),
    reversed_by_event_id bigint references public.roster_amendment_events(id),
    reversal_reason text,
    operation_id text,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now()
);

comment on table public.roster_amendment_events is 'Event headers for post-publication operational roster adjustments.';

-- 4. ROSTER AMENDMENT LINES (Atomic adjustment lines linked to an event)
create table if not exists public.roster_amendment_lines (
    id bigint generated always as identity primary key,
    event_id bigint not null references public.roster_amendment_events(id) on delete cascade,
    period_id bigint not null references public.roster_periods(id) on delete cascade,
    staff_id bigint not null references public.staff_directory(id) on delete cascade,
    duty_date date not null,
    line_action text not null check (line_action in ('absence', 'replacement', 'swap', 'modify', 'compensate')),
    from_shift_code text not null references public.shift_definitions(code) on update cascade,
    to_shift_code text not null references public.shift_definitions(code) on update cascade,
    notes text,
    created_at timestamptz not null default now()
);

comment on table public.roster_amendment_lines is 'Discrete cell delta lines linked to an amendment event.';

-- 5. GOFF LEDGER (Compensatory rest credits and debits)
create table if not exists public.goff_ledger (
    id bigint generated always as identity primary key,
    staff_id bigint not null references public.staff_directory(id) on delete cascade,
    period_id bigint references public.roster_periods(id) on delete set null,
    transaction_type text not null check (transaction_type in ('opening_balance', 'earned', 'used', 'reservation', 'release', 'adjustment')),
    amount integer not null,
    effective_date date not null,
    reason text not null,
    operation_id text,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now()
);

comment on table public.goff_ledger is 'Compensatory rest (Ganti OFF) transaction log and balance tracking.';

-- INDEXES
create index if not exists idx_publications_period on public.roster_publications(period_id, publication_version desc);
create index if not exists idx_planned_period_staff on public.roster_planned_assignments(period_id, staff_id, duty_date);
create index if not exists idx_planned_publication on public.roster_planned_assignments(publication_id);
create index if not exists idx_amendment_events_period on public.roster_amendment_events(period_id, status, created_at desc);
create index if not exists idx_amendment_lines_event on public.roster_amendment_lines(event_id);
create index if not exists idx_amendment_lines_period_date on public.roster_amendment_lines(period_id, duty_date);
create index if not exists idx_amendment_lines_staff on public.roster_amendment_lines(staff_id, duty_date);
create index if not exists idx_goff_ledger_staff on public.goff_ledger(staff_id, effective_date desc);

-- ROW LEVEL SECURITY
alter table public.roster_publications enable row level security;
alter table public.roster_planned_assignments enable row level security;
alter table public.roster_amendment_events enable row level security;
alter table public.roster_amendment_lines enable row level security;
alter table public.goff_ledger enable row level security;

-- POLICIES: Approved users can read; Owner manages all
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_publications' and policyname = 'roster_publications_select') then
    create policy roster_publications_select on public.roster_publications for select to authenticated using (private.is_active_approved_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_publications' and policyname = 'roster_publications_admin_write') then
    create policy roster_publications_admin_write on public.roster_publications for all to authenticated using (private.is_active_owner()) with check (private.is_active_owner());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_planned_assignments' and policyname = 'roster_planned_assignments_select') then
    create policy roster_planned_assignments_select on public.roster_planned_assignments for select to authenticated using (private.is_active_approved_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_planned_assignments' and policyname = 'roster_planned_assignments_admin_write') then
    create policy roster_planned_assignments_admin_write on public.roster_planned_assignments for all to authenticated using (private.is_active_owner()) with check (private.is_active_owner());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_amendment_events' and policyname = 'roster_amendment_events_select') then
    create policy roster_amendment_events_select on public.roster_amendment_events for select to authenticated using (private.is_active_approved_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_amendment_events' and policyname = 'roster_amendment_events_admin_write') then
    create policy roster_amendment_events_admin_write on public.roster_amendment_events for all to authenticated using (private.is_active_owner()) with check (private.is_active_owner());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_amendment_lines' and policyname = 'roster_amendment_lines_select') then
    create policy roster_amendment_lines_select on public.roster_amendment_lines for select to authenticated using (private.is_active_approved_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_amendment_lines' and policyname = 'roster_amendment_lines_admin_write') then
    create policy roster_amendment_lines_admin_write on public.roster_amendment_lines for all to authenticated using (private.is_active_owner()) with check (private.is_active_owner());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'goff_ledger' and policyname = 'goff_ledger_select') then
    create policy goff_ledger_select on public.goff_ledger for select to authenticated using (private.is_active_approved_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'goff_ledger' and policyname = 'goff_ledger_admin_write') then
    create policy goff_ledger_admin_write on public.goff_ledger for all to authenticated using (private.is_active_owner()) with check (private.is_active_owner());
  end if;
end $$;

-- 6. RPC: ATOMIC PUBLISH ROSTER PERIOD
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

    -- 3. Verify that draft assignments exist
    select count(*) into v_draft_count
    from public.roster_draft_assignments
    where period_id = p_period_id;

    if v_draft_count = 0 then
        raise exception 'Cannot publish empty roster. Please assign shifts before publishing.';
    end if;

    -- 4. Calculate next publication version
    select coalesce(max(publication_version), 0) + 1 into v_next_version
    from public.roster_publications
    where period_id = p_period_id;

    -- 5. Calculate data hash
    v_data_hash := md5(concat('period:', p_period_id, ':rev:', v_period.revision, ':count:', v_draft_count, ':ts:', now()));

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

    -- 7. Snapshot draft assignments into immutable planned assignments
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
        jsonb_build_object(
            'publication_id', v_publication_id,
            'version', v_next_version,
            'assigned_shifts', v_draft_count
        )
    );

    return v_publication_id;
end;
$$;

-- 7. RPC: SUBMIT OPERATIONAL AMENDMENT
create or replace function public.submit_roster_amendment(
    p_period_id bigint,
    p_category text,
    p_reason text,
    p_lines jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
    v_period record;
    v_event_id bigint;
    v_line record;
begin
    -- 1. Enforce Owner role
    if not private.is_active_owner() then
        raise exception 'Access denied: Sole Roster Administrator role required to amend rosters.';
    end if;

    -- 2. Verify period
    select * into v_period
    from public.roster_periods
    where id = p_period_id;

    if not found then
        raise exception 'Roster period % not found.', p_period_id;
    end if;

    if v_period.status not in ('published', 'amended') then
        raise exception 'Amendments can only be submitted for published or amended rosters. Current status: "%".', v_period.status;
    end if;

    if jsonb_array_length(p_lines) = 0 then
        raise exception 'Amendment must contain at least one line item.';
    end if;

    -- 3. Insert amendment event header
    insert into public.roster_amendment_events (
        period_id,
        category,
        reason,
        created_by
    )
    values (
        p_period_id,
        p_category,
        p_reason,
        auth.uid()
    )
    returning id into v_event_id;

    -- 4. Insert lines from jsonb array
    for v_line in
        select * from jsonb_to_recordset(p_lines) as x(
            staff_id bigint,
            duty_date date,
            line_action text,
            from_shift_code text,
            to_shift_code text,
            notes text
        )
    loop
        insert into public.roster_amendment_lines (
            event_id,
            period_id,
            staff_id,
            duty_date,
            line_action,
            from_shift_code,
            to_shift_code,
            notes
        )
        values (
            v_event_id,
            p_period_id,
            v_line.staff_id,
            v_line.duty_date,
            v_line.line_action,
            v_line.from_shift_code,
            v_line.to_shift_code,
            v_line.notes
        );
    end loop;

    -- 5. Transition period status to amended and increment revision
    update public.roster_periods
    set
        status = 'amended',
        revision = revision + 1,
        updated_at = now()
    where id = p_period_id;

    -- 6. Audit event
    insert into public.audit_events (
        action,
        actor_auth_user_id,
        entity_type,
        entity_id,
        reason,
        after_summary
    )
    values (
        'roster_amended',
        auth.uid(),
        'roster_amendment_events',
        v_event_id::text,
        p_reason,
        jsonb_build_object(
            'period_id', p_period_id,
            'category', p_category,
            'line_count', jsonb_array_length(p_lines)
        )
    );

    return v_event_id;
end;
$$;

-- 8. RPC: REVERSE ROSTER AMENDMENT
create or replace function public.reverse_roster_amendment(
    p_event_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
    v_orig_event record;
    v_reversal_event_id bigint;
    v_line record;
begin
    -- 1. Enforce Owner role
    if not private.is_active_owner() then
        raise exception 'Access denied: Sole Roster Administrator role required to reverse amendments.';
    end if;

    select * into v_orig_event
    from public.roster_amendment_events
    where id = p_event_id;

    if not found then
        raise exception 'Amendment event % not found.', p_event_id;
    end if;

    if v_orig_event.status = 'reversed' then
        raise exception 'Amendment event % is already reversed.', p_event_id;
    end if;

    -- 2. Create compensating reversal event
    insert into public.roster_amendment_events (
        period_id,
        category,
        reason,
        created_by
    )
    values (
        v_orig_event.period_id,
        'reversal',
        concat('Reversal of Event #', p_event_id, ': ', p_reason),
        auth.uid()
    )
    returning id into v_reversal_event_id;

    -- 3. Insert compensating lines (swap from_shift_code and to_shift_code)
    for v_line in
        select * from public.roster_amendment_lines where event_id = p_event_id
    loop
        insert into public.roster_amendment_lines (
            event_id,
            period_id,
            staff_id,
            duty_date,
            line_action,
            from_shift_code,
            to_shift_code,
            notes
        )
        values (
            v_reversal_event_id,
            v_line.period_id,
            v_line.staff_id,
            v_line.duty_date,
            'compensate',
            v_line.to_shift_code,
            v_line.from_shift_code,
            concat('Compensating line for event #', p_event_id)
        );
    end loop;

    -- 4. Mark original event as reversed
    update public.roster_amendment_events
    set
        status = 'reversed',
        reversed_by_event_id = v_reversal_event_id,
        reversal_reason = p_reason
    where id = p_event_id;

    -- 5. Increment period revision
    update public.roster_periods
    set
        revision = revision + 1,
        updated_at = now()
    where id = v_orig_event.period_id;

    -- 6. Audit
    insert into public.audit_events (
        action,
        actor_auth_user_id,
        entity_type,
        entity_id,
        reason,
        after_summary
    )
    values (
        'amendment_reversed',
        auth.uid(),
        'roster_amendment_events',
        p_event_id::text,
        p_reason,
        jsonb_build_object('reversal_event_id', v_reversal_event_id)
    );

    return v_reversal_event_id;
end;
$$;

-- 9. RPC: CLOSE ROSTER PERIOD
create or replace function public.close_roster_period(
    p_period_id bigint,
    p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
    v_period record;
begin
    if not private.is_active_owner() then
        raise exception 'Access denied: Sole Roster Administrator role required to close rosters.';
    end if;

    select * into v_period
    from public.roster_periods
    where id = p_period_id;

    if not found then
        raise exception 'Roster period % not found.', p_period_id;
    end if;

    if v_period.status not in ('published', 'amended') then
        raise exception 'Only published or amended rosters can be closed. Current status: "%".', v_period.status;
    end if;

    update public.roster_periods
    set
        status = 'closed',
        closed_at = now(),
        closed_by = auth.uid(),
        updated_at = now()
    where id = p_period_id;

    insert into public.audit_events (
        action,
        actor_auth_user_id,
        entity_type,
        entity_id,
        reason
    )
    values (
        'roster_closed',
        auth.uid(),
        'roster_periods',
        p_period_id::text,
        coalesce(p_notes, 'Manual reconciliation and close')
    );
end;
$$;

-- 10. RPC: REOPEN ROSTER PERIOD
create or replace function public.reopen_roster_period(
    p_period_id bigint,
    p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
    v_period record;
begin
    if not private.is_active_owner() then
        raise exception 'Access denied: Sole Roster Administrator role required to reopen rosters.';
    end if;

    if p_reason is null or btrim(p_reason) = '' then
        raise exception 'A mandatory operational reason is required to reopen a closed roster.';
    end if;

    select * into v_period
    from public.roster_periods
    where id = p_period_id;

    if not found then
        raise exception 'Roster period % not found.', p_period_id;
    end if;

    if v_period.status <> 'closed' then
        raise exception 'Only closed rosters can be reopened. Current status: "%".', v_period.status;
    end if;

    update public.roster_periods
    set
        status = 'amended',
        closed_at = null,
        closed_by = null,
        revision = revision + 1,
        updated_at = now()
    where id = p_period_id;

    insert into public.audit_events (
        action,
        actor_auth_user_id,
        entity_type,
        entity_id,
        reason
    )
    values (
        'roster_reopened',
        auth.uid(),
        'roster_periods',
        p_period_id::text,
        p_reason
    );
end;
$$;
