import { NextRequest, NextResponse } from "next/server"
import { buildTripDayJournalInsert, type DiaryMessage } from "@/lib/services/trip-learning"

interface DiaryRequestBody {
  tripId: string
  dayNumber: number
  date: string
  mood: string | null
  energyScore: number
  paceScore: number
  freeTextSummary: string
  wouldRepeat: boolean | null
  conversation: DiaryMessage[]
  activityFeedback: {
    activityId: string
    liked: boolean | null
    wouldRepeat: boolean | null
    notes: string
  }[]
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DiaryRequestBody

    // Validate required fields
    if (!body.tripId || !body.dayNumber || !body.date) {
      return NextResponse.json(
        { ok: false, message: "Missing required fields: tripId, dayNumber, date" },
        { status: 400 }
      )
    }

    // Build the journal insert object using existing service
    const journalData = buildTripDayJournalInsert({
      tripId: body.tripId,
      userId: null, // Would come from auth in production
      dayNumber: body.dayNumber,
      date: body.date,
      conversation: body.conversation,
      freeTextSummary: body.freeTextSummary || null,
      mood: body.mood,
      energyScore: body.energyScore,
      paceScore: body.paceScore,
      wouldRepeat: body.wouldRepeat,
      createdAt: new Date().toISOString(),
    })

    // In production, this would save to Supabase
    // For now, we'll simulate the save and return success
    // TODO: Implement actual Supabase integration when configured

    console.log("[Diary API] Saving journal entry:", {
      tripId: body.tripId,
      dayNumber: body.dayNumber,
      mood: body.mood,
      activityFeedbackCount: body.activityFeedback.length,
    })

    // Simulate processing activity feedback
    const processedFeedback = body.activityFeedback.map((feedback) => ({
      ...feedback,
      processedAt: new Date().toISOString(),
    }))

    return NextResponse.json({
      ok: true,
      data: {
        journal: journalData,
        activityFeedback: processedFeedback,
        message: "Diario guardado correctamente",
      },
    })
  } catch (error) {
    console.error("[Diary API] Error:", error)
    return NextResponse.json(
      { ok: false, message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get("tripId")
    const dayNumber = searchParams.get("dayNumber")

    if (!tripId || !dayNumber) {
      return NextResponse.json(
        { ok: false, message: "Missing required params: tripId, dayNumber" },
        { status: 400 }
      )
    }

    // In production, this would fetch from Supabase
    // For now, return null to indicate no existing diary
    return NextResponse.json({
      ok: true,
      data: {
        journal: null,
        activityFeedback: [],
      },
    })
  } catch (error) {
    console.error("[Diary API] Error:", error)
    return NextResponse.json(
      { ok: false, message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
