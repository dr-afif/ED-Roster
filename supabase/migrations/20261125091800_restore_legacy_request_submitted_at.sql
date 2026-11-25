-- Restore original submission/creation timestamps for legacy_sheets requests
-- from their legacy_source_id ('REQ:<epoch_ms>').
update public.roster_requests
set
  submitted_at = to_timestamp(substring(legacy_source_id from 5)::bigint / 1000.0),
  created_at = to_timestamp(substring(legacy_source_id from 5)::bigint / 1000.0)
where source_system = 'legacy_sheets'
  and legacy_source_id ~ '^REQ:[0-9]{13}$';
