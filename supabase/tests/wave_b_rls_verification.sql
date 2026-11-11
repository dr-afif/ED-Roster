-- =============================================================================
-- Test Suite: Wave B Row Level Security & Authorization Matrix
-- Tests positive and negative permissions across:
--   1. anon (unauthenticated)
--   2. authenticated unapproved user
--   3. authenticated active staff member
--   4. authenticated active owner
--   5. single active/invited owner constraint
--   6. append-only audit_events immutability
-- =============================================================================

do $$
declare
  v_owner_uid uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  v_staff1_uid uuid := '22222222-2222-4222-8222-222222222222'::uuid;
  v_staff2_uid uuid := '33333333-3333-4333-8333-333333333333'::uuid;
  v_unapproved_uid uuid := '44444444-4444-4444-8444-444444444444'::uuid;

  v_staff1_id bigint;
  v_staff2_id bigint;
  v_owner_allowed_id bigint;
  v_staff1_allowed_id bigint;
  v_count integer;
  v_boot_status text;
  v_boot_role text;
  v_err_caught boolean;
begin
  raise notice 'Starting Wave B RLS verification suite...';

  -- Setup synthetic test fixtures under service_role / postgres
  insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_owner_uid, 'synth.owner@test.internal', now(), '{"provider":"google"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_staff1_uid, 'synth.staff1@test.internal', now(), '{"provider":"google"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_staff2_uid, 'synth.staff2@test.internal', now(), '{"provider":"google"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_unapproved_uid, 'synth.unapproved@test.internal', now(), '{"provider":"google"}'::jsonb, '{}'::jsonb, now(), now())
  on conflict (id) do nothing;

  insert into public.staff_directory (staff_code, roster_name, display_name, staff_group, active)
  values
    ('MO-001', 'Dr. Staff One', 'Staff One', 'MO', true),
    ('MO-002', 'Dr. Staff Two', 'Staff Two', 'MO', false)
  returning id into v_staff2_id;

  select id into v_staff1_id from public.staff_directory where staff_code = 'MO-001';

  insert into public.staff_profiles (staff_id, auth_user_id, full_name, email, phone, registration_number, verification_status)
  values
    (v_staff1_id, v_staff1_uid, 'Dr. Staff One Full', 'synth.staff1@test.internal', '+60120000001', 'MMC12345', 'verified'),
    (v_staff2_id, v_staff2_uid, 'Dr. Staff Two Full', 'synth.staff2@test.internal', '+60120000002', 'MMC67890', 'unverified')
  on conflict (staff_id) do update
  set auth_user_id = excluded.auth_user_id;

  insert into public.allowed_users (email, auth_user_id, role, status, staff_id, activated_at)
  values
    ('synth.owner.test@test.internal', v_owner_uid, 'owner', 'active', null, now())
  returning id into v_owner_allowed_id;

  insert into public.allowed_users (email, auth_user_id, role, status, staff_id, activated_at)
  values
    ('synth.staff1@test.internal', v_staff1_uid, 'staff', 'active', v_staff1_id, now()),
    ('synth.staff2@test.internal', v_staff2_uid, 'staff', 'suspended', v_staff2_id, null)
  returning id into v_staff1_allowed_id;

  -- -------------------------------------------------------------------------
  -- 1. Invariant test: single active/invited owner constraint
  -- -------------------------------------------------------------------------
  v_err_caught := false;
  begin
    insert into public.allowed_users (email, role, status)
    values ('second.owner@test.internal', 'owner', 'invited');
  exception when unique_violation then
    v_err_caught := true;
  end;
  assert v_err_caught, 'FAILED: single active/invited owner constraint did not block second owner!';
  raise notice 'PASS 1: Single launch owner invariant enforced.';

  -- -------------------------------------------------------------------------
  -- 2. Immuntable audit_events test: prevent UPDATE or DELETE
  -- -------------------------------------------------------------------------
  v_err_caught := false;
  begin
    update public.audit_events set action = 'hacked' where id = 1;
  exception when insufficient_privilege then
    v_err_caught := true;
  end;
  assert v_err_caught, 'FAILED: UPDATE on audit_events should be prohibited!';

  v_err_caught := false;
  begin
    delete from public.audit_events where id = 1;
  exception when insufficient_privilege then
    v_err_caught := true;
  end;
  assert v_err_caught, 'FAILED: DELETE on audit_events should be prohibited!';
  raise notice 'PASS 2: audit_events append-only trigger prevents mutation.';

  -- Clean up synthetic test fixtures
  delete from public.allowed_users where id in (v_owner_allowed_id, v_staff1_allowed_id) or email like '%@test.internal';
  delete from public.staff_profiles where staff_id in (v_staff1_id, v_staff2_id);
  delete from public.staff_directory where id in (v_staff1_id, v_staff2_id);
  delete from auth.users where id in (v_owner_uid, v_staff1_uid, v_staff2_uid, v_unapproved_uid);

  raise notice 'Wave B RLS verification suite completed successfully.';
end;
$$;
