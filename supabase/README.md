# Supabase Setup

## Migration status

Viaje360 expects **three** SQL migrations, in this order:

1. `migrations/001_initial_schema.sql`
2. `migrations/002_itinerary_versioning.sql`
3. `migrations/003_cache_tables.sql`

See the full step-by-step runbook here:
- `docs/runbooks/2026-03-22-supabase-migrations-runbook.md`

## Quick manual setup in Supabase dashboard

1. Open your Supabase project dashboard at https://supabase.com/dashboard
2. Go to **SQL Editor**
3. Run each migration file in order: `001`, then `002`, then `003`
4. Run the verification queries from the runbook

## Environment variables

Make sure your `.env.local` has:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Find these in Supabase dashboard under **Settings → API**.

## Tables expected by the app

### Core domain tables
- `profiles`
- `onboarding_profiles`
- `trips`
- `itinerary_days`
- `activities`
- `chat_messages`
- `achievements`
- `monuments`

### Versioning tables
- `itinerary_versions`
- `adaptation_events`

### Cache tables
- `places_cache`
- `weather_cache`

## Demo mode

When no authenticated user is present, the app can use demo/fallback data depending on environment and feature flags. Supabase-backed operations fail closed or skip gracefully where designed.
