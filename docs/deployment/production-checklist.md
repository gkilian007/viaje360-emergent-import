# Production Checklist

## Before deploy

- [ ] Supabase migrations applied in order: `001`, `002`, `003`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configured
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configured
- [ ] `GEMINI_API_KEY` configured
- [ ] `GOOGLE_PLACES_API_KEY` configured if using Google Places primary provider
- [ ] Feature flags reviewed for target environment
- [ ] Build passes (`npm run build`)
- [ ] Tests pass (`npm test`)

## Runtime checks

- [ ] `/api/weather` returns current + forecast or graceful empty fallback
- [ ] `/api/places/search` returns ranked places
- [ ] Google Places disabled/missing-key path falls back to Gemini correctly
- [ ] Rate limiting returns 429 under abuse
- [ ] Structured logs include `request_id`, `route`, `duration_ms`, `status`
- [ ] Error payloads include `request_id`

## Database checks

- [ ] `places_cache` table exists
- [ ] `weather_cache` table exists
- [ ] Cache indexes created
- [ ] Expired cache cleanup function exists

## Observability hooks

- [ ] Optional Sentry hook connected if desired
- [ ] Optional tracing hook connected if desired
- [ ] Log collection pipeline captures stdout JSON logs
