import { NextRequest } from "next/server"
import { adaptRequestSchema } from "@/lib/api/contracts"
import {
  normalizeRouteError,
  parseJsonBody,
  successResponse,
  errorResponse,
} from "@/lib/api/route-helpers"
import { adaptItinerary } from "@/lib/services/itinerary.service"

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req, adaptRequestSchema)
    const adapted = await adaptItinerary(body.tripId, body.reason, body.source, body.startFromDayNumber)

    if (!adapted) {
      return errorResponse("BAD_GATEWAY", "Could not adapt itinerary", 502)
    }

    return successResponse({ itinerary: adapted })
  } catch (error) {
    console.error("itinerary/adapt error:", error)
    return normalizeRouteError(error, "Failed to adapt itinerary")
  }
}
