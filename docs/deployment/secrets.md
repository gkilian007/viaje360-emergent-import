# Secrets and Configuration

## Required secrets

### Core app
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for trusted server operations, cache persistence, versioning, and admin writes)
- `GEMINI_API_KEY` (required for chat, itinerary generation, and places fallback)

## Optional secrets

### Places provider
- `GOOGLE_PLACES_API_KEY`
  - Optional
  - Enables Google Places as primary provider when `FEATURE_GOOGLE_PLACES=true`
  - If absent, Gemini fallback remains active

## Feature flags

Set as environment variables:
- `FEATURE_GOOGLE_PLACES=true|false`
- `FEATURE_OPEN_METEO=true|false`
- `FEATURE_PLACES_CACHE=true|false`
- `FEATURE_WEATHER_CACHE=true|false`
- `FEATURE_RATE_LIMITING=true|false`

## Operational notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- `NEXT_PUBLIC_*` vars are client-visible by design.
- Google Places should be considered optional infrastructure, not a hard dependency.
- Rotate API keys independently by environment.
