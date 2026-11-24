alter table public.request_status_events
  drop constraint if exists request_status_events_status_chk;

alter table public.request_status_events
  add constraint request_status_events_status_chk
  check (new_status in ('active', 'draft', 'submitted', 'approved', 'rejected', 'withdrawn', 'superseded'));
