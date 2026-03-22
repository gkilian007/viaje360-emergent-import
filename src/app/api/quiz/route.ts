import { NextRequest, NextResponse } from "next/server"
import { generateQuizQuestion } from "@/lib/gemini"
import { createServiceClient } from "@/lib/supabase/server"
import { updateXp } from "@/lib/services/profile.service"
import type { QuizQuestion } from "@/lib/types"

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tripId = searchParams.get("tripId")
    let destination = searchParams.get("destination") ?? "Barcelona"

    // If tripId provided, get the actual destination from Supabase
    if (tripId) {
      try {
        const supabase = createServiceClient()
        const { data: trip } = await supabase
          .from("trips")
          .select("destination")
          .eq("id", tripId)
          .single()

        if (trip?.destination) {
          destination = trip.destination as string
        }
      } catch {
        // fallback to query param destination
      }
    }

    const raw = await generateQuizQuestion(destination)

    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()

    let parsed: Omit<QuizQuestion, "id">
    try {
      parsed = JSON.parse(cleaned) as Omit<QuizQuestion, "id">
    } catch {
      return NextResponse.json({ error: "Invalid JSON from Gemini" }, { status: 500 })
    }

    const question: QuizQuestion = {
      id: `quiz-${Date.now()}`,
      ...parsed,
    }

    return NextResponse.json({ question })
  } catch (err) {
    console.error("Quiz API error:", err)
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 })
  }
}

// POST to award XP after correct quiz answer
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { xpReward: number; userId?: string }
    const userId = body.userId ?? DEMO_USER_ID

    await updateXp(userId, body.xpReward ?? 50)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Quiz XP award error:", err)
    return NextResponse.json({ error: "Failed to award XP" }, { status: 500 })
  }
}
