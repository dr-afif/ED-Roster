-- =============================================================================
-- Migration: Allow creating staff members without an email / allowlist entry
-- =============================================================================

create or replace function public.admin_create_staff_member(
  p_email text,
  p_role text,
  p_staff_code text,
  p_roster_name text,
  p_display_name text,
  p_staff_group text,
  p_phone text default null,
  p_registration_number text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id bigint;
  v_normalized_email extensions.citext;
  v_existing_allowed_id bigint;
begin
  if not private.is_active_owner() then
    raise exception 'Unauthorized: Only an active owner may create staff members.'
      using errcode = '42501';
  end if;

  v_normalized_email := nullif(lower(btrim(coalesce(p_email, ''))), '')::extensions.citext;

  if p_role not in ('owner', 'staff') then
    raise exception 'Invalid role: must be owner or staff.'
      using errcode = '22023';
  end if;

  -- 1. Create operational staff directory record
  insert into public.staff_directory (
    staff_code,
    roster_name,
    display_name,
    staff_group,
    employment_status,
    active,
    created_by,
    updated_by
  ) values (
    btrim(p_staff_code),
    btrim(p_roster_name),
    btrim(p_display_name),
    btrim(p_staff_group),
    'active',
    true,
    (select auth.uid()),
    (select auth.uid())
  )
  returning id into v_staff_id;

  -- 2. Create corresponding staff profile (email nullable until assigned)
  insert into public.staff_profiles (
    staff_id,
    full_name,
    email,
    phone,
    registration_number,
    verification_status,
    created_by,
    updated_by
  ) values (
    v_staff_id,
    btrim(p_display_name),
    v_normalized_email,
    nullif(btrim(p_phone), ''),
    nullif(btrim(p_registration_number), ''),
    'unverified',
    (select auth.uid()),
    (select auth.uid())
  );

  -- 3. Upsert allowlist entry only when an email is provided
  if v_normalized_email is not null then
    select id into v_existing_allowed_id
    from public.allowed_users
    where email = v_normalized_email;

    if found then
      update public.allowed_users
      set staff_id = v_staff_id,
          role = p_role,
          updated_at = now(),
          updated_by = (select auth.uid())
      where id = v_existing_allowed_id;
    else
      insert into public.allowed_users (
        email,
        role,
        status,
        staff_id,
        invited_by,
        created_by,
        updated_by
      ) values (
        v_normalized_email,
        p_role,
        'invited',
        v_staff_id,
        (select auth.uid()),
        (select auth.uid()),
        (select auth.uid())
      );
    end if;
  end if;

  return v_staff_id;
end;
$$;
