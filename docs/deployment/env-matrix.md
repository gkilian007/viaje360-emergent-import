# Environment Matrix

## Overview

Viaje360 backend supports three environments:
- **dev**: local development with optional anonymous fallback
- **staging**: production-like validation environment
- **prod**: live environment with strict secrets and feature control

## Matrix

| Variable | dev | staging | prod | Required |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | yes | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | yes | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | optional* | yes | yes | yes for cache/persistence server paths |
| `GEMINI_API_KEY` | recommended | yes | yes | yes for AI/chat and places fallback |
| `GOOGLE_PLACES_API_KEY` | optional | optional | optional | no |
| `FEATURE_GOOGLE_PLACES` | optional | recommended | recommended | no |
| `FEATURE_OPEN_METEO` | optional | recommended | recommended | no |
| `FEATURE_PLACES_CACHE` | optional | recommended | recommended | no |
| `FEATURE_WEATHER_CACHE` | optional | recommended | recommended | no |
| `FEATURE_RATE_LIMITING` | optional | yes | yes | no |

\* In dev, the app still works without service role for reduced/fallback flows, but Supabase-backed caching and some trusted server writes will be disabled/fail closed.

## Recommended defaults

### dev
```env
FEATURE_GOOGLE_PLACES=false
FEATURE_OPEN_METEO=true
FEATURE_PLACES_CACHE=false
FEATURE_WEATHER_CACHE=false
FEATURE_RATE_LIMITING=false
```

### staging
```env
FEATURE_GOOGLE_PLACES=true
FEATURE_OPEN_METEO=true
FEATURE_PLACES_CACHE=true
FEATURE_WEATHER_CACHE=true
FEATURE_RATE_LIMITING=true
```

### prod
```env
FEATURE_GOOGLE_PLACES=true
FEATURE_OPEN_METEO=true
FEATURE_PLACES_CACHE=true
FEATURE_WEATHER_CACHE=true
FEATURE_RATE_LIMITING=true
```

## Fallback behavior

- If `GOOGLE_PLACES_API_KEY` is missing or Google Places fails, Viaje360 falls back to Gemini places search.
- If cache flags are off, requests go directly to providers.
- If `FEATURE_OPEN_METEO=false`, weather route returns empty weather payloads instead of failing provider calls.
