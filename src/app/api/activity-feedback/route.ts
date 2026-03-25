import { NextRequest, NextResponse } from "next/server"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server"
import {
  recordActivityEvent,
  updateDestinationMemory,
  upsertPreferenceSignal,
} from "@/lib/services/trip-learning.db"

interface ActivityFeedbackBody {
  tripId: string
  activityId: string
  feedback: "liked" | "disliked" | "more_like_this" | "less_like_this"
}

const FEEDBACK_EVENT_MAP = {
  liked: "activity_liked",
  disliked: "activity_disliked",
  more_like_this: "activity_liked",
  less_like_this: "activity_disliked",
} as const

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ActivityFeedbackBody

    if (!body.tripId || !body.activityId || !body.feedback) {
      return NextResponse.json(
        { ok: false, message: "Missing required fields: tripId, activityId, feedback" },
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

    const [{ data: trip }, { data: activity }] = await Promise.all([
      supabase.from("trips").select("id,destination,country").eq("id", body.tripId).single(),
      supabase
        .from("activities")
        .select("id,name,type,location")
        .eq("id", body.activityId)
        .single(),
    ])

    if (!trip || !activity) {
      return NextResponse.json({ ok: false, message: "Trip or activity not found" }, { status: 404 })
    }

    const eventType = FEEDBACK_EVENT_MAP[body.feedback]
    await recordActivityEvent({
      tripId: body.tripId,
      activityId: body.activityId,
      userId: identity.userId,
      eventType,
      eventValue: body.feedback,
      metadata: {
        activityName: activity.name,
        activityType: activity.type,
      },
    })

    const isPositive = body.feedback === "liked" || body.feedback === "more_like_this"
    const isNegative = body.feedback === "disliked" || body.feedback === "less_like_this"
    const delta = body.feedback === "more_like_this" || body.feedback === "less_like_this" ? 2 : 1

    await Promise.all([
      upsertPreferenceSignal({
        userId: identity.userId,
        signalType: "activity_type",
        signalKey: String(activity.type ?? "tour"),
        delta: isPositive ? delta : -delta,
        context: {
          tripId: body.tripId,
          activityId: body.activityId,
          feedback: body.feedback,
        },
      }),
      updateDestinationMemory({
        userId: identity.userId,
        destination: String(trip.destination ?? ""),
        country: typeof trip.country === "string" ? trip.country : null,
        tripId: body.tripId,
        incoming: {
          likedTags: isPositive ? [String(activity.type ?? "tour")] : [],
          dislikedTags: isNegative ? [String(activity.type ?? "tour")] : [],
          favoriteActivityIds: isPositive ? [body.activityId] : [],
          skippedActivityIds: isNegative ? [body.activityId] : [],
          discoveredPlaces: [],
        },
      }),
    ])

    return NextResponse.json({ ok: true, persisted: true })
  } catch (error) {
    console.error("[activity-feedback] Error:", error)
    return NextResponse.json(
      { ok: false, message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
