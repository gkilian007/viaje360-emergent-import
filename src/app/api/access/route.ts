import { NextRequest } from "next/server"
import { successResponse, normalizeRouteError } from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { resolveAccess } from "@/lib/services/access.service"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const destination = searchParams.get("destination")
    const tripStartDate = searchParams.get("tripStartDate") // ISO date of trip start

    if (!destination) {
      return successResponse({
        hasAccess: true,
        reason: "trial",
        plan: "free",
        trialExpiresAt: null,
        daysRemaining: null,
        canAdapt: true,
        canGenerate: true,
        canDiary: true,
      })
    }

    const identity = await resolveRequestIdentity()
    const access = await resolveAccess(identity.userId, destination, tripStartDate)

    return successResponse(access)
  } catch (error) {
    console.error("access check error:", error)
    return normalizeRouteError(error, "Failed to check access")
  }
}
