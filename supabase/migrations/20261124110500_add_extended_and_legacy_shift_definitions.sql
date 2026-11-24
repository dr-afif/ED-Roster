insert into public.shift_definitions (code, label, short_label, color_token, start_time, end_time, duration_hours, is_active, sort_order)
values
  ('AMX', 'Morning Shift Extended (08:00 - 17:00)', 'AMX', 'am', '08:00:00', '17:00:00', 9.0, true, 15),
  ('PMX', 'Evening Shift Extended (14:00 - 23:00)', 'PMX', 'pm', '14:00:00', '23:00:00', 9.0, true, 25),
  ('OH', 'Office Hour (08:00 - 17:00)', 'OH', 'am', '08:00:00', '17:00:00', 9.0, true, 18),
  ('COURT', 'Court / Official Duty', 'COURT', 'course', '08:00:00', '17:00:00', 8.0, true, 92)
on conflict (code) do update set
  label = excluded.label,
  short_label = excluded.short_label,
  color_token = excluded.color_token,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  duration_hours = excluded.duration_hours,
  is_active = true;

insert into public.shift_semantics (shift_code, semantic_class, provides_coverage, night_policy_b_qualifying, displaces_off_earns_goff)
values
  ('AMX', 'worked', true, false, false),
  ('PMX', 'worked', true, false, false),
  ('OH', 'worked', true, false, false),
  ('COURT', 'reset', false, false, false)
on conflict (shift_code) do update set
  semantic_class = excluded.semantic_class,
  provides_coverage = excluded.provides_coverage;
