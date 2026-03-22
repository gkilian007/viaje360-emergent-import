import { NextRequest, NextResponse } from "next/server"
import { generateChatResponse } from "@/lib/gemini"
import { addChatMessage, getChatHistory } from "@/lib/services/trip.service"
import { createServiceClient } from "@/lib/supabase/server"

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      message: string
      history?: Array<{ role: "user" | "model"; text: string }>
      tripId?: string
    }

    const { message, tripId } = body
    let { history = [] } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 })
    }

    // If tripId provided, build richer context from Supabase
    let systemContext = ""
    if (tripId) {
      try {
        const supabase = createServiceClient()

        // Fetch trip details
        const { data: trip } = await supabase
          .from("trips")
          .select("*")
          .eq("id", tripId)
          .single()

        // Fetch onboarding preferences
        const { data: onboarding } = trip
          ? await supabase
              .from("onboarding_profiles")
              .select("*")
              .eq("id", trip.onboarding_id)
              .single()
          : { data: null }

        if (trip) {
          systemContext = `
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
` : ""}`
        }

        // Load recent chat history from Supabase if no history provided
        if (history.length === 0) {
          const savedMessages = await getChatHistory(tripId)
          history = savedMessages.map((m) => ({
            role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
            text: m.content,
          }))
        }
      } catch (ctxErr) {
        console.warn("Could not load trip context:", ctxErr)
      }
    }

    const response = await generateChatResponse(history, message, systemContext)

    // Save messages to Supabase if tripId provided
    if (tripId) {
      try {
        await addChatMessage(tripId, DEMO_USER_ID, "user", message)
        await addChatMessage(tripId, DEMO_USER_ID, "assistant", response)
      } catch (saveErr) {
        console.warn("Could not save chat messages:", saveErr)
      }
    }

    return NextResponse.json({ response })
  } catch (err) {
    console.error("Chat API error:", err)
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    )
  }
}
