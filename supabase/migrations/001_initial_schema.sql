-- Enable UUID
create extension if not exists "uuid-ossp";

-- USERS (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  level integer default 1,
  xp integer default 0,
  xp_to_next integer default 500,
  title text default 'Viajero Novato',
  total_trips integer default 0,
  countries_visited integer default 0,
  monuments_collected integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ONBOARDING PROFILES (all wizard data)
create table public.onboarding_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  destination text not null,
  start_date date not null,
  end_date date not null,
  arrival_time text,
  departure_time text,
  companion text not null,
  group_size integer default 1,
  kids_pets text[] default '{}',
  mobility text default 'full',
  accommodation_zone text,
  interests text[] default '{}',
  traveler_style text,
  famous_local text default 'mix',
  pace integer default 5,
  rest_days boolean default false,
  rest_frequency text,
  wake_style integer default 5,
  siesta boolean default false,
  budget_level text default 'moderado',
  splurge_categories text[] default '{}',
  dietary_restrictions text[] default '{}',
  allergies text,
  transport text[] default '{}',
  weather_adaptation boolean default true,
  first_time boolean default true,
  must_see text,
  must_avoid text,
  booked_tickets text,
  created_at timestamptz default now()
);

-- TRIPS
create table public.trips (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  onboarding_id uuid references public.onboarding_profiles(id),
  name text not null,
  destination text not null,
  country text,
  start_date date not null,
  end_date date not null,
  budget numeric default 0,
  spent numeric default 0,
  status text default 'active',
  current_activity text,
  weather_temp numeric,
  weather_condition text,
  weather_icon text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ITINERARY DAYS
create table public.itinerary_days (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references public.trips(id) on delete cascade,
  day_number integer not null,
  date date not null,
  theme text,
  is_rest_day boolean default false,
  created_at timestamptz default now()
);

-- ACTIVITIES
create table public.activities (
  id uuid primary key default uuid_generate_v4(),
  day_id uuid references public.itinerary_days(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  name text not null,
  type text not null,
  location text,
  address text,
  latitude numeric,
  longitude numeric,
  time text,
  end_time text,
  duration integer,
  cost numeric default 0,
  booked boolean default false,
  notes text,
  icon text,
  neighborhood text,
  is_ai_suggestion boolean default false,
  weather_dependent boolean default false,
  indoor boolean default false,
  accessibility_info text,
  kid_friendly boolean default false,
  pet_friendly boolean default false,
  dietary_tags text[] default '{}',
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- CHAT MESSAGES
create table public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references public.trips(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null,
  content text not null,
  suggestions jsonb,
  created_at timestamptz default now()
);

-- ACHIEVEMENTS
create table public.achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  rarity text default 'common',
  xp_reward integer default 50,
  icon text,
  location text,
  unlocked boolean default false,
  unlocked_at timestamptz,
  created_at timestamptz default now()
);

-- MONUMENTS COLLECTED
create table public.monuments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id),
  name text not null,
  location text,
  description text,
  rarity text default 'common',
  xp_reward integer default 100,
  collected boolean default false,
  collected_at timestamptz,
  latitude numeric,
  longitude numeric,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.onboarding_profiles enable row level security;
alter table public.trips enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.activities enable row level security;
alter table public.chat_messages enable row level security;
alter table public.achievements enable row level security;
alter table public.monuments enable row level security;

-- RLS Policies: users can only access their own data
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Users can manage own onboarding" on public.onboarding_profiles for all using (auth.uid() = user_id);
create policy "Users can manage own trips" on public.trips for all using (auth.uid() = user_id);
create policy "Users can manage own itinerary days" on public.itinerary_days for all using (trip_id in (select id from public.trips where user_id = auth.uid()));
create policy "Users can manage own activities" on public.activities for all using (trip_id in (select id from public.trips where user_id = auth.uid()));
create policy "Users can manage own chat" on public.chat_messages for all using (auth.uid() = user_id);
create policy "Users can manage own achievements" on public.achievements for all using (auth.uid() = user_id);
create policy "Users can manage own monuments" on public.monuments for all using (auth.uid() = user_id);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Indexes
create index idx_trips_user on public.trips(user_id);
create index idx_activities_day on public.activities(day_id);
create index idx_activities_trip on public.activities(trip_id);
create index idx_chat_trip on public.chat_messages(trip_id);
create index idx_monuments_user on public.monuments(user_id);
