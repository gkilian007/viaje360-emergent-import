import { NextRequest } from "next/server"
import { generateChatResponse } from "@/lib/gemini"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { chatRequestSchema } from "@/lib/api/contracts"
import {
  normalizeRouteError,
  parseJsonBody,
  successResponse,
} from "@/lib/api/route-helpers"
import { addChatMessage, getChatHistory } from "@/lib/services/trip.service"
import { createServiceClient } from "@/lib/supabase/server"

function isPersistedTripId(tripId: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tripId)
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req, chatRequestSchema)
    const identity = await resolveRequestIdentity()
    const { message, tripId, tripContext } = body
    let { history } = body

    let systemContext = tripContext?.trim() ?? ""
    if (tripId && identity.userId && isPersistedTripId(tripId)) {
      try {
        const supabase = createServiceClient()
        const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).single()
        const { data: onboarding } = trip
          ? await supabase.from("onboarding_profiles").select("*").eq("id", trip.onboarding_id).single()
          : { data: null }

        if (trip) {
          // Load full itinerary for complete context
          const { data: versions } = await supabase
            .from("trip_itinerary_versions")
            .select("day_number, activities_snapshot")
            .eq("trip_id", tripId)
            .order("day_number")

          const itineraryText = (versions ?? []).map(v => {
            const acts = (v.activities_snapshot as Array<{name: string; time: string; location: string; type: string}> ?? [])
              .map(a => `    ${a.time} ${a.name} (${a.location})`)
              .join("\n")
            return `  Day ${v.day_number}:\n${acts}`
          }).join("\n")

          const persistedContext = `
Current trip context:
- Destination: ${trip.destination}
- Trip name: ${trip.name}
- Dates: ${trip.start_date} to ${trip.end_date}
- Budget: €${trip.budget} (spent €${trip.spent})
${onboarding ? `
User preferences:
- Companion: ${onboarding.companion} (${onboarding.group_size} people)
- Interests: ${(onboarding.interests as string[]).join(", ")}
- Dietary: ${(onboarding.dietary_restrictions as string[]).join(", ") || "none"}
- Transport: ${(onboarding.transport as string[]).join(", ")}
- Budget level: ${onboarding.budget_level}
` : ""}${itineraryText ? `\nFull itinerary:\n${itineraryText}` : ""}`.trim()

          systemContext = [systemContext, persistedContext].filter(Boolean).join("\n\n")
        }

        if (history.length === 0) {
          const savedMessages = await getChatHistory(tripId)
          history = savedMessages.map((savedMessage) => ({
            role: (savedMessage.role === "assistant" ? "model" : "user") as "user" | "model",
            text: savedMessage.content,
          }))
        }
      } catch (contextError) {
        console.warn("Could not load trip context:", contextError)
      }
    }

    const response = await generateChatResponse(history, message, systemContext)

    if (tripId && identity.userId && isPersistedTripId(tripId)) {
      try {
        await addChatMessage(tripId, identity.userId, "user", message)
        await addChatMessage(tripId, identity.userId, "assistant", response)
      } catch (saveError) {
        console.warn("Could not save chat messages:", saveError)
      }
    }

    return successResponse({ response })
  } catch (error) {
    console.error("Chat API error:", error)
    return normalizeRouteError(error, "Failed to generate response")
  }
}
