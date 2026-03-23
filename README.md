# Viaje360 🌍✈️

**AI-powered travel companion that generates personalized itineraries, learns from your preferences, and adapts in real time.**

Built with Next.js 16, Gemini AI, Supabase, and a self-learning recommendation engine.

---

## What It Does

Viaje360 turns trip planning from a chore into a conversation. You tell it where you're going, what you like, and how you travel — it generates a detailed, day-by-day itinerary with real places, schedules, and actionable details. Then it keeps learning.

### Core Features

- **18-step onboarding wizard** — Captures travel style, interests, budget, mobility, dietary needs, companions, accommodation preference, pace, and more through an interactive flow
- **AI itinerary generation** — Gemini generates structured day-by-day plans with real activities, times, locations, links, and photos
- **Itinerary adaptation** — Regenerate specific days or replace individual activities without losing the rest of the plan
- **Places search** — Dual-provider system (Google Places API + Gemini fallback) with intelligent scoring and caching
- **Weather integration** — Open-Meteo weather data embedded in itinerary context
- **Self-learning memory** — The system remembers what you liked, what you skipped, and improves future recommendations
- **End-of-day travel diary** — Guided journaling that extracts structured preference signals
- **Itinerary versioning** — Full audit trail of every adaptation with rollback capability
- **Mobile-first UI** — Responsive design with bottom nav, day selector timeline, and activity detail modals

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| UI | React 19, Tailwind CSS, Radix UI, Framer Motion |
| AI | Google Gemini (gemini-2.5-flash) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| State | Zustand |
| Data fetching | TanStack React Query |
| Forms | React Hook Form + Zod validation |
| Charts | Recharts |
| Package manager | pnpm |

---

## Architecture

```
src/
├── app/                    # Next.js App Router pages
│   ├── (tabs)/             # Tab-based navigation layout
│   ├── api/                # API routes (serverless functions)
│   │   ├── chat/           # Conversational AI endpoint
│   │   ├── itinerary/      # Generate + adapt itineraries
│   │   │   ├── generate/
│   │   │   └── adapt/
│   │   ├── places/search/  # Places search with provider fallback
│   │   ├── quiz/           # Preference quiz evaluation
│   │   ├── trips/active/   # Active trip state
│   │   └── weather/        # Weather data
│   ├── ai/                 # AI assistant page
│   ├── explore/            # Discover destinations
│   ├── onboarding/         # 18-step wizard
│   ├── plan/               # Active itinerary view
│   └── status/             # Trip status dashboard
├── components/
│   ├── features/           # Domain components (cards, modals, maps)
│   ├── layout/             # Navigation (BottomNav, SideNav, TopBar)
│   ├── onboarding/         # Wizard steps + shared UI
│   └── ui/                 # Base components (button, card, badge...)
├── lib/
│   ├── api/                # Request/response contracts + helpers
│   ├── auth/               # Identity resolution + server auth
│   ├── bootstrap/          # App hydration from Supabase on load
│   ├── middleware/          # Rate limiting
│   ├── ops/                # Logging + observability hooks
│   ├── services/           # Business logic
│   │   ├── places/         # Multi-provider places (Google + Gemini)
│   │   ├── itinerary.service.ts
│   │   ├── itinerary-reliability.ts   # Validation + fallback pipeline
│   │   ├── itinerary-versioning.ts    # Version history + audit
│   │   ├── trip-learning.ts           # Self-learning memory
│   │   ├── trip.service.ts
│   │   ├── profile.service.ts
│   │   ├── weather.service.ts
│   │   └── cache.ts
│   ├── supabase/           # Client + server + DB types
│   ├── env.ts              # Validated env config
│   ├── feature-flags.ts    # Runtime feature toggles
│   ├── gemini.ts           # Gemini client
│   └── types.ts            # Shared domain types
├── store/
│   ├── useAppStore.ts      # Global app state (Zustand)
│   └── useOnboardingStore.ts  # Wizard state
└── supabase/
    └── migrations/         # SQL migrations (4 total)
```

---

## Database Schema (Supabase)

4 migration files define the schema:

| Migration | What it does |
|-----------|-------------|
| `001_initial_schema.sql` | Users, trips, itineraries, activities, user preferences |
| `002_itinerary_versioning.sql` | Version history table + adaptation audit trail |
| `003_cache_tables.sql` | Places + weather cache with TTL |
| `004_self_learning_memory.sql` | Travel diary, activity signals, destination memory, preference evolution |

---

## Development Progress

### What's Done ✅

**Phase 1 — MVP Scaffold** (Mar 21)
- Next.js project with App Router
- 5 core pages: home, plan, explore, AI assistant, status
- Landing page + guest-first flow
- Tailwind + Radix UI component library

**Phase 2 — AI Integration** (Mar 21)
- Gemini integration for itinerary generation
- Structured JSON output with `responseMimeType`
- Chat endpoint for conversational planning

**Phase 3 — Onboarding Wizard** (Mar 21-22)
- 18-step interactive wizard covering:
  - Destination, dates, companions, kids/pets
  - Travel style, interests, pace, day structure
  - Budget, accommodation, transport
  - Dietary restrictions, mobility needs
  - Weather preference, must-see places, famous vs local balance
  - Splurge item selection
- Conditional step logic (skip irrelevant questions)
- Animated transitions between steps

**Phase 4 — Backend Hardening** (Mar 22)
- Supabase auth integration (anonymous + authenticated)
- Server-side identity resolution
- Trip persistence (active trip hydration on app load)
- API contract validation with Zod
- Environment variable validation + feature flags
- Rate limiting middleware
- Structured logging + observability hooks

**Phase 5 — Itinerary Engine** (Mar 22)
- Multi-step validation pipeline with fallbacks
- Itinerary versioning with full audit trail
- Day-by-day generation with real activities
- Activity detail: name, description, time, duration, location, links, photos
- Clickable activities with detail modal

**Phase 6 — Places Intelligence** (Mar 22)
- Dual-provider architecture (Google Places API + Gemini)
- Intelligent scoring algorithm for place relevance
- Response caching with configurable TTL
- Graceful fallback when Google API unavailable

**Phase 7 — Self-Learning Foundation** (Mar 23)
- Travel memory database schema
- Activity signal capture (opens, clicks, regenerations)
- End-of-day diary conversation design
- Destination memory for return trips
- Preference evolution tracking
- Trip learning service with tests

### What's Next 🚧

**Immediate priorities:**
- [ ] End-of-day diary UI + guided conversation flow
- [ ] Real-time itinerary adaptation based on weather changes
- [ ] Push notifications for upcoming activities
- [ ] Offline mode (PWA + service worker)
- [ ] Map integration (Mapbox/Google Maps) with itinerary overlay

**Backend roadmap:**
- [ ] Aggregate recommendation engine (cross-user patterns)
- [ ] Destination knowledge graph
- [ ] Multi-language itinerary generation
- [ ] Booking integration (restaurants, tickets, transport)
- [ ] Export itinerary to calendar / PDF / share link

**Infrastructure:**
- [ ] Production deployment (Vercel + Supabase production)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] E2E testing (Playwright)
- [ ] Performance monitoring (Sentry / Vercel Analytics)
- [ ] CDN + image optimization for place photos

**UI/UX:**
- [ ] AR place discovery overlay
- [ ] Social features (share trips, collaborative planning)
- [ ] Trip gallery / travel history view
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Dark mode

---

## Tests

10 test files covering core backend logic:

```bash
# Run all tests
npm test

# Tests cover:
# - API contracts validation
# - Auth identity resolution
# - App hydration logic
# - Environment config parsing
# - Feature flag evaluation
# - Itinerary reliability pipeline
# - Itinerary versioning
# - Gemini places provider
# - Places scoring algorithm
# - Trip learning signals
```

---

## Local Setup

### Prerequisites

- Node.js 22+
- pnpm
- A [Supabase](https://supabase.com) project
- A [Gemini API key](https://aistudio.google.com/apikey)

### Install

```bash
git clone https://github.com/gkilian007/viaje360.git
cd viaje360
pnpm install
```

### Configure

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server only) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `GOOGLE_PLACES_API_KEY` | ❌ | Google Places API (falls back to Gemini) |

### Database

Run the migrations in order against your Supabase project:

```bash
# Via Supabase CLI
supabase db push

# Or manually via SQL editor in Supabase dashboard
# Apply files in supabase/migrations/ in order
```

### Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Feature Flags

Toggle features at runtime via environment variables:

| Flag | Default | Description |
|------|---------|-------------|
| `FEATURE_GOOGLE_PLACES` | `false` | Use Google Places API as primary provider |
| `FEATURE_OPEN_METEO` | `true` | Weather data from Open-Meteo |
| `FEATURE_PLACES_CACHE` | `false` | Cache places responses in Supabase |
| `FEATURE_WEATHER_CACHE` | `false` | Cache weather responses |
| `FEATURE_RATE_LIMITING` | `true` | API rate limiting |

---

## Project Stats

- **~10,700 lines** of TypeScript/React
- **20 commits** of focused development
- **10 test suites** covering backend services
- **4 database migrations**
- **6 API routes**
- **18 onboarding steps**
- **7 documentation files**

---

## Docs

- `docs/plans/` — Architecture decisions and design documents
- `docs/deployment/` — Env matrix, secrets management, production checklist
- `docs/runbooks/` — Operational runbooks (Supabase migrations, etc.)

---

## License

MIT

---

Built with 🦞 [OpenClaw](https://github.com/openclaw/openclaw) + Gemini + Supabase
