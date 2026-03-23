# Viaje360 — Self-Learning Recommendation & Travel Memory Design

Date: 2026-03-23
Status: approved-for-implementation

## Goal

Turn Viaje360 from a one-shot itinerary generator into a travel companion that:

1. stores every generated plan,
2. learns from user behavior and daily reflections,
3. remembers destination-specific history,
4. improves future plans using both personal memory and anonymized aggregate patterns.

## Product principles

- Personal history first.
- Aggregate intelligence second.
- No silent demo/fallback contamination in user-visible plans.
- Daily journaling should feel like a natural travel diary, not a cold survey.
- Learn from both explicit feedback and implicit behavior.
- If a feature regression breaks a previously working flow, roll back to the last stable state first, then reintroduce enhancements incrementally.

## Scope selected with user

### Learning model
- Hybrid memory system.
- Continuous self-learning.
- Store both plan-level and activity-level knowledge.
- Learn from generated plans plus implicit feedback.

### Feedback model
- End-of-day AI travel diary.
- Save both:
  - natural-language diary content,
  - structured extracted signals.

### Recommendation architecture
- Supabase stores signals, plans, journals, aggregates.
- Backend service performs ranking, similarity, and recommendation logic.

## Core user experiences

### 1. Plan generation memory
Whenever a plan is generated or adapted:
- save trip context,
- save itinerary snapshot,
- save every activity,
- save recommendation candidates and their final ranking source,
- make the plan reusable for future learning.

### 2. In-trip adaptive memory
While the trip is active, capture:
- activity detail opens,
- clicks on booking/menu links,
- activity regenerations,
- adaptations,
- manual replacements,
- accepted vs rejected recommendations.

### 3. End-of-day diary
At the end of each day, Viaje360 starts a short guided conversation:
- what did you actually do,
- what did you enjoy,
- what disappointed you,
- what would you repeat,
- what would you skip,
- what did you discover on your own,
- what do you want tomorrow to feel like.

The system stores:
- raw diary conversation,
- structured extraction,
- updated per-destination memory,
- updated user preference signals.

### 4. Return-to-destination memory
If the user comes back to the same destination, Viaje360 should be able to say:
- what they loved last time,
- what they skipped,
- what was too intense or too slow,
- what they discovered outside the plan,
- what should be repeated,
- what similar but new places should now be recommended.

## Data model

### Existing tables reused
- `profiles`
- `onboarding_profiles`
- `trips`
- `itinerary_days`
- `activities`
- `chat_messages`
- `itinerary_versions`
- `adaptation_events`

### New tables

#### 1. `activity_knowledge`
Canonical learned representation of real-world places/activities.

Columns:
- `id uuid`
- `canonical_name text`
- `normalized_name text`
- `destination text`
- `country text`
- `category text`
- `address text`
- `latitude numeric`
- `longitude numeric`
- `source_kind text` — restaurant, monument, museum, park, tour, shopping
- `official_url text`
- `booking_url text`
- `menu_url text`
- `price_per_person numeric`
- `ticket_price numeric`
- `image_query text`
- `tags text[]`
- `metadata jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

Purpose:
- deduplicate repeated places across generated plans,
- accumulate evidence over time,
- become the internal recommendation corpus.

#### 2. `trip_activity_events`
Event stream for implicit feedback.

Columns:
- `id uuid`
- `trip_id uuid`
- `activity_id uuid`
- `activity_knowledge_id uuid null`
- `user_id uuid null`
- `event_type text`
- `event_value text null`
- `metadata jsonb`
- `created_at timestamptz`

Event examples:
- `detail_opened`
- `booking_clicked`
- `menu_clicked`
- `activity_replaced`
- `activity_removed`
- `activity_saved`
- `activity_completed`
- `activity_skipped`
- `activity_liked`
- `activity_disliked`

#### 3. `trip_day_journals`
Raw daily diary per day.

Columns:
- `id uuid`
- `trip_id uuid`
- `user_id uuid null`
- `day_number integer`
- `date date`
- `conversation jsonb`
- `free_text_summary text`
- `mood text`
- `energy_score integer`
- `pace_score integer`
- `would_repeat boolean null`
- `created_at timestamptz`
- `updated_at timestamptz`

#### 4. `trip_day_activity_feedback`
Structured extracted feedback per activity from the diary.

Columns:
- `id uuid`
- `trip_day_journal_id uuid`
- `trip_id uuid`
- `activity_id uuid`
- `activity_knowledge_id uuid null`
- `rating integer null`
- `liked boolean null`
- `notes text null`
- `would_repeat boolean null`
- `would_recommend boolean null`
- `discovered_outside_plan boolean default false`
- `created_at timestamptz`

#### 5. `user_destination_memory`
Destination-specific memory for a user.

Columns:
- `id uuid`
- `user_id uuid`
- `destination text`
- `country text`
- `visit_count integer`
- `last_trip_id uuid null`
- `summary text`
- `liked_tags text[]`
- `disliked_tags text[]`
- `favorite_activity_ids uuid[]`
- `skipped_activity_ids uuid[]`
- `unfinished_activity_ids uuid[]`
- `discovered_places jsonb`
- `updated_at timestamptz`

Purpose:
- retain what happened in that destination specifically.

#### 6. `user_preference_signals`
Cross-trip preference memory.

Columns:
- `id uuid`
- `user_id uuid`
- `signal_type text`
- `signal_key text`
- `signal_value numeric`
- `context jsonb`
- `updated_at timestamptz`

Examples:
- `category:restaurant`
- `pace:moderate`
- `budget:mid`
- `style:cultural`
- `food:markets`
- `avoid:crowded_monuments_afternoon`

#### 7. `destination_aggregate_signals`
Anonymous aggregate memory for collective intelligence.

Columns:
- `id uuid`
- `destination text`
- `country text`
- `segment_key text`
- `category text`
- `entity_key text`
- `score numeric`
- `sample_size integer`
- `metadata jsonb`
- `updated_at timestamptz`

Examples:
- travelers with `style=cultural` and `budget=moderado` in Madrid strongly like Prado morning slots.

## Canonical event flow

### Plan generation
1. Generate itinerary.
2. Save trip/activities as today.
3. Upsert each activity into `activity_knowledge`.
4. Link generated trip activities to canonical knowledge entries when possible.
5. Save generation metadata/event.

### User interacts with plan
On every meaningful action, write `trip_activity_events`.

### End of day
1. Open AI diary conversation.
2. Save raw conversation in `trip_day_journals`.
3. Extract structured activity feedback.
4. Update `trip_day_activity_feedback`.
5. Update `user_destination_memory`.
6. Update `user_preference_signals`.
7. Update `destination_aggregate_signals` asynchronously.

### Future plan generation
Ranking pipeline should use:
1. current trip context,
2. user preference signals,
3. destination memory for this user,
4. canonical activity knowledge,
5. anonymized aggregate signals.

## Recommendation strategy

### Priority order
1. Hard constraints
   - dates
   - budget
   - mobility
   - dietary
   - transport
   - pace
2. Personal memory
   - explicit likes/dislikes
   - prior clicked/booked/completed places
   - destination-specific memory
3. Similar-user aggregate patterns
4. Freshness/diversity rules
   - do not repeat too aggressively
   - mix familiar + novel suggestions

### Scoring sketch
`final_score = constraint_fit + personal_preference_score + destination_memory_score + aggregate_similarity_score + novelty_bonus - repetition_penalty`

## MVP implementation phases

### Phase 1 — Storage foundation
- Add new tables.
- Save canonical activity knowledge for every generated trip.
- Save interaction events.
- Save raw daily journals.
- Extract structured daily feedback.

Success criteria:
- every generated plan leaves reusable data behind,
- every clicked/reviewed activity creates events,
- every day diary updates memory tables.

### Phase 2 — Personal recommendation engine
- Build backend scorer using:
  - `user_preference_signals`
  - `user_destination_memory`
  - `activity_knowledge`
- Use this scorer during itinerary generation and adaptation.

Success criteria:
- future plans reflect past likes/dislikes,
- return-to-destination flow surfaces relevant previous memory.

### Phase 3 — Collective intelligence
- Build aggregate jobs/materialized views.
- Segment by destination + traveler style + budget + interests.
- Blend aggregate signals into ranking.

Success criteria:
- cold-start users benefit from prior anonymized travel patterns,
- experienced users still prioritize personal history first.

## API additions

### Event capture
- `POST /api/trips/:tripId/activity-events`
- `POST /api/trips/:tripId/day-journal`

### Recommendation support
- internal backend service/module:
  - `getPersonalSignals(userId)`
  - `getDestinationMemory(userId, destination)`
  - `rankActivities(context)`
  - `extractJournalFeedback(conversation)`

## UI additions

### Near-term
- activity detail open should log event
- booking/menu click should log event
- simple end-of-day diary card/modal

### Later
- trip history page with destination memory
- “you liked this last time” recommendations
- “unfinished from last trip” suggestions

## Risks

### 1. Too much noisy data
Mitigation:
- do not treat every click as a strong preference,
- weight explicit feedback more than passive events.

### 2. Cold-start quality
Mitigation:
- use aggregate destination signals only when personal memory is sparse.

### 3. Canonical activity duplication
Mitigation:
- normalize by destination + normalized name + location similarity.

### 4. Privacy creep
Mitigation:
- aggregate signals should be anonymized and segment-based,
- avoid exposing other users’ raw itineraries.

## Recommended first implementation slice

Build this first:
1. `activity_knowledge`
2. `trip_activity_events`
3. `trip_day_journals`
4. `trip_day_activity_feedback`
5. event capture hooks in current UI
6. diary submission endpoint
7. extraction + update of user preference signals

This gives immediate learning value without waiting for the full collective-intelligence layer.

## Acceptance criteria

- Every generated/adapted plan is saved as reusable knowledge.
- Every activity interaction emits an event.
- Every trip day can end with a diary entry.
- Diary text is stored raw and structured.
- Returning to a destination can access destination-specific memory.
- Future plans can use prior user history before external sources.
- Aggregate destination intelligence can be added without redesigning the schema.
