import { NextRequest } from "next/server"
import { generateQuizQuestion } from "@/lib/gemini"
import { quizAwardRequestSchema } from "@/lib/api/contracts"
import {
  errorResponse,
  normalizeRouteError,
  parseJsonBody,
  successResponse,
} from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { createServiceClient } from "@/lib/supabase/server"
import { updateXp } from "@/lib/services/profile.service"
import type { QuizQuestion } from "@/lib/types"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tripId = searchParams.get("tripId")
    let destination = searchParams.get("destination") ?? "Barcelona"

    if (tripId) {
      try {
        const supabase = createServiceClient()
        const { data: trip } = await supabase.from("trips").select("destination").eq("id", tripId).single()
        if (trip?.destination) {
          destination = trip.destination as string
        }
      } catch {
        // keep destination query fallback
      }
    }

    const raw = await generateQuizQuestion(destination)
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()

    let parsed: Omit<QuizQuestion, "id">
    try {
      parsed = JSON.parse(cleaned) as Omit<QuizQuestion, "id">
    } catch {
      return errorResponse("BAD_GATEWAY", "Invalid JSON from Gemini", 502)
    }

    const question: QuizQuestion = {
      id: `quiz-${Date.now()}`,
      ...parsed,
    }

    return successResponse({ question })
  } catch (error) {
    console.error("Quiz API error:", error)
    return normalizeRouteError(error, "Failed to generate quiz")
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req, quizAwardRequestSchema)
    const identity = await resolveRequestIdentity()

    if (!identity.userId) {
      return errorResponse("UNAUTHORIZED", "Authentication required to award XP", 401)
    }

    await updateXp(identity.userId, body.xpReward)

    return successResponse({ success: true, identity })
  } catch (error) {
    console.error("Quiz XP award error:", error)
    return normalizeRouteError(error, "Failed to award XP")
  }
}
