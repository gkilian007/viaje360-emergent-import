import { createServiceClient } from "@/lib/supabase/server"
import type { DbTrip, DbChatMessage, GeneratedItinerary } from "@/lib/supabase/database.types"

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

    // Calculate total budget from activities
    const totalBudget = itinerary.days.reduce((dayTotal, day) => {
      return dayTotal + day.activities.reduce((actTotal, act) => actTotal + (act.cost ?? 0), 0)
    }, 0)

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

    if (error) {
      console.error("createTrip error:", error)
      return null
    }

    // Insert itinerary days and activities
    for (const day of itinerary.days) {
      const { data: dayRow, error: dayError } = await supabase
        .from("itinerary_days")
        .insert({
          trip_id: trip.id,
          day_number: day.dayNumber,
          date: day.date,
          theme: day.theme,
          is_rest_day: day.isRestDay,
        })
        .select()
        .single()

      if (dayError || !dayRow) continue

      if (day.activities.length > 0) {
        await supabase.from("activities").insert(
          day.activities.map((act, i) => ({
            day_id: dayRow.id,
            trip_id: trip.id,
            name: act.name,
            type: act.type,
            location: act.location ?? null,
            address: act.address ?? null,
            time: act.time ?? null,
            end_time: act.endTime ?? null,
            duration: act.duration ?? null,
            cost: act.cost ?? 0,
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
          }))
        )
      }
    }

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
