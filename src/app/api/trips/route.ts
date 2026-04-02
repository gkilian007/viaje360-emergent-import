import { NextRequest } from "next/server"
import { normalizeRouteError, successResponse, errorResponse } from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { createServiceClient } from "@/lib/supabase/server"
import type { DbTrip } from "@/lib/supabase/database.types"

export interface TripSummary {
  id: string
  name: string
  destination: string
  country: string | null
  startDate: string
  endDate: string
  status: string
  totalDays: number
  totalActivities: number
  budget: number
  spent: number
  createdAt: string
  imageUrl: string | null
}

export async function GET(_req: NextRequest) {
  try {
    const identity = await resolveRequestIdentity()

    if (!identity.userId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401)
    }

    const supabase = createServiceClient()

    // Fetch all user trips
    const { data: trips, error: tripsError } = await supabase
      .from("trips")
      .select("*")
      .eq("user_id", identity.userId)
      .order("created_at", { ascending: false })

    if (tripsError) {
      console.error("GET /api/trips error:", tripsError)
      return errorResponse("INTERNAL_ERROR", "Failed to fetch trips", 500)
    }

    const tripList = (trips as DbTrip[]) ?? []
    const tripIds = tripList.map((t) => t.id)

    if (tripIds.length === 0) {
      return successResponse({ trips: [] })
    }

    // Get activity counts per trip
    const { data: activityCounts } = await supabase
      .from("activities")
      .select("trip_id")
      .in("trip_id", tripIds)

    const activityCountByTrip = new Map<string, number>()
    for (const row of activityCounts ?? []) {
      const tripId = row.trip_id as string
      activityCountByTrip.set(tripId, (activityCountByTrip.get(tripId) ?? 0) + 1)
    }

    // Get day counts per trip
    const { data: dayCounts } = await supabase
      .from("itinerary_days")
      .select("trip_id")
      .in("trip_id", tripIds)

    const dayCountByTrip = new Map<string, number>()
    for (const row of dayCounts ?? []) {
      const tripId = row.trip_id as string
      dayCountByTrip.set(tripId, (dayCountByTrip.get(tripId) ?? 0) + 1)
    }

    const result: TripSummary[] = tripList.map((trip) => ({
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      country: trip.country ?? null,
      startDate: trip.start_date,
      endDate: trip.end_date,
      status: trip.status ?? "active",
      totalDays: dayCountByTrip.get(trip.id) ?? 0,
      totalActivities: activityCountByTrip.get(trip.id) ?? 0,
      budget: Number(trip.budget ?? 0),
      spent: Number(trip.spent ?? 0),
      createdAt: trip.created_at,
      imageUrl: trip.image_url ?? null,
    }))

    return successResponse({ trips: result })
  } catch (error) {
    console.error("GET /api/trips error:", error)
    return normalizeRouteError(error, "Failed to fetch trips")
  }
}
