# Viaje360 Backend Production Design

Date: 2026-03-22
Status: Approved
Owner: Claw

## Goal
Evolve the current Viaje360 backend from a working AI-assisted MVP into a production-oriented backend with strong persistence, reliable itinerary generation, safe validation, and real integrations.

## Current State
Already implemented:
- Next.js API routes for chat, itinerary generation/adaptation, weather, places, quiz, active trip fetch
- Supabase layer with service/browser clients
- Initial SQL migration with core tables and RLS
- Onboarding connected to itinerary generation
- Trip hydration from backend into frontend store

Current gaps:
- No real auth flow connected end-to-end
- API contracts are not systematically validated
- LLM output is not guarded by strict schema + repair pipeline
- No itinerary versioning or adaptation audit trail
- No production observability/rate limiting layer
- Places integration is still Gemini-first instead of source-of-truth-first

## Recommended Delivery Strategy
Hybrid of foundation-first and vertical slices.

### Phase 1 — Production Foundation + Happy Path
Objective: make onboarding -> generate itinerary -> save -> recover reliable.

Scope:
- Supabase auth integration in app
- Replace demo user fallback with authenticated user path + controlled anonymous/dev fallback
- Tighten RLS and ownership assumptions
- Add Zod validation for request and response contracts in all API routes
- Standard API response envelope and typed errors
- Persist chat and itinerary reliably
- Load active trip and chat history from backend on app bootstrap
- Add migration/runbook docs for Supabase setup

Success criteria:
- A signed-in user can create an itinerary and retrieve it after refresh/login
- Routes reject malformed input cleanly
- Build passes and core flow works without local-state-only dependency

### Phase 2 — Reliability of AI Planning Engine
Objective: make generated itineraries trustworthy, repairable, and auditable.

Scope:
- Zod schema for generated itinerary JSON
- LLM pipeline: generate -> validate -> normalize/repair -> persist
- Retry/backoff for malformed or partial outputs
- Fallback itinerary when generation fails
- Itinerary versioning tables and audit events
- Adaptation engine by reason: weather, fatigue, manual user request
- Rule checks: no broken time overlaps, respect booked tickets, siesta, mobility, kids/pets, budget boundaries

Success criteria:
- Bad LLM JSON no longer breaks the flow
- Adaptations produce a new version with reason and timestamp
- Server can explain why itinerary changed

### Phase 3 — Real Integrations + Operations
Objective: use real data sources and make the backend operable in production.

Scope:
- Google Places / Maps integration for POIs, geocoding, hours, ratings
- Open-Meteo remains weather base, expanded adaptation triggers
- Candidate selection/scoring layer for POIs
- Cache tables for places/weather results where useful
- Rate limiting per IP/user
- Structured logging and error tracking hooks
- Feature flags / env-driven provider switches
- Production env separation: dev/staging/prod

Success criteria:
- Recommendations are backed by real places
- External provider failures degrade gracefully
- System is observable enough to debug live issues

## Target Architecture
- Frontend Next.js app router pages
- API routes as delivery layer only
- `lib/services/*` as business logic layer
- `lib/supabase/*` as data access/config layer
- Gemini for planning, but never trusted without validation
- External providers (weather/places) as truth sources
- Supabase Postgres as persistence and auth authority

## Core Rules
- LLM proposes; backend validates.
- External providers verify; DB persists.
- Never trust raw JSON from Gemini.
- Never depend only on client state for continuity.
- Preserve a usable demo/dev fallback without weakening production paths.

## Data Model Additions Planned
Phase 2/3 additions:
- `itinerary_versions`
- `adaptation_events`
- `places_cache`
- optional `request_logs` / lightweight observability table if needed

## Production Concerns
- RLS must always enforce user ownership
- service role used only in trusted server-side paths
- secrets only from env
- API requests validated with Zod
- consistent error shapes for frontend handling
- retry/backoff around LLM and provider instability

## Milestone Plan
1. Phase 1 foundation hardening
2. Phase 2 reliability pipeline
3. Phase 3 integrations and ops

## Recommendation
Execute Phase 1 first in implementation, but prepare Phase 2 schema/interfaces early so persistence does not need to be redesigned later.
