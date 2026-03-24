import { NextRequest, NextResponse } from "next/server"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { getDiaryEntry, saveDiaryEntry } from "@/lib/services/diary.service"
import type { DiaryMessage } from "@/lib/services/trip-learning"

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

    if (!body.tripId || !body.dayNumber || !body.date) {
      return NextResponse.json(
        { ok: false, message: "Missing required fields: tripId, dayNumber, date" },
        { status: 400 }
      )
    }

    const identity = await resolveRequestIdentity()
    const saved = await saveDiaryEntry({
      tripId: body.tripId,
      userId: identity.isAuthenticated ? identity.userId : null,
      dayNumber: body.dayNumber,
      date: body.date,
      mood: body.mood,
      energyScore: body.energyScore,
      paceScore: body.paceScore,
      freeTextSummary: body.freeTextSummary,
      wouldRepeat: body.wouldRepeat,
      conversation: body.conversation,
      activityFeedback: body.activityFeedback,
    })

    return NextResponse.json({
      ok: true,
      data: {
        journal: saved.journal,
        activityFeedbackCount: saved.activityFeedbackCount,
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

    const diary = await getDiaryEntry(tripId, Number(dayNumber))

    return NextResponse.json({
      ok: true,
      data: diary,
    })
  } catch (error) {
    console.error("[Diary API] Error:", error)
    return NextResponse.json(
      { ok: false, message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
