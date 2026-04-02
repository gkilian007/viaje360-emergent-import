import { NextRequest } from "next/server"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"
import { normalizeRouteError, parseJsonBody, successResponse, errorResponse } from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { createServiceClient } from "@/lib/supabase/server"

const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(["viewer", "editor"]).default("viewer"),
})

/** GET — list collaborators for a trip */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const rl = await rateLimit(req, "collaborators", 30, "1 m")
  if (!rl.ok) return rl.response!

  const { tripId } = await params

  try {
    const identity = await resolveRequestIdentity()
    if (!identity.userId) return errorResponse("UNAUTHORIZED", "Login required", 401)

    const supabase = createServiceClient()

    // Verify ownership
    const { data: trip } = await supabase
      .from("trips")
      .select("user_id")
      .eq("id", tripId)
      .single()

    if (!trip) return errorResponse("NOT_FOUND", "Trip not found", 404)

    const { data: collabs } = await supabase
      .from("trip_collaborators")
      .select("id, email, role, accepted, created_at")
      .eq("trip_id", tripId)
      .order("created_at")

    return successResponse({ collaborators: collabs ?? [], isOwner: trip.user_id === identity.userId })
  } catch (error) {
    return normalizeRouteError(error, "Failed to list collaborators")
  }
}

/** POST — invite a collaborator */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const rl = await rateLimit(req, "collaborators-invite", 10, "1 h")
  if (!rl.ok) return rl.response!

  const { tripId } = await params

  try {
    const body = await parseJsonBody(req, addSchema)
    const identity = await resolveRequestIdentity()
    if (!identity.userId) return errorResponse("UNAUTHORIZED", "Login required", 401)

    const supabase = createServiceClient()

    // Verify ownership
    const { data: trip } = await supabase
      .from("trips")
      .select("user_id, destination")
      .eq("id", tripId)
      .single()

    if (!trip || trip.user_id !== identity.userId) {
      return errorResponse("UNAUTHORIZED", "Solo el propietario puede invitar", 403)
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from("trip_collaborators")
      .select("id")
      .eq("trip_id", tripId)
      .eq("email", body.email.toLowerCase())
      .maybeSingle()

    if (existing) {
      return errorResponse("VALIDATION_ERROR", "Ya invitado", 400)
    }

    const { data: collab, error } = await supabase
      .from("trip_collaborators")
      .insert({
        trip_id: tripId,
        email: body.email.toLowerCase(),
        role: body.role,
        invited_by: identity.userId,
        accepted: false,
      })
      .select()
      .single()

    if (error) throw error

    // TODO: Send invitation email via Resend

    return successResponse({ collaborator: collab })
  } catch (error) {
    return normalizeRouteError(error, "Failed to invite collaborator")
  }
}
