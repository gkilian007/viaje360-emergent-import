import { NextRequest } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { adaptRequestSchema } from "@/lib/api/contracts"
import {
  normalizeRouteError,
  parseJsonBody,
  successResponse,
  errorResponse,
} from "@/lib/api/route-helpers"
import { geocodeItinerary } from "@/lib/services/geocode.server"
import { adaptItinerary } from "@/lib/services/itinerary.service"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  // Rate limit: max 20 adaptations per IP per day
  const rl = await rateLimit(req, "itinerary-adapt", 20, "1 d")
  if (!rl.ok) return rl.response!

  try {
    const body = await parseJsonBody(req, adaptRequestSchema)
    const adapted = await adaptItinerary(body.tripId, body.reason, body.source, body.startFromDayNumber)

    if (!adapted) {
      return errorResponse("BAD_GATEWAY", "Could not adapt itinerary", 502)
    }

    // Server-side geocoding for new/changed activities
    const supabase = createServiceClient()
    const { data: trip } = await supabase
      .from("trips")
      .select("destination")
      .eq("id", body.tripId)
      .single()
    if (trip?.destination) {
      await geocodeItinerary(adapted, String(trip.destination))
    }

    return successResponse({ itinerary: adapted })
  } catch (error) {
    console.error("itinerary/adapt error:", error)
    return normalizeRouteError(error, "Failed to adapt itinerary")
  }
}
