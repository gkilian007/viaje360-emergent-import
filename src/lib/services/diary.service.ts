import { createServiceClient } from "@/lib/supabase/server"
import { getDestinationKnowledge, getUserDestinationMemory } from "@/lib/services/personal-recommendation"
import {
  buildTripDayActivityFeedbackInsert,
  buildTripDayJournalInsert,
  deriveDestinationMemoryInputFromFeedback,
  derivePreferenceSignalUpdatesFromFeedback,
  summarizeDestinationMemoryUpdate,
  type DiaryMessage,
} from "@/lib/services/trip-learning"
import type { DbTripDayJournal, DbUserPreferenceSignal } from "@/lib/supabase/database.types"

export interface SaveDiaryEntryInput {
  tripId: string
  userId?: string | null
  dayNumber: number
  date: string
  mood: string | null
  energyScore: number
  paceScore: number
  freeTextSummary: string
  wouldRepeat: boolean | null
  conversation: DiaryMessage[]
  activityFeedback: {
    activityId: string
    liked: boolean | null
    wouldRepeat: boolean | null
    notes: string
  }[]
}

interface PersistedActivity {
  id: string
  name: string
  type: string
  dietary_tags: string[] | null
  indoor: boolean
  weather_dependent: boolean
  kid_friendly: boolean
  pet_friendly: boolean
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function buildActivityTags(activity: PersistedActivity): string[] {
  const tags: string[] = [activity.type]

  if (activity.indoor) tags.push("indoor")
  if (activity.weather_dependent) tags.push("weather_dependent")
  if (activity.kid_friendly) tags.push("kid_friendly")
  if (activity.pet_friendly) tags.push("pet_friendly")
  if (activity.dietary_tags?.length) tags.push(...activity.dietary_tags)

  return Array.from(new Set(tags.map(normalizeName)))
}

async function upsertPreferenceSignals(input: {
  userId: string
  tripId: string
  destination: string
  dayNumber: number
  deltas: Array<{ signalType: string; signalKey: string; delta: number }>
}) {
  if (input.deltas.length === 0) return

  const supabase = createServiceClient()
  const { data: existingRows, error: existingError } = await supabase
    .from("user_preference_signals")
    .select("*")
    .eq("user_id", input.userId)

  if (existingError) throw existingError

  const existingMap = new Map(
    ((existingRows as DbUserPreferenceSignal[] | null) ?? []).map((row) => [`${row.signal_type}:${row.signal_key}`, row])
  )

  const now = new Date().toISOString()
  const rows = input.deltas.map((delta) => {
    const key = `${delta.signalType}:${delta.signalKey}`
    const existing = existingMap.get(key)
    const nextValue = Number(((existing?.signal_value ?? 0) + delta.delta).toFixed(2))

    return {
      user_id: input.userId,
      signal_type: delta.signalType,
      signal_key: delta.signalKey,
      signal_value: nextValue,
      context: {
        source: "trip_day_journal",
        tripId: input.tripId,
        destination: input.destination,
        dayNumber: input.dayNumber,
      },
      updated_at: now,
      created_at: existing?.created_at ?? now,
    }
  })

  const { error } = await supabase
    .from("user_preference_signals")
    .upsert(rows, { onConflict: "user_id,signal_type,signal_key" })

  if (error) throw error
}

async function upsertDestinationMemory(input: {
  userId: string
  tripId: string
  destination: string
  country: string | null
  summary: string | null
  feedbackLearningEntries: Array<{
    activityId: string | null
    activityKnowledgeId: string | null
    category: string
    tags: string[]
    liked: boolean | null
    wouldRepeat: boolean | null
  }>
}) {
  const incoming = deriveDestinationMemoryInputFromFeedback(input.feedbackLearningEntries)
  const existing = await getUserDestinationMemory({
    userId: input.userId,
    destination: input.destination,
    country: input.country,
  })

  const merged = summarizeDestinationMemoryUpdate({
    existing: existing
      ? {
          likedTags: existing.liked_tags,
          dislikedTags: existing.disliked_tags,
          favoriteActivityIds: existing.favorite_activity_ids,
          skippedActivityIds: existing.skipped_activity_ids,
          unfinishedActivityIds: existing.unfinished_activity_ids,
          discoveredPlaces: (existing.discovered_places as string[]) ?? [],
        }
      : undefined,
    incoming,
  })

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("user_destination_memory")
    .upsert(
      {
        user_id: input.userId,
        destination: input.destination,
        country: input.country,
        visit_count: existing ? existing.visit_count : 1,
        last_trip_id: input.tripId,
        summary: input.summary || existing?.summary || null,
        liked_tags: merged.liked_tags,
        disliked_tags: merged.disliked_tags,
        favorite_activity_ids: merged.favorite_activity_ids,
        skipped_activity_ids: merged.skipped_activity_ids,
        unfinished_activity_ids: merged.unfinished_activity_ids,
        discovered_places: merged.discovered_places,
        updated_at: now,
        created_at: existing?.created_at ?? now,
      },
      { onConflict: "user_id,destination,country" }
    )

  if (error) throw error
}

export async function saveDiaryEntry(input: SaveDiaryEntryInput) {
  const supabase = createServiceClient()
  const effectiveUserId = input.userId ?? null

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, destination, country")
    .eq("id", input.tripId)
    .single()

  if (tripError || !trip) {
    throw tripError ?? new Error("Trip not found")
  }

  const { data: existingJournal, error: journalLookupError } = await supabase
    .from("trip_day_journals")
    .select("*")
    .eq("trip_id", input.tripId)
    .eq("day_number", input.dayNumber)
    .maybeSingle()

  if (journalLookupError) throw journalLookupError

  const now = new Date().toISOString()
  const journalPayload = buildTripDayJournalInsert({
    tripId: input.tripId,
    userId: effectiveUserId,
    dayNumber: input.dayNumber,
    date: input.date,
    conversation: input.conversation,
    freeTextSummary: input.freeTextSummary,
    mood: input.mood,
    energyScore: input.energyScore,
    paceScore: input.paceScore,
    wouldRepeat: input.wouldRepeat,
    createdAt: existingJournal?.created_at ?? now,
  })

  const journalQuery = existingJournal
    ? supabase
        .from("trip_day_journals")
        .update({ ...journalPayload, updated_at: now })
        .eq("id", existingJournal.id)
    : supabase
        .from("trip_day_journals")
        .insert({ ...journalPayload, updated_at: now })

  const { data: journalRow, error: journalError } = await journalQuery.select().single()
  if (journalError || !journalRow) throw journalError ?? new Error("Could not save journal")

  const activityIds = input.activityFeedback.map((item) => item.activityId)
  const { data: activityRows, error: activityError } = await supabase
    .from("activities")
    .select("id, name, type, dietary_tags, indoor, weather_dependent, kid_friendly, pet_friendly")
    .eq("trip_id", input.tripId)
    .in("id", activityIds)

  if (activityError) throw activityError

  const activityMap = new Map(((activityRows as PersistedActivity[] | null) ?? []).map((row) => [row.id, row]))
  const destinationKnowledge = await getDestinationKnowledge(String(trip.destination ?? ""))
  const knowledgeMap = new Map(destinationKnowledge.map((row) => [normalizeName(row.canonical_name), row]))

  const feedbackLearningEntries = input.activityFeedback
    .map((item) => {
      const activity = activityMap.get(item.activityId)
      if (!activity) return null
      const knowledge = knowledgeMap.get(normalizeName(activity.name))

      return {
        activityId: activity.id,
        activityKnowledgeId: knowledge?.id ?? null,
        category: activity.type,
        tags: buildActivityTags(activity),
        liked: item.liked,
        wouldRepeat: item.wouldRepeat,
        notes: item.notes,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  const { error: deleteFeedbackError } = await supabase
    .from("trip_day_activity_feedback")
    .delete()
    .eq("trip_day_journal_id", journalRow.id)

  if (deleteFeedbackError) throw deleteFeedbackError

  if (feedbackLearningEntries.length > 0) {
    const feedbackRows = feedbackLearningEntries.map((item) =>
      buildTripDayActivityFeedbackInsert({
        journalId: journalRow.id,
        tripId: input.tripId,
        activityId: item.activityId,
        activityKnowledgeId: item.activityKnowledgeId,
        liked: item.liked,
        notes: item.notes,
        wouldRepeat: item.wouldRepeat,
        discoveredOutsidePlan: false,
      })
    )

    const { error: insertFeedbackError } = await supabase
      .from("trip_day_activity_feedback")
      .insert(feedbackRows)

    if (insertFeedbackError) throw insertFeedbackError
  }

  if (effectiveUserId) {
    const preferenceDeltas = derivePreferenceSignalUpdatesFromFeedback(feedbackLearningEntries)
    await upsertPreferenceSignals({
      userId: effectiveUserId,
      tripId: input.tripId,
      destination: String(trip.destination ?? ""),
      dayNumber: input.dayNumber,
      deltas: preferenceDeltas,
    })

    await upsertDestinationMemory({
      userId: effectiveUserId,
      tripId: input.tripId,
      destination: String(trip.destination ?? ""),
      country: (trip.country as string | null) ?? null,
      summary: input.freeTextSummary || null,
      feedbackLearningEntries,
    })
  }

  return {
    journal: journalRow as DbTripDayJournal,
    activityFeedbackCount: feedbackLearningEntries.length,
  }
}

export async function getDiaryEntry(tripId: string, dayNumber: number) {
  const supabase = createServiceClient()
  const { data: journal, error: journalError } = await supabase
    .from("trip_day_journals")
    .select("*")
    .eq("trip_id", tripId)
    .eq("day_number", dayNumber)
    .maybeSingle()

  if (journalError) throw journalError

  if (!journal) {
    return {
      journal: null,
      activityFeedback: [],
    }
  }

  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("trip_day_activity_feedback")
    .select("activity_id, liked, would_repeat, notes")
    .eq("trip_day_journal_id", journal.id)

  if (feedbackError) throw feedbackError

  return {
    journal,
    activityFeedback: (feedbackRows ?? []).map((row) => ({
      activityId: String(row.activity_id ?? ""),
      liked: row.liked,
      wouldRepeat: row.would_repeat,
      notes: row.notes ?? "",
    })),
  }
}
