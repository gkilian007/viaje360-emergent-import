# Supabase Setup

## Running the Migration

1. Open your Supabase project dashboard at https://supabase.com/dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New query**
4. Copy and paste the contents of `migrations/001_initial_schema.sql`
5. Click **Run** (or press Ctrl+Enter)

This will create all tables, enable Row Level Security, set up RLS policies, and add the trigger that auto-creates a profile when a user signs up.

## Environment Variables

Make sure your `.env.local` has:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Find these in your Supabase dashboard under **Settings → API**.

## Tables

| Table | Description |
|-------|-------------|
| `profiles` | Extends auth.users with gamification data |
| `onboarding_profiles` | Stores all 18-step wizard answers |
| `trips` | Active and past trips |
| `itinerary_days` | Day-by-day trip structure |
| `activities` | Individual activities per day |
| `chat_messages` | AI chat history per trip |
| `achievements` | Unlocked achievements per user |
| `monuments` | Collected monuments per user |

## Demo Mode

When no authenticated user is present, the app uses demo data from `src/lib/demo-data.ts`. Supabase operations are skipped gracefully.
