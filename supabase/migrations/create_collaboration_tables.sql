-- Trip collaboration table

create table if not exists public.trip_collaborators (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted boolean not null default false,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_collaborators_trip on public.trip_collaborators(trip_id);
create index if not exists idx_trip_collaborators_email on public.trip_collaborators(email);
create unique index if not exists idx_trip_collaborators_unique on public.trip_collaborators(trip_id, email);

alter table public.trip_collaborators enable row level security;

create policy "Trip owner can manage collaborators"
  on public.trip_collaborators for all
  using (
    exists (select 1 from public.trips where id = trip_id and user_id = auth.uid())
    or user_id = auth.uid()
    or invited_by = auth.uid()
  );

create policy "Collaborators can read their invitations"
  on public.trip_collaborators for select
  using (email = (select email from auth.users where id = auth.uid()));
