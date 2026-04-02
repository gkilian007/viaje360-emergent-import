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

const reorderSchema = z.object({
  tripId: z.string().uuid(),
  dayNumber: z.number().int().min(1),
  activityIds: z.array(z.string()).min(1),
})

export async function PATCH(req: NextRequest) {
  try {
    const identity = await resolveRequestIdentity()
    if (!identity.userId) {
      return errorResponse("UNAUTHORIZED", "Autenticación requerida", 401)
    }

    const body = await parseJsonBody(req, reorderSchema)
    const { tripId, dayNumber, activityIds } = body

    const supabase = createServiceClient()

    // Verify trip belongs to user
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id")
      .eq("id", tripId)
      .eq("user_id", identity.userId)
      .maybeSingle()

    if (tripError || !trip) {
      return errorResponse("NOT_FOUND", "Viaje no encontrado", 404)
    }

    // Get the itinerary day
    const { data: day, error: dayError } = await supabase
      .from("itinerary_days")
      .select("id")
      .eq("trip_id", tripId)
      .eq("day_number", dayNumber)
      .maybeSingle()

    if (dayError || !day) {
      return errorResponse("NOT_FOUND", "Día no encontrado", 404)
    }

    // Update sort_order for each activity in the ordered list
    const updates = activityIds.map((activityId, index) =>
      supabase
        .from("activities")
        .update({ sort_order: index })
        .eq("id", activityId)
        .eq("day_id", day.id)
        .eq("trip_id", tripId)
    )

    const results = await Promise.all(updates)
    const failed = results.filter((r) => r.error)
    if (failed.length > 0) {
      console.error("[reorder] Some activity updates failed:", failed.map((r) => r.error))
      return errorResponse("INTERNAL_ERROR", "Error al reordenar actividades", 500)
    }

    return successResponse({ ok: true, dayNumber, count: activityIds.length })
  } catch (error) {
    return normalizeRouteError(error, "Failed to reorder activities")
  }
}
