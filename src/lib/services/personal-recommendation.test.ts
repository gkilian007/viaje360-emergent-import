import test from "node:test"
import assert from "node:assert/strict"

import {
  buildPersonalRecommendationBrief,
  rankActivitiesForUser,
} from "./personal-recommendation"
import type {
  DbActivityKnowledge,
  DbUserDestinationMemory,
  DbUserPreferenceSignal,
  GeneratedActivity,
} from "@/lib/supabase/database.types"

const preferenceSignals: DbUserPreferenceSignal[] = [
  {
    id: "signal-category-museum",
    user_id: "user-1",
    signal_type: "category",
    signal_key: "museum",
    signal_value: 2.5,
    context: { source: "journal" },
    updated_at: "2026-03-24T10:00:00.000Z",
    created_at: "2026-03-24T10:00:00.000Z",
  },
  {
    id: "signal-tag-food",
    user_id: "user-1",
    signal_type: "tag",
    signal_key: "food-market",
    signal_value: 1.5,
    context: { source: "activity-event" },
    updated_at: "2026-03-24T10:05:00.000Z",
    created_at: "2026-03-24T10:05:00.000Z",
  },
  {
    id: "signal-category-nightlife",
    user_id: "user-1",
    signal_type: "category",
    signal_key: "nightlife",
    signal_value: -3,
    context: { source: "journal" },
    updated_at: "2026-03-24T10:10:00.000Z",
    created_at: "2026-03-24T10:10:00.000Z",
  },
]

const destinationMemory: DbUserDestinationMemory = {
  id: "memory-1",
  user_id: "user-1",
  destination: "Madrid",
  country: "Spain",
  visit_count: 2,
  last_trip_id: "trip-older",
  summary: "Le encantan los museos tranquilos y los mercados gastronómicos; evita planes masificados por la noche.",
  liked_tags: ["museum", "food-market"],
  disliked_tags: ["nightlife", "crowded"],
  favorite_activity_ids: ["knowledge-prado"],
  skipped_activity_ids: ["knowledge-club"],
  unfinished_activity_ids: [],
  discovered_places: ["Bodega de la Ardosa", "Casa Macareno"],
  updated_at: "2026-03-24T11:00:00.000Z",
  created_at: "2026-03-24T11:00:00.000Z",
}

const destinationKnowledge: DbActivityKnowledge[] = [
  {
    id: "knowledge-prado",
    canonical_name: "Museo del Prado",
    normalized_name: "museo del prado",
    destination: "Madrid",
    country: "Spain",
    category: "museum",
    address: "Retiro, Madrid",
    latitude: null,
    longitude: null,
    source_kind: "museum",
    official_url: "https://www.museodelprado.es/",
    booking_url: null,
    menu_url: null,
    price_per_person: null,
    ticket_price: 15,
    image_query: "Museo del Prado Madrid",
    tags: ["museum", "indoor"],
    metadata: null,
    created_at: "2026-03-24T11:00:00.000Z",
    updated_at: "2026-03-24T11:00:00.000Z",
  },
  {
    id: "knowledge-mercado",
    canonical_name: "Mercado de San Miguel",
    normalized_name: "mercado de san miguel",
    destination: "Madrid",
    country: "Spain",
    category: "food-market",
    address: "Centro, Madrid",
    latitude: null,
    longitude: null,
    source_kind: "market",
    official_url: "https://www.mercadodesanmiguel.es/",
    booking_url: null,
    menu_url: null,
    price_per_person: 25,
    ticket_price: null,
    image_query: "Mercado de San Miguel Madrid",
    tags: ["food-market", "indoor"],
    metadata: null,
    created_at: "2026-03-24T11:00:00.000Z",
    updated_at: "2026-03-24T11:00:00.000Z",
  },
]

const museumActivity: GeneratedActivity = {
  name: "Museo del Prado",
  type: "museum",
  location: "Madrid",
  time: "10:00",
  duration: 120,
  cost: 15,
  notes: "Reserva anticipada recomendada",
  description: "Recorre las salas maestras y entra a primera hora.",
  imageQuery: "Museo del Prado Madrid exterior",
  indoor: true,
  weatherDependent: false,
  kidFriendly: false,
  petFriendly: false,
  dietaryTags: [],
}

const nightlifeActivity: GeneratedActivity = {
  name: "Ruta de bares nocturnos en Malasaña",
  type: "nightlife",
  location: "Madrid",
  time: "23:00",
  duration: 180,
  cost: 35,
  notes: "Empieza tarde",
  description: "Tour por bares concurridos.",
  imageQuery: "Malasaña nightlife Madrid",
  indoor: true,
  weatherDependent: false,
  kidFriendly: false,
  petFriendly: false,
  dietaryTags: [],
}

test("rankActivitiesForUser prioritizes historically liked categories and penalizes disliked ones", () => {
  const ranked = rankActivitiesForUser([nightlifeActivity, museumActivity], {
    preferenceSignals,
    destinationMemory,
    destinationKnowledge,
  })

  assert.equal(ranked[0]?.activity.name, "Museo del Prado")
  assert.equal(ranked[1]?.activity.name, "Ruta de bares nocturnos en Malasaña")
  assert.ok(ranked[0]?.score > ranked[1]?.score)
})

test("buildPersonalRecommendationBrief summarizes strong signals, destination memory and known favorites", () => {
  const brief = buildPersonalRecommendationBrief({
    destination: "Madrid",
    preferenceSignals,
    destinationMemory,
    destinationKnowledge,
  })

  assert.match(brief, /museum/i)
  assert.match(brief, /food-market/i)
  assert.match(brief, /nightlife/i)
  assert.match(brief, /Le encantan los museos tranquilos/i)
  assert.match(brief, /Museo del Prado/i)
  assert.match(brief, /Bodega de la Ardosa/i)
})
