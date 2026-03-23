-- Self-learning travel memory foundation

create table public.activity_knowledge (
  id uuid primary key default uuid_generate_v4(),
  canonical_name text not null,
  normalized_name text not null,
  destination text not null,
  country text,
  category text not null,
  address text,
  latitude numeric,
  longitude numeric,
  source_kind text not null,
  official_url text,
  booking_url text,
  menu_url text,
  price_per_person numeric,
  ticket_price numeric,
  image_query text,
  tags text[] default '{}',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.trip_activity_events (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  activity_knowledge_id uuid references public.activity_knowledge(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  event_value text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table public.trip_day_journals (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  day_number integer not null,
  date date not null,
  conversation jsonb default '[]'::jsonb,
  free_text_summary text,
  mood text,
  energy_score integer,
  pace_score integer,
  would_repeat boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.trip_day_activity_feedback (
  id uuid primary key default uuid_generate_v4(),
  trip_day_journal_id uuid not null references public.trip_day_journals(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  activity_knowledge_id uuid references public.activity_knowledge(id) on delete set null,
  rating integer,
  liked boolean,
  notes text,
  would_repeat boolean,
  would_recommend boolean,
  discovered_outside_plan boolean default false,
  created_at timestamptz default now()
);

create table public.user_destination_memory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  destination text not null,
  country text,
  visit_count integer default 1,
  last_trip_id uuid references public.trips(id) on delete set null,
  summary text,
  liked_tags text[] default '{}',
  disliked_tags text[] default '{}',
  favorite_activity_ids uuid[] default '{}',
  skipped_activity_ids uuid[] default '{}',
  unfinished_activity_ids uuid[] default '{}',
  discovered_places jsonb default '[]'::jsonb,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, destination, country)
);

create table public.user_preference_signals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  signal_type text not null,
  signal_key text not null,
  signal_value numeric not null default 0,
  context jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, signal_type, signal_key)
);

create table public.destination_aggregate_signals (
  id uuid primary key default uuid_generate_v4(),
  destination text not null,
  country text,
  segment_key text not null,
  category text not null,
  entity_key text not null,
  score numeric not null default 0,
  sample_size integer not null default 0,
  metadata jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(destination, country, segment_key, category, entity_key)
);

alter table public.activity_knowledge enable row level security;
alter table public.trip_activity_events enable row level security;
alter table public.trip_day_journals enable row level security;
alter table public.trip_day_activity_feedback enable row level security;
alter table public.user_destination_memory enable row level security;
alter table public.user_preference_signals enable row level security;
alter table public.destination_aggregate_signals enable row level security;

create policy "Users can view activity knowledge" on public.activity_knowledge
  for select using (true);

create policy "Service role can manage activity knowledge" on public.activity_knowledge
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "Users can manage own trip activity events" on public.trip_activity_events
  for all using (trip_id in (select id from public.trips where user_id = auth.uid()));

create policy "Users can manage own trip day journals" on public.trip_day_journals
  for all using (trip_id in (select id from public.trips where user_id = auth.uid()));

create policy "Users can manage own day feedback" on public.trip_day_activity_feedback
  for all using (trip_id in (select id from public.trips where user_id = auth.uid()));

create policy "Users can manage own destination memory" on public.user_destination_memory
  for all using (user_id = auth.uid());

create policy "Users can manage own preference signals" on public.user_preference_signals
  for all using (user_id = auth.uid());

create policy "Users can view aggregate destination signals" on public.destination_aggregate_signals
  for select using (true);

create policy "Service role can manage aggregate destination signals" on public.destination_aggregate_signals
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index idx_activity_knowledge_lookup
  on public.activity_knowledge(destination, normalized_name);

create index idx_trip_activity_events_trip
  on public.trip_activity_events(trip_id, created_at desc);

create index idx_trip_day_journals_trip_day
  on public.trip_day_journals(trip_id, day_number);

create index idx_user_destination_memory_user_destination
  on public.user_destination_memory(user_id, destination);

create index idx_user_preference_signals_user_type
  on public.user_preference_signals(user_id, signal_type);

create index idx_destination_aggregate_signals_lookup
  on public.destination_aggregate_signals(destination, segment_key, category);
