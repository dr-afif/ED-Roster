-- =============================================================================
-- Migration: Add admin_update_staff_member RPC for Owner Staff Management
-- =============================================================================

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
  p_active boolean default true
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
