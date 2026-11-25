-- =============================================================================
-- Migration: Telegram delivery audit log & owner staff-status lookup RPC
-- Supports both Roster Published broadcasts and Amendment updates.
-- =============================================================================

create table if not exists public.roster_telegram_deliveries (
  id bigint generated always as identity primary key,
  period_id bigint not null references public.roster_periods(id) on delete cascade,
  staff_id bigint not null references public.staff_directory(id) on delete restrict,
  notification_type text not null check (
    notification_type in ('published_broadcast', 'amendment_update')
  ),
  amendment_event_ids bigint[] null,
  message_text text not null,
  telegram_chat_id text null,
  telegram_message_id text null,
  status text not null check (status in ('sent', 'failed')),
  error_message text null,
  sent_at timestamptz not null default now(),
  sent_by uuid null references auth.users(id) on delete set null
);

create index if not exists roster_telegram_deliveries_period_idx
  on public.roster_telegram_deliveries (period_id, sent_at desc);

create index if not exists roster_telegram_deliveries_staff_idx
  on public.roster_telegram_deliveries (staff_id, sent_at desc);

alter table public.roster_telegram_deliveries enable row level security;

create policy "roster_telegram_deliveries_select_owner"
  on public.roster_telegram_deliveries
  for select
  to authenticated
  using ((select private.is_active_owner()));

grant select on table public.roster_telegram_deliveries to authenticated;
grant all on table public.roster_telegram_deliveries to service_role;

-- Safe owner-only lookup of staff Telegram link & alert preferences
-- without exposing raw telegram_chat_id to the browser.
create or replace function public.get_staff_telegram_status()
returns table (
  staff_id bigint,
  telegram_linked boolean,
  telegram_username text,
  telegram_alerts_enabled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sp.staff_id,
    (sp.telegram_chat_id is not null) as telegram_linked,
    sp.telegram_username,
    sp.telegram_alerts_enabled
  from public.staff_profiles sp
  where (select private.is_active_owner());
$$;

grant execute on function public.get_staff_telegram_status() to authenticated;
