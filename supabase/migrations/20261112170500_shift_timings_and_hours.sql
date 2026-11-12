-- Migration: 20261112170500_shift_timings_and_hours.sql
-- Add explicit start_time, end_time, and duration_hours to shift_definitions for seamless shift hours tracking

alter table public.shift_definitions 
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists duration_hours numeric(4,2) default 0.0;

comment on column public.shift_definitions.start_time is 'Scheduled shift start time (e.g. 08:00:00).';
comment on column public.shift_definitions.end_time is 'Scheduled shift end time (e.g. 16:00:00).';
comment on column public.shift_definitions.duration_hours is 'Calculated duty duration in decimal hours (e.g. 8.00).';

-- Populate existing shift timings and durations
update public.shift_definitions set
  start_time = '08:00:00',
  end_time = '16:00:00',
  duration_hours = 8.0
where code = 'AM';

update public.shift_definitions set
  start_time = '16:00:00',
  end_time = '23:00:00',
  duration_hours = 7.0
where code = 'PM';

update public.shift_definitions set
  start_time = '23:00:00',
  end_time = '08:00:00',
  duration_hours = 9.0
where code in ('ON', 'ON1', 'ON2', 'NIGHT', 'ND');

update public.shift_definitions set
  start_time = '08:00:00',
  end_time = '17:00:00',
  duration_hours = 8.0
where code = 'COURSE';

update public.shift_definitions set
  start_time = null,
  end_time = null,
  duration_hours = 0.0
where code in ('PN', 'OFF', 'GOFF', 'AL', 'MC', 'EL', 'HKA', 'GHKA');
