import type { GeneratedActivity } from "@/lib/supabase/database.types"

export interface DbActivityKnowledgeUpsert {
  canonical_name: string
  normalized_name: string
  destination: string
  country: string | null
  category: string
  address: string | null
  source_kind: string
  official_url: string | null
  booking_url: string | null
  menu_url: string | null
  price_per_person: number | null
  ticket_price: number | null
  image_query: string | null
  tags: string[]
  metadata: Record<string, unknown>
}

export interface DbTripActivityEventInsert {
  trip_id: string
  activity_id: string
  activity_knowledge_id: string | null
  user_id: string | null
  event_type: string
  event_value: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface DiaryMessage {
  role: "assistant" | "user"
  content: string
}

export interface DbTripDayJournalInsert {
  trip_id: string
  user_id: string | null
  day_number: number
  date: string
  conversation: DiaryMessage[]
  free_text_summary: string | null
  mood: string | null
  energy_score: number | null
  pace_score: number | null
  would_repeat: boolean | null
  created_at: string
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function normalizeName(value: string): string {
  return normalizeText(value).toLowerCase()
}

function buildActivityTags(activity: GeneratedActivity): string[] {
  const tags: string[] = []

  if (activity.indoor) tags.push("indoor")
  if (activity.weatherDependent) tags.push("weather_dependent")
  if (activity.kidFriendly) tags.push("kid_friendly")
  if (activity.petFriendly) tags.push("pet_friendly")
  if (activity.dietaryTags?.length) tags.push(...activity.dietaryTags)

  return unique(tags)
}

export function buildActivityKnowledgeUpsert(input: {
  activity: GeneratedActivity
  destination: string
  country?: string | null
}): DbActivityKnowledgeUpsert {
  const { activity } = input

  return {
    canonical_name: normalizeText(activity.name),
    normalized_name: normalizeName(activity.name),
    destination: normalizeText(input.destination),
    country: input.country ? normalizeText(input.country) : null,
    category: normalizeText(activity.type),
    address: activity.address ? normalizeText(activity.address) : null,
    source_kind: normalizeText(activity.type),
    official_url: activity.url ?? null,
    booking_url: null,
    menu_url: null,
    price_per_person: activity.pricePerPerson ?? null,
    ticket_price: typeof activity.cost === "number" ? activity.cost : null,
    image_query: activity.imageQuery ?? null,
    tags: buildActivityTags(activity),
    metadata: {
      location: activity.location,
      time: activity.time,
      end_time: activity.endTime ?? null,
      duration: activity.duration,
      cost: activity.cost,
      notes: activity.notes ?? null,
      description: activity.description ?? null,
      icon: activity.icon ?? null,
      image_query: activity.imageQuery ?? null,
    },
  }
}

export function buildTripActivityEventInsert(input: {
  tripId: string
  activityId: string
  activityKnowledgeId?: string | null
  userId?: string | null
  eventType: string
  eventValue?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}): DbTripActivityEventInsert {
  return {
    trip_id: input.tripId,
    activity_id: input.activityId,
    activity_knowledge_id: input.activityKnowledgeId ?? null,
    user_id: input.userId ?? null,
    event_type: input.eventType,
    event_value: input.eventValue ?? null,
    metadata: input.metadata ?? null,
    created_at: input.createdAt,
  }
}

export function buildTripDayJournalInsert(input: {
  tripId: string
  userId?: string | null
  dayNumber: number
  date: string
  conversation: DiaryMessage[]
  freeTextSummary?: string | null
  mood?: string | null
  energyScore?: number | null
  paceScore?: number | null
  wouldRepeat?: boolean | null
  createdAt: string
}): DbTripDayJournalInsert {
  return {
    trip_id: input.tripId,
    user_id: input.userId ?? null,
    day_number: input.dayNumber,
    date: input.date,
    conversation: structuredClone(input.conversation),
    free_text_summary: input.freeTextSummary ?? null,
    mood: input.mood ?? null,
    energy_score: input.energyScore ?? null,
    pace_score: input.paceScore ?? null,
    would_repeat: input.wouldRepeat ?? null,
    created_at: input.createdAt,
  }
}

export function summarizeDestinationMemoryUpdate(input: {
  existing?: {
    likedTags?: string[]
    dislikedTags?: string[]
    favoriteActivityIds?: string[]
    skippedActivityIds?: string[]
    unfinishedActivityIds?: string[]
    discoveredPlaces?: string[]
  }
  incoming: {
    likedTags?: string[]
    dislikedTags?: string[]
    favoriteActivityIds?: string[]
    skippedActivityIds?: string[]
    unfinishedActivityIds?: string[]
    discoveredPlaces?: string[]
  }
}): {
  liked_tags: string[]
  disliked_tags: string[]
  favorite_activity_ids: string[]
  skipped_activity_ids: string[]
  unfinished_activity_ids: string[]
  discovered_places: string[]
} {
  const existing = input.existing ?? {}
  const incoming = input.incoming

  return {
    liked_tags: unique([...(existing.likedTags ?? []), ...(incoming.likedTags ?? [])]),
    disliked_tags: unique([...(existing.dislikedTags ?? []), ...(incoming.dislikedTags ?? [])]),
    favorite_activity_ids: unique([
      ...(existing.favoriteActivityIds ?? []),
      ...(incoming.favoriteActivityIds ?? []),
    ]),
    skipped_activity_ids: unique([
      ...(existing.skippedActivityIds ?? []),
      ...(incoming.skippedActivityIds ?? []),
    ]),
    unfinished_activity_ids: unique([
      ...(existing.unfinishedActivityIds ?? []),
      ...(incoming.unfinishedActivityIds ?? []),
    ]),
    discovered_places: unique([
      ...(existing.discoveredPlaces ?? []),
      ...(incoming.discoveredPlaces ?? []),
    ]),
  }
}
