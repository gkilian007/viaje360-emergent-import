import test from "node:test"
import assert from "node:assert/strict"

import {
  buildActivityKnowledgeUpsert,
  buildTripActivityEventInsert,
  buildTripDayJournalInsert,
  summarizeDestinationMemoryUpdate,
} from "./trip-learning"
import type { GeneratedActivity } from "@/lib/supabase/database.types"

const generatedActivity: GeneratedActivity = {
  name: "Museo del Prado",
  type: "museum",
  location: "Madrid",
  address: "Retiro, Madrid",
  time: "10:00",
  endTime: "12:00",
  duration: 120,
  cost: 15,
  notes: "Reserva anticipada recomendada",
  url: "https://www.museodelprado.es/",
  imageQuery: "Museo del Prado Madrid exterior",
  indoor: true,
  weatherDependent: false,
  kidFriendly: true,
  petFriendly: false,
  dietaryTags: [],
}

test("buildActivityKnowledgeUpsert normalizes generated activities into canonical knowledge rows", () => {
  const payload = buildActivityKnowledgeUpsert({
    activity: generatedActivity,
    destination: "Madrid",
    country: "Spain",
  })

  assert.equal(payload.canonical_name, "Museo del Prado")
  assert.equal(payload.normalized_name, "museo del prado")
  assert.equal(payload.destination, "Madrid")
  assert.equal(payload.country, "Spain")
  assert.equal(payload.category, "museum")
  assert.equal(payload.address, "Retiro, Madrid")
  assert.equal(payload.source_kind, "museum")
  assert.equal(payload.official_url, "https://www.museodelprado.es/")
  assert.deepEqual(payload.tags, ["indoor", "kid_friendly"])
  assert.equal(payload.metadata.notes, "Reserva anticipada recomendada")
  assert.equal(payload.metadata.image_query, "Museo del Prado Madrid exterior")
})

test("buildTripActivityEventInsert creates a structured implicit-feedback event payload", () => {
  const createdAt = "2026-03-23T12:40:00.000Z"
  const payload = buildTripActivityEventInsert({
    tripId: "trip-1",
    activityId: "activity-1",
    activityKnowledgeId: "knowledge-1",
    userId: "user-1",
    eventType: "detail_opened",
    eventValue: "plan-card",
    metadata: { source: "plan-modal" },
    createdAt,
  })

  assert.deepEqual(payload, {
    trip_id: "trip-1",
    activity_id: "activity-1",
    activity_knowledge_id: "knowledge-1",
    user_id: "user-1",
    event_type: "detail_opened",
    event_value: "plan-card",
    metadata: { source: "plan-modal" },
    created_at: createdAt,
  })
})

test("buildTripDayJournalInsert stores both free text and structured diary scores", () => {
  const createdAt = "2026-03-23T20:00:00.000Z"
  const payload = buildTripDayJournalInsert({
    tripId: "trip-1",
    userId: "user-1",
    dayNumber: 2,
    date: "2026-05-02",
    conversation: [
      { role: "assistant", content: "¿Qué tal fue hoy?" },
      { role: "user", content: "Muy bien, me encantó el museo pero caminamos demasiado." },
    ],
    freeTextSummary: "Muy bien, museo excelente pero demasiado paseo.",
    mood: "happy",
    energyScore: 6,
    paceScore: 4,
    wouldRepeat: true,
    createdAt,
  })

  assert.equal(payload.trip_id, "trip-1")
  assert.equal(payload.user_id, "user-1")
  assert.equal(payload.day_number, 2)
  assert.equal(payload.date, "2026-05-02")
  assert.equal(payload.mood, "happy")
  assert.equal(payload.energy_score, 6)
  assert.equal(payload.pace_score, 4)
  assert.equal(payload.would_repeat, true)
  assert.equal(payload.created_at, createdAt)
  assert.deepEqual(payload.conversation, [
    { role: "assistant", content: "¿Qué tal fue hoy?" },
    { role: "user", content: "Muy bien, me encantó el museo pero caminamos demasiado." },
  ])
})

test("summarizeDestinationMemoryUpdate merges liked, disliked, favorites, skipped, unfinished and discoveries without duplicates", () => {
  const summary = summarizeDestinationMemoryUpdate({
    existing: {
      likedTags: ["museum", "food-market"],
      dislikedTags: ["nightlife"],
      favoriteActivityIds: ["a1"],
      skippedActivityIds: ["a2"],
      unfinishedActivityIds: ["a3"],
      discoveredPlaces: ["Bodega de la Ardosa"],
    },
    incoming: {
      likedTags: ["museum", "park"],
      dislikedTags: ["crowded"],
      favoriteActivityIds: ["a4", "a1"],
      skippedActivityIds: ["a5"],
      unfinishedActivityIds: ["a3", "a6"],
      discoveredPlaces: ["Bodega de la Ardosa", "Taberna La Concha"],
    },
  })

  assert.deepEqual(summary.liked_tags, ["museum", "food-market", "park"])
  assert.deepEqual(summary.disliked_tags, ["nightlife", "crowded"])
  assert.deepEqual(summary.favorite_activity_ids, ["a1", "a4"])
  assert.deepEqual(summary.skipped_activity_ids, ["a2", "a5"])
  assert.deepEqual(summary.unfinished_activity_ids, ["a3", "a6"])
  assert.deepEqual(summary.discovered_places, ["Bodega de la Ardosa", "Taberna La Concha"])
})
