# Viaje360 — Itinerary Library Strategy

## Goal

Reduce dependence on live LLM generation by introducing a reusable itinerary library layer.

The library should be consulted **before** calling the AI generation pipeline. If a sufficiently similar itinerary already exists, Viaje360 should reuse it, remap dates, and return it immediately.

## Phase 1 — Reuse existing generated itineraries

Already implemented:

- `src/lib/services/itinerary-library.ts`
- `/api/itinerary/generate` now tries `findReusableItinerary(...)` before `generateItinerary(...)`
- `scripts/export-itinerary-library.mjs`
- exported raw library file: `knowledge/seed-itineraries/library.json`

Current matching dimensions:

- destination
- companion
- group size
- mobility
- traveler style
- budget
- first time
- interests
- transport
- kids/pets

Current output metadata:

- `generationSource.type = "library" | "ai"`
- when library is used, the response includes source trip/version ids plus match score/reasons

## Phase 2 — Curated seed catalog

Curated seed file:

- `knowledge/seed-itineraries/curated-seeds.json`

This file groups the best currently available reusable itineraries by destination and intended profile.

It is no longer only one entry per destination. The curated layer can contain multiple entries per city so Viaje360 can prefer better-matched seeds for profiles such as:

- pareja / familia / solo
- economico / moderado / premium
- historia / gastronomia / arte / mix
- movilidad reducida / accesible when relevant

Initial destinations covered:

- Roma
- Barcelona
- Paris
- Madrid
- Lisboa
- Nueva York / New York
- Tokyo
- Toledo
- Saint Petersburg
- Las Batuecas

## Phase 3 — 10–20 intentional base plans

Instead of relying only on accidental past generations, build a deliberate seed inventory.

Recommended first matrix:

### Core cities
- Roma
- Barcelona
- Paris
- Madrid
- Nueva York
- Lisboa

### Core profile dimensions
- companion: solo / pareja / familia
- budget: economico / moderado / premium
- theme: historia / gastronomia / arte / mix

Not every full cross-product is needed. Aim for **10–20 high-value seeds** with broad reuse potential.

Suggested first batch:

1. Roma — pareja — historia/gastronomia — moderado
2. Roma — familia — mix — moderado
3. Roma — solo — cultural — economico
4. Barcelona — pareja — gastronomia — moderado
5. Barcelona — familia — mix — moderado
6. Barcelona — solo — arte/design — premium
7. Paris — pareja — clasico — premium
8. Paris — familia — highlights — moderado
9. Paris — solo — museos — economico
10. Madrid — cultural — mix — moderado
11. Madrid — movilidad reducida — accesible — moderado
12. Madrid — gastronomia + paseo — economico
13. Nueva York — primera visita — highlights — moderado
14. Nueva York — familia — mix — premium
15. Lisboa — pareja — historia/gastronomia — moderado
16. Lisboa — solo — miradores/calles — economico
17. Tokyo — explorador — urbano — moderado
18. Toledo — familia — historia — moderado

## Recommended next implementation

### Short term
1. normalize destination aliases (`New York` / `Nueva York`, etc.)
2. score curated seeds above raw historic library entries
3. allow curated seeds to act as reusable fallback before AI when DB match is weak/missing
4. expose library-hit telemetry in analytics/dashboard
5. add one command/script to materialize curated seeds into a DB table if needed later

### Medium term
Add a dedicated table such as `itinerary_library` when the curated catalog grows enough that it should stop depending on `itinerary_versions` as the only source.

Suggested future fields:

- `id`
- `destination`
- `destination_normalized`
- `profile_tags text[]`
- `companion`
- `budget_level`
- `traveler_style`
- `interests text[]`
- `mobility`
- `transport text[]`
- `seed_quality_score`
- `snapshot jsonb`
- `source_trip_id`
- `source_version_id`
- `active boolean`
- `created_at`
- `updated_at`

## Principle

Library-first should not mean static-only.

Desired order:

1. exact/strong library match
2. curated seed match
3. AI generation
4. deterministic fallback itinerary

This gives Viaje360 a cheaper, faster, and more reliable generation stack.
