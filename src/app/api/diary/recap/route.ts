import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { normalizeRouteError, successResponse, errorResponse } from "@/lib/api/route-helpers"


const ACTIVITY_TYPE_EMOJI: Record<string, string> = {
  cultural: "🏛️", historia: "🏺", gastronomia: "🍽️", playa: "🏖️",
  nocturna: "🌙", aventura: "⛰️", shopping: "🛍️", fotografia: "📸",
  arte: "🎨", naturaleza: "🌿", familiar: "👨‍👩‍👧‍👦", deportes: "🏃",
  bienestar: "🧘", outdoor: "🌳", default: "📍",
}

function activityEmoji(type: string): string {
  return ACTIVITY_TYPE_EMOJI[type] ?? ACTIVITY_TYPE_EMOJI.default
}

function moodEmoji(mood: string | null): string {
  const map: Record<string, string> = {
    amazing: "🤩", great: "😊", good: "🙂", okay: "😐", tired: "😴", hard: "😤",
  }
  return mood ? (map[mood] ?? "😊") : "😊"
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const tripId = sp.get("tripId")
    if (!tripId) return errorResponse("VALIDATION_ERROR", "tripId required", 400)

    const supabase = createServiceClient()

    // Load trip
    const { data: trip } = await supabase
      .from("trips")
      .select("id, name, destination, country, start_date, end_date, status")
      .eq("id", tripId)
      .single()

    if (!trip) return errorResponse("NOT_FOUND", "Trip not found", 404)

    // Load all day versions (activity snapshots)
    const { data: versions } = await supabase
      .from("trip_itinerary_versions")
      .select("day_number, activities_snapshot")
      .eq("trip_id", tripId)
      .order("day_number")

    // Load all diary journals
    const { data: journals } = await supabase
      .from("trip_day_journals")
      .select("*")
      .eq("trip_id", tripId)
      .order("day_number")

    // Build per-day recap data
    const days = (versions ?? []).map(v => {
      const journal = journals?.find(j => j.day_number === v.day_number) ?? null
      const activities = (v.activities_snapshot as { name: string; type: string; time: string }[]) ?? []
      return {
        dayNumber: v.day_number,
        activities: activities.map(a => ({
          name: a.name,
          type: a.type ?? "cultural",
          emoji: activityEmoji(a.type ?? "cultural"),
          time: a.time,
        })),
        journal: journal
          ? {
              mood: journal.mood,
              moodEmoji: moodEmoji(journal.mood),
              energyScore: journal.energy_score,
              paceScore: journal.pace_score,
              summary: journal.free_text_summary,
              wouldRepeat: journal.would_repeat,
            }
          : null,
      }
    })

    // Generate AI narrative for days that have journals
    let aiNarrative: string | null = null
    const daysWithJournals = days.filter(d => d.journal?.summary)

    if (daysWithJournals.length > 0) {
      try {
        const apiKey = process.env.GEMINI_API_KEY
        if (apiKey) {
          const journalText = daysWithJournals.map(d =>
            `Día ${d.dayNumber}: ${d.journal!.summary} (Energía: ${d.journal!.energyScore}/5, Humor: ${d.journal!.mood})`
          ).join("\n")

          const prompt = `Eres un escritor de viajes. El viajero visitó ${trip.destination}, ${trip.country ?? ""}.
Escribe una narración emotiva y poética del viaje basándote en sus notas de diario (máximo 200 palabras, tono cálido y personal, en español):

${journalText}

La narración debe sonar como si el viajero mismo la contara a un amigo, capturando la esencia del viaje.`

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            }
          )
          if (res.ok) {
            const json = await res.json()
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) aiNarrative = text.trim()
          }
        }
      } catch {
        // narrative is optional — don't fail the recap
      }
    }

    return successResponse({
      trip: {
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        country: trip.country,
        startDate: trip.start_date,
        endDate: trip.end_date,
        status: trip.status,
      },
      days,
      aiNarrative,
      hasDiaryData: daysWithJournals.length > 0,
    })
  } catch (error) {
    return normalizeRouteError(error, "Failed to load recap")
  }
}
