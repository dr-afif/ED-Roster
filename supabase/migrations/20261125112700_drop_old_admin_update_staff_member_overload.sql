-- Remove old 10-argument overload of admin_update_staff_member so PostgREST
-- unambiguously resolves the 12-argument version (with p_staff_number, p_ic_number).
drop function if exists public.admin_update_staff_member(
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
);
