-- =============================================================================
-- Migration: Telegram 1-tap deep-link binding & duty alert preferences
-- =============================================================================

alter table public.staff_profiles
  add column if not exists telegram_chat_id text null,
  add column if not exists telegram_username text null,
  add column if not exists telegram_linked_at timestamptz null,
  add column if not exists telegram_alerts_enabled boolean not null default true,
  add column if not exists telegram_link_token text null,
  add column if not exists telegram_link_token_expires_at timestamptz null;

create unique index if not exists staff_profiles_telegram_link_token_idx
  on public.staff_profiles (telegram_link_token)
  where telegram_link_token is not null;

-- Keep self-service guard in sync so browser sessions can toggle
-- telegram_alerts_enabled, but cannot forge chat_id or link tokens.
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
        or new.telegram_chat_id is distinct from old.telegram_chat_id
        or new.telegram_username is distinct from old.telegram_username
        or new.telegram_linked_at is distinct from old.telegram_linked_at
        or new.telegram_link_token is distinct from old.telegram_link_token
        or new.telegram_link_token_expires_at is distinct from old.telegram_link_token_expires_at
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

create or replace function public.create_my_telegram_link_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id bigint;
  v_token text;
begin
  if not (select private.is_active_approved_user()) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  v_staff_id := private.current_active_staff_id();
  if v_staff_id is null then
    raise exception 'No active staff identity bound to session.' using errcode = 'P0002';
  end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  update public.staff_profiles
  set telegram_link_token = v_token,
      telegram_link_token_expires_at = now() + interval '15 minutes',
      updated_at = now(),
      updated_by = (select auth.uid())
  where staff_id = v_staff_id;

  return v_token;
end;
$$;

grant execute on function public.create_my_telegram_link_token() to authenticated;

create or replace function public.unlink_my_telegram()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_id bigint;
begin
  if not (select private.is_active_approved_user()) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  v_staff_id := private.current_active_staff_id();
  if v_staff_id is null then
    raise exception 'No active staff identity bound to session.' using errcode = 'P0002';
  end if;

  update public.staff_profiles
  set telegram_chat_id = null,
      telegram_username = null,
      telegram_linked_at = null,
      telegram_link_token = null,
      telegram_link_token_expires_at = null,
      updated_at = now(),
      updated_by = (select auth.uid())
  where staff_id = v_staff_id;

  return true;
end;
$$;

grant execute on function public.unlink_my_telegram() to authenticated;
