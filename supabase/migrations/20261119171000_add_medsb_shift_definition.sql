-- Ensure MEDSB (Medical Standby) exists in shift_definitions and shift_semantics
insert into public.shift_definitions (
  code,
  label,
  short_label,
  color_token,
  duration_hours,
  is_active,
  sort_order
) values (
  'MEDSB',
  'Medical Standby',
  'MEDSB',
  'amber',
  12,
  true,
  55
)
on conflict (code) do update set
  label = excluded.label,
  short_label = excluded.short_label,
  color_token = excluded.color_token,
  is_active = true;

insert into public.shift_semantics (
  shift_code,
  semantic_class,
  provides_coverage,
  night_policy_b_qualifying,
  displaces_off_earns_goff
) values (
  'MEDSB',
  'worked',
  true,
  false,
  false
)
on conflict (shift_code) do update set
  semantic_class = excluded.semantic_class,
  provides_coverage = excluded.provides_coverage;
