import { NextRequest, NextResponse } from "next/server"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { recordActivityEvent } from "@/lib/services/trip-learning.db"

interface ActivityLockBody {
  tripId: string
  activityId: string
  locked: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ActivityLockBody

    if (!body.tripId || !body.activityId || typeof body.locked !== "boolean") {
      return NextResponse.json(
        { ok: false, message: "Missing required fields: tripId, activityId, locked" },
        { status: 400 }
      )
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: true, persisted: false })
    }

    const identity = await resolveRequestIdentity()
    if (!identity.userId) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from("activities")
      .update({ is_locked: body.locked })
      .eq("id", body.activityId)
      .eq("trip_id", body.tripId)

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    }

    await recordActivityEvent({
      tripId: body.tripId,
      activityId: body.activityId,
      userId: identity.userId,
      eventType: body.locked ? "activity_saved" : "activity_removed",
      eventValue: body.locked ? "locked" : "unlocked",
      metadata: { source: "activity-lock" },
    })

    return NextResponse.json({ ok: true, persisted: true })
  } catch (error) {
    console.error("[activity-lock] Error:", error)
    return NextResponse.json({ ok: false, message: "Error interno del servidor" }, { status: 500 })
  }
}
