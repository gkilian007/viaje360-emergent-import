import * as Sentry from "@sentry/nextjs"
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
import { resolveRequestIdentity } from "@/lib/auth/server"
import { requireAccess } from "@/lib/api/access-guard"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Rate limit: max 20 adaptations per IP per day
  const rl = await rateLimit(req, "itinerary-adapt", 20, "1 d")
  if (!rl.ok) return rl.response!

  try {
    const body = await parseJsonBody(req, adaptRequestSchema)
    const identity = await resolveRequestIdentity()

    // Access guard: resolve destination from trip, check canAdapt
    const supabaseGuard = createServiceClient()
    const { data: tripForAccess } = await supabaseGuard
      .from("trips")
      .select("destination, start_date")
      .eq("id", body.tripId)
      .single()
    if (tripForAccess?.destination) {
      const guard = await requireAccess(identity.userId, tripForAccess.destination, "canAdapt", tripForAccess.start_date)
      if (!guard.ok) return guard.response
    }

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
    Sentry.captureException(error)
    return normalizeRouteError(error, "Failed to adapt itinerary")
  }
}
