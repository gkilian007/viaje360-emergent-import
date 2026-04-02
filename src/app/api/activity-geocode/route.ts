import { NextRequest } from "next/server"
import { z } from "zod"
import {
  normalizeRouteError,
  parseJsonBody,
  successResponse,
  errorResponse,
} from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { geocode } from "@/lib/services/geocoding"
import { createServiceClient } from "@/lib/supabase/server"

const schema = z.object({
  activityId: z.string().min(1),
  name: z.string().min(1),
  destination: z.string().min(1),
})

/**
 * POST /api/activity-geocode
 * Re-geocodes an activity after a name change and updates lat/lng in the DB.
 * Body: { activityId, name, destination }
 */
export async function POST(req: NextRequest) {
  try {
    const identity = await resolveRequestIdentity()
    if (!identity.userId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401)
    }

    const body = await parseJsonBody(req, schema)
    const coords = await geocode(body.name, body.destination)

    if (!coords) {
      return successResponse({ geocoded: false, lat: null, lng: null })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from("activities")
      .update({ latitude: coords.lat, longitude: coords.lng })
      .eq("id", body.activityId)

    if (error) {
      console.error("activity-geocode update error:", error)
      return errorResponse("INTERNAL_ERROR", "Failed to update activity coordinates", 500)
    }

    return successResponse({ geocoded: true, lat: coords.lat, lng: coords.lng })
  } catch (error) {
    console.error("activity-geocode error:", error)
    return normalizeRouteError(error, "Failed to geocode activity")
  }
}
