# Viaje360 Backend Production Implementation Plan

Date: 2026-03-22
Source design: docs/plans/2026-03-22-backend-production-design.md
Status: Ready to execute

## Execution Mode
Use batches with checkpoints.
Default first batch = tasks 1-3.

## Phase 1 — Production Foundation

### Task 1 — Auth and identity path
- Add Supabase auth helpers for browser/server session access
- Introduce a single current-user resolver for API routes
- Keep explicit dev/anonymous fallback behind environment guard
- Replace hardcoded demo-user writes where safe
- Verify authenticated + fallback behavior

Verification:
- Build passes
- Unauthenticated flow still works in dev
- Authenticated flow resolves real user id

### Task 2 — API contracts with Zod
- Add Zod schemas for onboarding payload, itinerary generate response, chat payload, adapt payload, places payload, weather query parsing
- Validate all route inputs before service calls
- Normalize route error responses into a shared shape
- Ensure frontend handles validation errors cleanly

Verification:
- Invalid payloads return 400 with typed error body
- Build passes

### Task 3 — Persistence and hydration hardening
- Load active trip + chat history from backend, not only in-memory store
- Ensure generating itinerary persists and can be reloaded after refresh
- Confirm app bootstrap hydrates state deterministically
- Document migration/app bootstrap expectations

Verification:
- Refresh preserves trip experience
- Build passes

### Task 4 — Chat persistence cleanup
- Add route/service to fetch chat history for current trip
- Hydrate AI page from persisted chat on mount
- Ensure messages are not duplicated when switching between local and persisted state

Verification:
- Reload AI page and see chat continuity

### Task 5 — Supabase migration/runbook hardening
- Review existing migration for production readiness
- Add notes for SQL editor run order, env requirements, fallback behavior
- Add missing indexes if discovered during execution

Verification:
- Docs complete and accurate

## Phase 2 — Reliability of AI Planning

### Task 6 — Generated itinerary schemas
- Define Zod schema for generated itinerary/day/activity payloads
- Parse Gemini output through schema
- Add normalize/repair helpers for small issues

### Task 7 — Retry/fallback generation pipeline
- Add bounded retry for malformed output
- Add fallback minimal itinerary when retries fail
- Log why fallback happened

### Task 8 — Rule validation layer
- Enforce booked tickets, siesta, budget, mobility, kids/pets constraints
- Detect overlapping time windows and impossible schedules
- Repair or reject invalid activities

### Task 9 — Versioning and adaptation audit
- Add migration for itinerary_versions and adaptation_events
- Save original itinerary version and later adaptations with reasons
- Extend adapt route to persist versioned changes

## Phase 3 — Real Integrations + Ops

### Task 10 — Places provider abstraction
- Introduce provider interface for places search
- Keep Gemini fallback, prepare Google Places primary provider
- Normalize returned place shape for app use

### Task 11 — Place scoring engine
- Score by distance, hours, dietary fit, kid/pet fit, accessibility, budget, weather fit
- Rank candidates before recommendation

### Task 12 — Caching strategy
- Add lightweight caching for places/weather results where useful
- Add TTL policy documentation

### Task 13 — Rate limiting and ops hooks
- Add per-route rate limiting strategy
- Add structured logs and error context
- Prepare optional Sentry/OpenTelemetry hook points

### Task 14 — Environment and deployment readiness
- Document env matrix: dev/staging/prod
- Document required secrets and provider switches
- Add production checklist

## Batch Recommendation
- Batch 1: Tasks 1-3
- Batch 2: Tasks 4-5
- Batch 3: Tasks 6-8
- Batch 4: Task 9
- Batch 5: Tasks 10-12
- Batch 6: Tasks 13-14

## Stop Conditions
Stop and report if:
- Auth/session integration requires product-level decision
- RLS assumptions conflict with anonymous fallback
- Google Places credentials are required and missing
- Migration changes risk data loss or incompatible schema drift
