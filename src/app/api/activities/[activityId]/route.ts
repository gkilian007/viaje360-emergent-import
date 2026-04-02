import { NextRequest } from "next/server"
import { z } from "zod"
import {
  normalizeRouteError,
  parseJsonBody,
  successResponse,
  errorResponse,
} from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { createServiceClient } from "@/lib/supabase/server"
import { geocode } from "@/lib/services/geocoding"

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  time: z.string().optional(),
  duration: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  location: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const identity = await resolveRequestIdentity()
    if (!identity.userId) {
      return errorResponse("UNAUTHORIZED", "Autenticación requerida", 401)
    }

    const { activityId } = await params
    const body = await parseJsonBody(req, patchSchema)

    if (Object.keys(body).length === 0) {
      return errorResponse("VALIDATION_ERROR", "No fields to update", 400)
    }

    const supabase = createServiceClient()

    // Verify the activity belongs to this user's trip
    const { data: existing, error: fetchError } = await supabase
      .from("activities")
      .select("id, name, location, itinerary_day_id, itinerary_days(trip_id, trips(user_id))")
      .eq("id", activityId)
      .maybeSingle()

    if (fetchError || !existing) {
      return errorResponse("NOT_FOUND", "Actividad no encontrada", 404)
    }

    // Type-narrow the nested join result
    const dayRaw = existing.itinerary_days as unknown
    const day = Array.isArray(dayRaw) ? (dayRaw as { trips: unknown }[])[0] : (dayRaw as { trips: unknown } | null)
    const tripsRaw = day ? (day as { trips: unknown }).trips : null
    const tripRow = tripsRaw
      ? (Array.isArray(tripsRaw) ? (tripsRaw as { user_id: string }[])[0] : (tripsRaw as { user_id: string }))
      : null

    if (!tripRow || (tripRow as { user_id: string }).user_id !== identity.userId) {
      return errorResponse("UNAUTHORIZED", "Acceso denegado", 403)
    }

    // Build update payload
    const patch: Record<string, unknown> = {}
    if (body.name !== undefined) patch.name = body.name
    if (body.time !== undefined) patch.time = body.time
    if (body.duration !== undefined) patch.duration_minutes = body.duration
    if (body.notes !== undefined) patch.notes = body.notes
    if (body.location !== undefined) patch.location = body.location

    // If name changed, re-geocode
    if (body.name && body.name !== existing.name) {
      try {
        // Get destination from trip for better geocoding accuracy
        const tripId = (day as { trip_id?: string })?.trip_id
        let destination = ""
        if (tripId) {
          const { data: trip } = await supabase
            .from("trips")
            .select("destination")
            .eq("id", tripId)
            .maybeSingle()
          destination = trip?.destination ?? ""
        }
        const coords = await geocode(body.name, destination)
        if (coords) {
          patch.latitude = coords.lat
          patch.longitude = coords.lng
        }
      } catch (err) {
        console.warn("[activities PATCH] geocode failed:", err)
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("activities")
      .update(patch)
      .eq("id", activityId)
      .select()
      .single()

    if (updateError) {
      return errorResponse("INTERNAL_ERROR", "Error al actualizar actividad", 500)
    }

    return successResponse({ activity: updated })
  } catch (error) {
    return normalizeRouteError(error, "Failed to update activity")
  }
}
