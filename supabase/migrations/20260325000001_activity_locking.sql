alter table public.activities
  add column if not exists is_locked boolean not null default false;

create index if not exists idx_activities_trip_locked
  on public.activities(trip_id, is_locked);
