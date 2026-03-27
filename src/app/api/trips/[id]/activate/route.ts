import { NextRequest } from "next/server"
import { normalizeRouteError, successResponse, errorResponse } from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identity = await resolveRequestIdentity()

    if (!identity.userId) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401)
    }

    const { id: tripId } = await params
    const supabase = createServiceClient()

    // Verify the trip belongs to the user
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id")
      .eq("id", tripId)
      .eq("user_id", identity.userId)
      .maybeSingle()

    if (tripError || !trip) {
      return errorResponse("NOT_FOUND", "Trip not found", 404)
    }

    // Deactivate all other trips for this user
    await supabase
      .from("trips")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("user_id", identity.userId)
      .neq("id", tripId)

    // Activate the requested trip
    const { error: updateError } = await supabase
      .from("trips")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", tripId)

    if (updateError) {
      console.error("activate trip error:", updateError)
      return errorResponse("INTERNAL_ERROR", "Failed to activate trip", 500)
    }

    return successResponse({ tripId, status: "active" })
  } catch (error) {
    console.error("POST /api/trips/[id]/activate error:", error)
    return normalizeRouteError(error, "Failed to activate trip")
  }
}
