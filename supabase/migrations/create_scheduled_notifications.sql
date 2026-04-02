-- Migration: create_scheduled_notifications
-- Stores push notifications that should be sent at a specific time.
-- A cron worker reads this table and calls /api/notifications/send for unsent rows.

create table if not exists public.scheduled_notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  trip_id       uuid not null references public.trips(id) on delete cascade,
  activity_name text not null default '',
  title         text not null,
  body          text not null,
  url           text not null default '/plan',
  scheduled_at  timestamptz not null,
  sent          boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Index for the cron worker: fetch unsent rows due now
create index if not exists idx_scheduled_notifications_pending
  on public.scheduled_notifications (scheduled_at)
  where sent = false;

-- RLS: users can only see their own scheduled notifications
alter table public.scheduled_notifications enable row level security;

create policy "Users can read own scheduled notifications"
  on public.scheduled_notifications
  for select
  using (auth.uid() = user_id);

create policy "Service role can manage scheduled notifications"
  on public.scheduled_notifications
  for all
  using (true)
  with check (true);
