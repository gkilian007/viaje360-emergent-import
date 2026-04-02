import { NextRequest } from "next/server"
import { successResponse, errorResponse, normalizeRouteError } from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { createServiceClient } from "@/lib/supabase/server"

/**
 * POST /api/trips/[tripId]/image
 * Generates and caches a deterministic image URL for a trip's destination.
 * Uses Unsplash source URL and stores it in trips.image_url for future requests.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const identity = await resolveRequestIdentity()
    if (!identity.userId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401)
    }

    const { tripId } = await params
    const supabase = createServiceClient()

    // Fetch the trip to get the destination
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, destination, image_url, user_id")
      .eq("id", tripId)
      .single()

    if (tripError || !trip) {
      return errorResponse("NOT_FOUND", "Trip not found", 404)
    }

    if (trip.user_id !== identity.userId) {
      return errorResponse("FORBIDDEN", "Access denied", 403)
    }

    // Return cached URL if already stored
    if (trip.image_url) {
      return successResponse({ imageUrl: trip.image_url })
    }

    // Construct a deterministic Unsplash URL for the destination
    const encoded = encodeURIComponent((trip.destination as string).toLowerCase())
    const imageUrl = `https://source.unsplash.com/featured/800x400/?${encoded},travel,city`

    // Store in DB for future requests
    await supabase
      .from("trips")
      .update({ image_url: imageUrl })
      .eq("id", tripId)

    return successResponse({ imageUrl })
  } catch (error) {
    console.error("trips/image error:", error)
    return normalizeRouteError(error, "Failed to fetch trip image")
  }
}
