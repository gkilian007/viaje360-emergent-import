import { createServiceClient } from "@/lib/supabase/server"
import type {
  DbChatMessage,
  DbTrip,
  GeneratedItinerary,
  DbItineraryVersion,
  DbAdaptationEvent,
} from "@/lib/supabase/database.types"
import type { ChatMessage } from "@/lib/types"
import {
  buildAdaptationEventInsert,
  buildItineraryVersionInsert,
  getNextVersionNumber,
  type ItineraryVersionSource,
} from "@/lib/services/itinerary-versioning"

function calculateItineraryBudget(itinerary: GeneratedItinerary) {
  return itinerary.days.reduce((dayTotal, day) => {
    return dayTotal + day.activities.reduce((actTotal, act) => actTotal + (act.cost ?? 0), 0)
  }, 0)
}

async function insertItinerarySchedule(
  tripId: string,
  itinerary: GeneratedItinerary
): Promise<void> {
  const supabase = createServiceClient()

  for (const day of itinerary.days) {
    const { data: dayRow, error: dayError } = await supabase
      .from("itinerary_days")
      .insert({
        trip_id: tripId,
        day_number: day.dayNumber,
        date: day.date,
        theme: day.theme,
        is_rest_day: day.isRestDay,
      })
      .select()
      .single()

    if (dayError || !dayRow) {
      throw dayError ?? new Error(`Failed to create itinerary day ${day.dayNumber}`)
    }

    if (day.activities.length === 0) continue

    const { error: activitiesError } = await supabase.from("activities").insert(
      day.activities.map((act, i) => ({
        day_id: dayRow.id,
        trip_id: tripId,
        name: act.name,
        type: act.type,
        location: act.location ?? null,
        address: act.address ?? null,
        time: act.time ?? null,
        end_time: act.endTime ?? null,
        duration: act.duration ?? null,
        cost: act.cost ?? 0,
        booked: false,
        is_locked: act.isLocked ?? false,
        notes: act.notes ?? null,
        icon: act.icon ?? null,
        neighborhood: act.location ?? null,
        indoor: act.indoor ?? false,
        weather_dependent: act.weatherDependent ?? false,
        kid_friendly: act.kidFriendly ?? false,
        pet_friendly: act.petFriendly ?? false,
        dietary_tags: act.dietaryTags ?? [],
        is_ai_suggestion: true,
        sort_order: i,
        description: act.description ?? null,
        url: act.url ?? null,
        image_query: act.imageQuery ?? null,
        price_per_person: act.pricePerPerson ?? null,
        recommendation_reason: act.recommendationReason ?? null,
        latitude: act.lat ?? null,
        longitude: act.lng ?? null,
      }))
    )

    if (activitiesError) {
      throw activitiesError
    }
  }
}

export async function replaceTripItinerary(
  tripId: string,
  itinerary: GeneratedItinerary
): Promise<void> {
  const supabase = createServiceClient()

  const { error: deleteError } = await supabase
    .from("itinerary_days")
    .delete()
    .eq("trip_id", tripId)

  if (deleteError) {
    throw deleteError
  }

  await insertItinerarySchedule(tripId, itinerary)

  const { error: updateError } = await supabase
    .from("trips")
    .update({
      name: itinerary.tripName,
      budget: calculateItineraryBudget(itinerary),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tripId)

  if (updateError) {
    throw updateError
  }
}

export async function listItineraryVersions(
  tripId: string
): Promise<DbItineraryVersion[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("itinerary_versions")
      .select("*")
      .eq("trip_id", tripId)
      .order("version_number", { ascending: true })

    if (error) return []
    return (data as DbItineraryVersion[]) ?? []
  } catch (err) {
    console.error("listItineraryVersions error:", err)
    return []
  }
}

export async function createItineraryVersion(input: {
  tripId: string
  itinerary: GeneratedItinerary
  source: ItineraryVersionSource
  reason?: string | null
  createdBy?: string | null
}): Promise<DbItineraryVersion | null> {
  try {
    const supabase = createServiceClient()
    const existingVersions = await listItineraryVersions(input.tripId)
    const nextVersionNumber = getNextVersionNumber(existingVersions)
    const parentVersionId = existingVersions.at(-1)?.id ?? null
    const now = new Date().toISOString()

    const payload = {
      ...buildItineraryVersionInsert({
        tripId: input.tripId,
        versionNumber: nextVersionNumber,
        itinerary: input.itinerary,
        source: input.source,
        reason: input.reason ?? null,
        createdAt: now,
        createdBy: input.createdBy ?? null,
      }),
      parent_version_id: parentVersionId,
    }

    const { data, error } = await supabase
      .from("itinerary_versions")
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error("createItineraryVersion error:", error)
      return null
    }

    return data as DbItineraryVersion
  } catch (err) {
    console.error("createItineraryVersion exception:", err)
    return null
  }
}

export async function ensureInitialItineraryVersion(input: {
  tripId: string
  itinerary: GeneratedItinerary
  createdBy?: string | null
  reason?: string | null
  source?: ItineraryVersionSource
}): Promise<DbItineraryVersion | null> {
  const versions = await listItineraryVersions(input.tripId)
  if (versions.length > 0) {
    return versions[0] ?? null
  }

  return createItineraryVersion({
    tripId: input.tripId,
    itinerary: input.itinerary,
    createdBy: input.createdBy ?? null,
    reason: input.reason ?? "Initial generated itinerary",
    source: input.source ?? "generate",
  })
}

export async function createAdaptationEvent(input: {
  tripId: string
  fromVersionId?: string | null
  toVersionId: string
  reason: string
  source: ItineraryVersionSource
  metadata?: Record<string, unknown> | null
}): Promise<DbAdaptationEvent | null> {
  try {
    const supabase = createServiceClient()
    const payload = buildAdaptationEventInsert({
      tripId: input.tripId,
      fromVersionId: input.fromVersionId ?? null,
      toVersionId: input.toVersionId,
      reason: input.reason,
      source: input.source,
      createdAt: new Date().toISOString(),
      metadata: input.metadata ?? null,
    })

    const { data, error } = await supabase
      .from("adaptation_events")
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error("createAdaptationEvent error:", error)
      return null
    }

    return data as DbAdaptationEvent
  } catch (err) {
    console.error("createAdaptationEvent exception:", err)
    return null
  }
}

export async function createTrip(
  userId: string,
  onboardingId: string,
  itinerary: GeneratedItinerary,
  startDate: string,
  endDate: string,
  destination: string
): Promise<DbTrip | null> {
  try {
    const supabase = createServiceClient()
    const totalBudget = calculateItineraryBudget(itinerary)

    const { data: trip, error } = await supabase
      .from("trips")
      .insert({
        user_id: userId,
        onboarding_id: onboardingId,
        name: itinerary.tripName,
        destination,
        start_date: startDate,
        end_date: endDate,
        budget: totalBudget,
        spent: 0,
        status: "active",
      })
      .select()
      .single()

    if (error || !trip) {
      console.error("createTrip error:", error)
      return null
    }

    await insertItinerarySchedule(trip.id as string, itinerary)
    await ensureInitialItineraryVersion({
      tripId: trip.id as string,
      itinerary,
      createdBy: userId,
      reason: "Initial generated itinerary",
      source: "generate",
    })

    // Cache destination image asynchronously (non-blocking)
    const supabase = createServiceClient()
    const encoded = encodeURIComponent(destination.toLowerCase())
    const imageUrl = `https://source.unsplash.com/featured/800x400/?${encoded},travel,city`
    supabase.from("trips").update({ image_url: imageUrl }).eq("id", trip.id as string).then(() => {})

    return trip as DbTrip
  } catch (err) {
    console.error("createTrip exception:", err)
    return null
  }
}

export async function getActiveTrip(userId: string): Promise<DbTrip | null> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error) return null
    return data as DbTrip
  } catch {
    return null
  }
}

export async function updateTrip(
  tripId: string,
  data: Partial<Omit<DbTrip, "id" | "created_at">>
): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase
      .from("trips")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", tripId)
  } catch (err) {
    console.error("updateTrip error:", err)
  }
}

export async function addChatMessage(
  tripId: string,
  userId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from("chat_messages").insert({
      trip_id: tripId,
      user_id: userId,
      role,
      content,
    })
  } catch (err) {
    console.error("addChatMessage error:", err)
  }
}

export function mapDbChatMessagesToAppMessages(messages: DbChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.created_at,
  }))
}

export async function getChatHistory(
  tripId: string
): Promise<DbChatMessage[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true })

    if (error) return []
    return (data as DbChatMessage[]) ?? []
  } catch {
    return []
  }
}
