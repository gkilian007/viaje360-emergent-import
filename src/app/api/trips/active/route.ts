import { NextRequest } from "next/server"
import { normalizeRouteError, successResponse } from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { getActiveTrip, getChatHistory, mapDbChatMessagesToAppMessages } from "@/lib/services/trip.service"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const identity = await resolveRequestIdentity()

    if (!identity.userId) {
      return successResponse({ trip: null, days: [], chatMessages: [] })
    }

    const dbTrip = await getActiveTrip(identity.userId)

    if (!dbTrip) {
      return successResponse({ trip: null, days: [], chatMessages: [] })
    }

    const supabase = createServiceClient()

    // Fetch itinerary days + activities
    const { data: dbDays, error: daysError } = await supabase
      .from("itinerary_days")
      .select("*")
      .eq("trip_id", dbTrip.id)
      .order("day_number", { ascending: true })

    if (daysError) {
      console.warn("Failed to fetch itinerary days:", daysError)
      return successResponse({ trip: null, days: [], chatMessages: [] })
    }

    const { data: dbActivities, error: activitiesError } = await supabase
      .from("activities")
      .select("*")
      .eq("trip_id", dbTrip.id)
      .order("sort_order", { ascending: true })

    if (activitiesError) {
      console.warn("Failed to fetch activities:", activitiesError)
    }

    // Map DB rows → app types
    const activitiesByDay = new Map<string, typeof dbActivities>()
    for (const act of dbActivities ?? []) {
      const dayId = act.day_id as string
      if (!activitiesByDay.has(dayId)) activitiesByDay.set(dayId, [])
      activitiesByDay.get(dayId)!.push(act)
    }

    const days = (dbDays ?? []).map((day) => {
      const dayActivities = activitiesByDay.get(day.id as string) ?? []
      return {
        date: day.date,
        dayNumber: day.day_number,
        theme: day.theme ?? undefined,
        isRestDay: day.is_rest_day ?? false,
        activities: dayActivities.map((act) => ({
          id: act.id,
          name: act.name,
          type: act.type,
          location: act.location ?? "",
          time: act.time ?? "",
          duration: act.duration ?? 60,
          cost: act.cost ?? 0,
          notes: act.notes ?? undefined,
          description: act.notes ?? undefined,
          icon: act.icon ?? undefined,
          neighborhood: act.neighborhood ?? undefined,
          indoor: act.indoor ?? false,
          weatherDependent: act.weather_dependent ?? false,
          kidFriendly: act.kid_friendly ?? false,
          petFriendly: act.pet_friendly ?? false,
          booked: act.booked ?? false,
        })),
      }
    })

    const trip = {
      id: dbTrip.id,
      name: dbTrip.name,
      destination: dbTrip.destination,
      country: (dbTrip as any).country ?? "",
      startDate: dbTrip.start_date,
      endDate: dbTrip.end_date,
      budget: Number(dbTrip.budget ?? 0),
      spent: Number(dbTrip.spent ?? 0),
      status: dbTrip.status ?? "active",
    }

    // Fetch chat messages
    const dbMessages = await getChatHistory(dbTrip.id as string)
    const chatMessages = mapDbChatMessagesToAppMessages(dbMessages)

    return successResponse({ trip, days, chatMessages })
  } catch (error) {
    console.error("trips/active error:", error)
    return normalizeRouteError(error, "Failed to load active trip")
  }
}
