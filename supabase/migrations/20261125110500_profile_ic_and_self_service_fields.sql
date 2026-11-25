-- =============================================================================
-- Migration: Add ic_number to staff_profiles, configurable self-service field
-- locks via rule_versions.config.profile_locked_fields, and full admin access.
-- =============================================================================

alter table public.staff_profiles
  add column if not exists ic_number text null;

create or replace function private.get_profile_locked_fields()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(rv.config->'profile_locked_fields', '[]'::jsonb)
  from public.rule_versions rv
  where rv.status = 'active'
  order by rv.version desc, rv.id desc
  limit 1;
$$;

revoke all on function private.get_profile_locked_fields() from public, anon, authenticated;

create or replace function private.before_write_staff_profiles()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid;
  v_locked jsonb;
begin
  v_uid := (select auth.uid());

  if new.email is not null then
    new.email := lower(btrim(new.email::text))::extensions.citext;
  end if;

  if new.phone is not null then
    new.phone := nullif(btrim(new.phone), '');
  end if;

  if new.registration_number is not null then
    new.registration_number := nullif(btrim(new.registration_number), '');
  end if;

  if new.staff_number is not null then
    new.staff_number := nullif(btrim(new.staff_number), '');
  end if;

  if new.ic_number is not null then
    new.ic_number := nullif(btrim(new.ic_number), '');
  end if;

  if tg_op = 'UPDATE' then
    if current_user in ('authenticated', 'anon') and not (select private.is_active_owner()) then
      if new.staff_id is distinct from old.staff_id
        or new.auth_user_id is distinct from old.auth_user_id
        or (new.email::text is distinct from old.email::text)
        or new.verification_status is distinct from old.verification_status
        or new.verified_at is distinct from old.verified_at
        or new.verified_by is distinct from old.verified_by
      then
        raise exception 'Staff self-service updates may not modify identity or verification fields.'
          using errcode = '42501';
      end if;

      v_locked := private.get_profile_locked_fields();

      if (v_locked ? 'full_name' and new.full_name is distinct from old.full_name)
        or (v_locked ? 'phone' and new.phone is distinct from old.phone)
        or (v_locked ? 'registration_number' and new.registration_number is distinct from old.registration_number)
        or (v_locked ? 'staff_number' and new.staff_number is distinct from old.staff_number)
        or (v_locked ? 'ic_number' and new.ic_number is distinct from old.ic_number)
      then
        raise exception 'This profile field is currently locked by an administrator.'
          using errcode = '42501';
      end if;
    end if;

    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(v_uid, new.updated_by);
  else
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(v_uid, new.created_by);
    new.updated_at := now();
    new.updated_by := coalesce(v_uid, new.updated_by);
  end if;

  return new;
end;
$$;

revoke all on function private.before_write_staff_profiles() from public, anon, authenticated;

-- Allow authenticated staff to update their own display_name when not locked by admin
create or replace function public.update_my_display_name(
  p_display_name text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id bigint;
  v_clean text;
  v_locked jsonb;
begin
  if not (select private.is_active_approved_user()) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  v_staff_id := private.current_active_staff_id();
  if v_staff_id is null then
    raise exception 'No active staff identity bound to session.' using errcode = 'P0002';
  end if;

  v_locked := private.get_profile_locked_fields();
  if not (select private.is_active_owner()) and (v_locked ? 'display_name') then
    raise exception 'Display name is currently locked by an administrator.'
      using errcode = '42501';
  end if;

  v_clean := nullif(btrim(coalesce(p_display_name, '')), '');
  if v_clean is null then
    raise exception 'Display name cannot be empty.' using errcode = '22023';
  end if;

  update public.staff_directory
  set display_name = v_clean,
      updated_at = now(),
      updated_by = (select auth.uid())
  where id = v_staff_id;

  return true;
end;
$$;

grant execute on function public.update_my_display_name(text) to authenticated;

-- Extend admin_update_staff_member so admins have access to all profile fields
create or replace function public.admin_update_staff_member(
  p_staff_id bigint,
  p_staff_code text,
  p_roster_name text,
  p_display_name text,
  p_staff_group text,
  p_phone text default null::text,
  p_registration_number text default null::text,
  p_email text default null::text,
  p_role text default null::text,
  p_active boolean default true,
  p_staff_number text default null::text,
  p_ic_number text default null::text
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_old_staff public.staff_directory%rowtype;
  v_normalized_email extensions.citext;
  v_allowed_user_id bigint;
begin
  if not private.is_active_owner() then
    raise exception 'Unauthorized: Only an active owner may update staff members.'
      using errcode = '42501';
  end if;

  select * into v_old_staff from public.staff_directory where id = p_staff_id;
  if not found then
    raise exception 'Staff member % not found.', p_staff_id using errcode = 'P0002';
  end if;

  update public.staff_directory
  set staff_code = btrim(p_staff_code),
      roster_name = btrim(p_roster_name),
      display_name = btrim(p_display_name),
      staff_group = btrim(p_staff_group),
      active = p_active,
      updated_at = now(),
      updated_by = (select auth.uid())
  where id = p_staff_id;

  update public.staff_profiles
  set full_name = btrim(p_display_name),
      phone = nullif(btrim(p_phone), ''),
      registration_number = nullif(btrim(p_registration_number), ''),
      staff_number = nullif(btrim(p_staff_number), ''),
      ic_number = nullif(btrim(p_ic_number), ''),
      updated_at = now(),
      updated_by = (select auth.uid())
  where staff_id = p_staff_id;

  if p_email is not null and btrim(p_email) <> '' then
    v_normalized_email := lower(btrim(p_email))::extensions.citext;

    update public.staff_profiles
    set email = v_normalized_email
    where staff_id = p_staff_id;

    select id into v_allowed_user_id from public.allowed_users where staff_id = p_staff_id;
    if found then
      update public.allowed_users
      set email = v_normalized_email,
          role = coalesce(p_role, role),
          updated_at = now(),
          updated_by = (select auth.uid())
      where id = v_allowed_user_id;
    end if;
  elsif p_role is not null then
    update public.allowed_users
    set role = p_role,
        updated_at = now(),
        updated_by = (select auth.uid())
    where staff_id = p_staff_id;
  end if;

  perform private.append_audit_event(
    p_actor_auth_user_id := (select auth.uid()),
    p_actor_staff_id := private.current_active_staff_id(),
    p_action := 'staff.updated',
    p_entity_type := 'staff_directory',
    p_entity_id := p_staff_id::text,
    p_operation_id := null,
    p_before_summary := jsonb_build_object(
      'roster_name', v_old_staff.roster_name,
      'staff_code', v_old_staff.staff_code,
      'staff_group', v_old_staff.staff_group,
      'active', v_old_staff.active
    ),
    p_after_summary := jsonb_build_object(
      'roster_name', btrim(p_roster_name),
      'staff_code', btrim(p_staff_code),
      'staff_group', btrim(p_staff_group),
      'active', p_active
    ),
    p_reason := 'Owner edited staff details'
  );

  return true;
end;
$$;
