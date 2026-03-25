/**
 * Supabase persistence layer for trip-learning.
 * Pure helpers live in trip-learning.ts (tested without DB).
 * This file wires them to real Supabase calls.
 */

import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  buildActivityKnowledgeUpsert,
  buildTripActivityEventInsert,
  buildTripDayJournalInsert,
  summarizeDestinationMemoryUpdate,
  type DiaryMessage,
} from "./trip-learning"
import type { GeneratedItinerary } from "@/lib/supabase/database.types"

// ─── Activity Knowledge ────────────────────────────────────────────────────────

/**
 * Upsert all activities from a generated itinerary into activity_knowledge.
 * Uses (destination, normalized_name) as the dedup key.
 */
export async function ingestItineraryKnowledge(
  itinerary: GeneratedItinerary,
  destination: string,
  country?: string | null
): Promise<{ ingested: number; errors: number }> {
  if (!isSupabaseConfigured()) return { ingested: 0, errors: 0 }

  const supabase = createServiceClient()
  let ingested = 0
  let errors = 0

  for (const day of itinerary.days) {
    for (const activity of day.activities) {
      try {
        const payload = buildActivityKnowledgeUpsert({ activity, destination, country })

        const { error } = await supabase
          .from("activity_knowledge")
          .upsert(payload, {
            onConflict: "destination,normalized_name",
            ignoreDuplicates: false,
          })

        if (error) {
          // If unique constraint doesn't exist yet, fall back to insert-or-skip
          if (error.code === "42P10" || error.code === "23505") {
            // Try plain insert, ignore duplicate
            await supabase.from("activity_knowledge").insert(payload)
          } else {
            console.warn("[trip-learning] activity_knowledge upsert error:", error.message)
            errors++
            continue
          }
        }
        ingested++
      } catch (err) {
        console.warn("[trip-learning] activity_knowledge exception:", err)
        errors++
      }
    }
  }

  return { ingested, errors }
}

// ─── Activity Events ───────────────────────────────────────────────────────────

export async function recordActivityEvent(input: {
  tripId: string
  activityId: string
  activityKnowledgeId?: string | null
  userId?: string | null
  eventType: string
  eventValue?: string | null
  metadata?: Record<string, unknown> | null
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  try {
    const supabase = createServiceClient()
    const payload = buildTripActivityEventInsert({
      ...input,
      createdAt: new Date().toISOString(),
    })

    const { error } = await supabase
      .from("trip_activity_events")
      .insert(payload)

    if (error) {
      console.warn("[trip-learning] activity event insert error:", error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn("[trip-learning] activity event exception:", err)
    return false
  }
}

// ─── Day Journals ──────────────────────────────────────────────────────────────

export async function saveDayJournal(input: {
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
}): Promise<{ journalId: string | null }> {
  if (!isSupabaseConfigured()) return { journalId: null }

  try {
    const supabase = createServiceClient()
    const payload = buildTripDayJournalInsert({
      ...input,
      createdAt: new Date().toISOString(),
    })

    const { data, error } = await supabase
      .from("trip_day_journals")
      .upsert(payload, {
        onConflict: "trip_id,day_number",
        ignoreDuplicates: false,
      })
      .select("id")
      .single()

    if (error) {
      // Fallback: plain insert if upsert conflict key doesn't exist yet
      const { data: insertData, error: insertError } = await supabase
        .from("trip_day_journals")
        .insert(payload)
        .select("id")
        .single()

      if (insertError) {
        console.warn("[trip-learning] journal insert error:", insertError.message)
        return { journalId: null }
      }
      return { journalId: insertData?.id ?? null }
    }

    return { journalId: data?.id ?? null }
  } catch (err) {
    console.warn("[trip-learning] journal exception:", err)
    return { journalId: null }
  }
}

export async function saveDayActivityFeedback(input: {
  journalId: string
  tripId: string
  feedback: Array<{
    activityId: string
    activityKnowledgeId?: string | null
    rating?: number | null
    liked?: boolean | null
    notes?: string | null
    wouldRepeat?: boolean | null
    wouldRecommend?: boolean | null
    discoveredOutsidePlan?: boolean
  }>
}): Promise<{ saved: number }> {
  if (!isSupabaseConfigured() || input.feedback.length === 0) return { saved: 0 }

  try {
    const supabase = createServiceClient()
    const rows = input.feedback.map((f) => ({
      trip_day_journal_id: input.journalId,
      trip_id: input.tripId,
      activity_id: f.activityId,
      activity_knowledge_id: f.activityKnowledgeId ?? null,
      rating: f.rating ?? null,
      liked: f.liked ?? null,
      notes: f.notes ?? null,
      would_repeat: f.wouldRepeat ?? null,
      would_recommend: f.wouldRecommend ?? null,
      discovered_outside_plan: f.discoveredOutsidePlan ?? false,
    }))

    const { error } = await supabase
      .from("trip_day_activity_feedback")
      .insert(rows)

    if (error) {
      console.warn("[trip-learning] activity feedback insert error:", error.message)
      return { saved: 0 }
    }

    return { saved: rows.length }
  } catch (err) {
    console.warn("[trip-learning] activity feedback exception:", err)
    return { saved: 0 }
  }
}

// ─── Destination Memory ────────────────────────────────────────────────────────

export async function updateDestinationMemory(input: {
  userId: string
  destination: string
  country?: string | null
  tripId: string
  incoming: {
    likedTags?: string[]
    dislikedTags?: string[]
    favoriteActivityIds?: string[]
    skippedActivityIds?: string[]
    unfinishedActivityIds?: string[]
    discoveredPlaces?: string[]
  }
  summary?: string | null
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  try {
    const supabase = createServiceClient()

    // Fetch existing memory
    const { data: existing } = await supabase
      .from("user_destination_memory")
      .select("*")
      .eq("user_id", input.userId)
      .eq("destination", input.destination)
      .maybeSingle()

    const merged = summarizeDestinationMemoryUpdate({
      existing: existing
        ? {
            likedTags: existing.liked_tags ?? [],
            dislikedTags: existing.disliked_tags ?? [],
            favoriteActivityIds: existing.favorite_activity_ids ?? [],
            skippedActivityIds: existing.skipped_activity_ids ?? [],
            unfinishedActivityIds: existing.unfinished_activity_ids ?? [],
            discoveredPlaces: (existing.discovered_places as string[]) ?? [],
          }
        : undefined,
      incoming: input.incoming,
    })

    if (existing) {
      const { error } = await supabase
        .from("user_destination_memory")
        .update({
          ...merged,
          visit_count: (existing.visit_count ?? 1) + (existing.last_trip_id === input.tripId ? 0 : 1),
          last_trip_id: input.tripId,
          summary: input.summary ?? existing.summary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      if (error) {
        console.warn("[trip-learning] destination memory update error:", error.message)
        return false
      }
    } else {
      const { error } = await supabase
        .from("user_destination_memory")
        .insert({
          user_id: input.userId,
          destination: input.destination,
          country: input.country ?? null,
          visit_count: 1,
          last_trip_id: input.tripId,
          summary: input.summary ?? null,
          ...merged,
          discovered_places: merged.discovered_places,
        })

      if (error) {
        console.warn("[trip-learning] destination memory insert error:", error.message)
        return false
      }
    }

    return true
  } catch (err) {
    console.warn("[trip-learning] destination memory exception:", err)
    return false
  }
}

// ─── User Preference Signals ───────────────────────────────────────────────────

export async function upsertPreferenceSignal(input: {
  userId: string
  signalType: string
  signalKey: string
  delta: number
  context?: Record<string, unknown> | null
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  try {
    const supabase = createServiceClient()

    const { data: existing } = await supabase
      .from("user_preference_signals")
      .select("id, signal_value")
      .eq("user_id", input.userId)
      .eq("signal_type", input.signalType)
      .eq("signal_key", input.signalKey)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from("user_preference_signals")
        .update({
          signal_value: (existing.signal_value ?? 0) + input.delta,
          context: input.context ?? {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      if (error) {
        console.warn("[trip-learning] preference signal update error:", error.message)
        return false
      }
    } else {
      const { error } = await supabase
        .from("user_preference_signals")
        .insert({
          user_id: input.userId,
          signal_type: input.signalType,
          signal_key: input.signalKey,
          signal_value: input.delta,
          context: input.context ?? {},
        })

      if (error) {
        console.warn("[trip-learning] preference signal insert error:", error.message)
        return false
      }
    }

    return true
  } catch (err) {
    console.warn("[trip-learning] preference signal exception:", err)
    return false
  }
}

// ─── Fetch Diary ───────────────────────────────────────────────────────────────

export async function getDayJournal(tripId: string, dayNumber: number) {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("trip_day_journals")
      .select("*")
      .eq("trip_id", tripId)
      .eq("day_number", dayNumber)
      .maybeSingle()

    if (error) return null
    return data
  } catch {
    return null
  }
}

export async function getDayActivityFeedback(journalId: string) {
  if (!isSupabaseConfigured()) return []

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("trip_day_activity_feedback")
      .select("*")
      .eq("trip_day_journal_id", journalId)

    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}
