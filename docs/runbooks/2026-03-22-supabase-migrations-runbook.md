# Supabase migrations runbook

Date: 2026-03-22
Project: Viaje360

## Status checked from local environment

Local environment currently has:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Local environment does **not** currently expose a direct migration toolchain for remote apply:
- Supabase CLI is not installed on this machine/session
- No Postgres connection string or DB password is present in `.env.local`
- No Supabase management access token is present in `.env.local`

That means: from this repo, we can verify schema usage against the remote project, but we cannot safely push SQL migrations automatically to a fresh remote project without extra admin credentials/tooling.

## Current migration order

Run these files in this exact order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_itinerary_versioning.sql`
3. `supabase/migrations/003_cache_tables.sql`

## What each migration creates

### 001
Creates:
- `profiles`
- `onboarding_profiles`
- `trips`
- `itinerary_days`
- `activities`
- `chat_messages`
- `achievements`
- `monuments`
- RLS policies
- `handle_new_user()` trigger function
- `on_auth_user_created` trigger
- core indexes

### 002
Creates:
- `itinerary_versions`
- `adaptation_events`
- RLS policies
- versioning indexes

### 003
Creates:
- `places_cache`
- `weather_cache`
- cache cleanup function `cleanup_expired_cache()`
- cache indexes

Also ensures `pgcrypto` is enabled for `gen_random_uuid()`.

## Manual apply via Supabase SQL Editor

Use this when setting up a fresh project or if you need to repair a missing migration manually.

### Step 1 — open the correct project
1. Open `https://supabase.com/dashboard`
2. Select the Viaje360 project
3. Go to **SQL Editor**
4. Click **New query**

### Step 2 — run migration 001
1. Open local file: `supabase/migrations/001_initial_schema.sql`
2. Copy the entire file
3. Paste it into SQL Editor
4. Click **Run**
5. Confirm the query finishes successfully before continuing

### Step 3 — run migration 002
1. Open local file: `supabase/migrations/002_itinerary_versioning.sql`
2. Copy the entire file
3. Paste into a new SQL query
4. Click **Run**

### Step 4 — run migration 003
1. Open local file: `supabase/migrations/003_cache_tables.sql`
2. Copy the entire file
3. Paste into a new SQL query
4. Click **Run**

## Verification queries

Run these after the migrations.

### A. Tables exist
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'onboarding_profiles',
    'trips',
    'itinerary_days',
    'activities',
    'chat_messages',
    'achievements',
    'monuments',
    'itinerary_versions',
    'adaptation_events',
    'places_cache',
    'weather_cache'
  )
order by table_name;
```

Expected: 12 rows.

### B. Critical columns used by the app exist
```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'trips' and column_name in ('id','user_id','onboarding_id','name','destination','start_date','end_date','budget','spent','status','current_activity','weather_temp','weather_condition','weather_icon','created_at','updated_at'))
    or (table_name = 'itinerary_days' and column_name in ('id','trip_id','day_number','date','theme','is_rest_day','created_at'))
    or (table_name = 'activities' and column_name in ('id','day_id','trip_id','name','type','location','address','time','end_time','duration','cost','booked','notes','icon','neighborhood','is_ai_suggestion','weather_dependent','indoor','kid_friendly','pet_friendly','dietary_tags','sort_order','created_at'))
    or (table_name = 'chat_messages' and column_name in ('id','trip_id','user_id','role','content','suggestions','created_at'))
    or (table_name = 'itinerary_versions' and column_name in ('id','trip_id','version_number','parent_version_id','snapshot','source','reason','created_by','created_at'))
    or (table_name = 'adaptation_events' and column_name in ('id','trip_id','from_version_id','to_version_id','source','reason','metadata','created_at'))
    or (table_name = 'places_cache' and column_name in ('id','cache_key','location','query','results','provider','created_at','expires_at'))
    or (table_name = 'weather_cache' and column_name in ('id','cache_key','lat','lng','result','forecast','created_at','expires_at'))
  )
order by table_name, column_name;
```

### C. RLS enabled on user-owned tables
```sql
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'profiles',
    'onboarding_profiles',
    'trips',
    'itinerary_days',
    'activities',
    'chat_messages',
    'achievements',
    'monuments',
    'itinerary_versions',
    'adaptation_events'
  )
order by relname;
```

Expected: all `true`.

### D. Cache cleanup function exists
```sql
select n.nspname as schema_name, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'cleanup_expired_cache';
```

Expected: 1 row.

### E. UUID extensions available
```sql
select extname
from pg_extension
where extname in ('uuid-ossp', 'pgcrypto')
order by extname;
```

Expected: `uuid-ossp` and `pgcrypto`.

## App-level verification

After SQL is applied, verify from the app:

1. `npm run build`
2. Start the app
3. Exercise these flows:
   - generate itinerary
   - load active trip
   - persist/read chat history
   - adapt itinerary
   - places cache path (if `FEATURE_PLACES_CACHE=true`)
   - weather cache path (if `FEATURE_WEATHER_CACHE=true`)

## If a fresh remote project must be set up later

You need one of these admin paths:

### Option A — Supabase CLI
Install CLI and authenticate, then link/apply against the target project.
Typical flow:
```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

### Option B — direct Postgres access
Use the project’s DB password/connection string from Supabase dashboard and run the SQL files with `psql` or another SQL client.

### Option C — SQL Editor only
Use the manual SQL Editor sequence above.

## Notes
- `003_cache_tables.sql` now explicitly enables `pgcrypto` so it is safe on a clean database where `gen_random_uuid()` is not already available.
- The app code expects all 12 public tables listed above.
- Cache tables are intended for server-side access via service role; user-owned domain tables use RLS.
