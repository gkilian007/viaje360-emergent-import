# Viaje360 - Product Requirements Document

## Original Problem Statement
Continuar el proyecto Viaje360 - una aplicación de viajes con AI que genera itinerarios personalizados, aprende de las preferencias del usuario, y se adapta en tiempo real.

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict)
- **UI**: React 19, Tailwind CSS, Radix UI, Framer Motion
- **AI**: Google Gemini (gemini-2.5-flash)
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **State**: Zustand (persisted to localStorage)
- **Data Fetching**: TanStack React Query
- **Maps**: Mapbox GL JS v3 with Directions API

## Core Architecture
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── chat/          # Conversational AI
│   │   ├── diary/         # Travel diary endpoints
│   │   ├── itinerary/     # Itinerary generation
│   │   ├── places/        # Places search
│   │   ├── trips/active/  # Active trip data (mock)
│   │   └── weather/       # Weather data
│   ├── explore/           # Discover destinations
│   ├── mapa/              # Interactive map page
│   ├── onboarding/        # 18-step wizard
│   ├── plan/              # Itinerary view
│   │   └── diary/         # Travel diary page
│   └── status/            # Trip status
├── components/
│   ├── features/          # Domain components
│   │   ├── diary/         # Diary components
│   │   └── map/           # Map components
│   ├── layout/            # Navigation
│   ├── onboarding/        # Wizard steps
│   └── ui/                # Base components
├── lib/
│   ├── services/          # Business logic
│   └── supabase/          # Database
└── store/                 # Zustand stores
```

## What's Been Implemented

### Session 1 - March 23, 2026

#### Travel Diary (End-of-Day Journal) - COMPLETE
- Conversational UI for daily trip logging
- Mood selector, energy/pace sliders
- Activity feedback (like/dislike, would repeat)
- API route for saving diary entries
- Success toast and navigation flow

#### Interactive Map - COMPLETE (with fixes)
- Mapbox GL JS integration with dark style
- Activity markers with color-coded types
- Animated avatar with route following
- Transport mode selector (walk/bike/car)
- Real Mapbox Directions API for routes
- Turn-by-turn navigation instructions
- Dynamic city support (Barcelona, Madrid, Paris, etc.)

### Bug Fixes Applied - March 23, 2026
1. **Fixed "Maximum update depth exceeded" React error**
   - Optimized useRouteAnimation hook with requestAnimationFrame batching
   - Added hasInitializedRef to prevent double initialization
   - Error no longer appears in console

2. **Fixed map not updating for different cities**
   - Added getCityCenter function with coordinates for major cities
   - Updated getActivityCoordinates to accept destination parameter
   - Fallback coordinates now use city center instead of hardcoded Barcelona

3. **Fixed TypeScript errors**
   - Updated plan/page.tsx with proper Trip type import
   - Added Suspense boundaries for useSearchParams

4. **Fixed Next.js build errors**
   - Wrapped components using useSearchParams in Suspense boundaries

## Prioritized Backlog

### P0 - Critical (Next)
1. **Weather Adaptation** - Automatic indoor alternatives when rain forecasted
2. **PWA + Offline** - Service worker for offline trip access

### P1 - Important
3. **Export Features** - Share as link, PDF, or Google Calendar
4. **Explore Page Enhancement** - Real destination cards with photos and search
5. **Supabase Full Integration** - Persist diary entries and map data

### P2 - Nice to Have
6. **Dark Mode** - Toggle theme (CSS variables ready)
7. **Push Notifications** - Upcoming activity reminders
8. **Live GPS Navigation** - Use device GPS for real-time tracking

## API Endpoints
- `POST /api/diary` - Save diary entry
- `GET /api/trips/active` - Get active trip (mock data)
- `POST /api/chat` - AI conversation
- `POST /api/itinerary/generate` - Generate itinerary

## Known Limitations
- Trip data is MOCKED (localStorage + mock API)
- Supabase integration not active in current flow
- Map coordinates for activities outside Barcelona/Madrid/Paris are generated deterministically from activity ID

## Notes
- Frontend runs on port 3001 (Next.js)
- Mobile-first design with responsive desktop layout
- Uses Material Symbols for icons
- Glassmorphism and gradient aesthetics throughout
