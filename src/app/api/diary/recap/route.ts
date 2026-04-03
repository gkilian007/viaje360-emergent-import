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

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const tripId = sp.get("tripId")
    if (!tripId) return errorResponse("VALIDATION_ERROR", "tripId required", 400)

    const supabase = createServiceClient()

    // Load trip
    const { data: trip } = await supabase
      .from("trips")
      .select("id, name, destination, country, start_date, end_date, status, image_url")
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

    // ─── Budget stats ───
    let budgetStats: {
      totalBudget: number
      totalSpent: number
      dailyAvg: number
      topCategory: string
      topCategoryAmount: number
      savedPct: number
    } | null = null

    try {
      const { data: expenses } = await supabase
        .from("trip_expenses")
        .select("amount, category")
        .eq("trip_id", tripId)

      const tripBudget = (trip as Record<string, unknown>).budget as number | null
      if (expenses && expenses.length > 0 && tripBudget && tripBudget > 0) {
        const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0)
        const byCategory: Record<string, number> = {}
        for (const e of expenses) {
          byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount)
        }
        const topEntry = Object.entries(byCategory).sort(([,a],[,b]) => b - a)[0]
        budgetStats = {
          totalBudget: tripBudget,
          totalSpent: Math.round(totalSpent),
          dailyAvg: Math.round(totalSpent / Math.max(days.length, 1)),
          topCategory: topEntry?.[0] ?? "other",
          topCategoryAmount: Math.round(topEntry?.[1] ?? 0),
          savedPct: Math.round(((tripBudget - totalSpent) / tripBudget) * 100),
        }
      }
    } catch { /* budget is optional */ }

    // ─── Highlights: magic moments accepted ───
    let magicMoments: Array<{ name: string; emoji: string; reason: string }> = []
    try {
      const { data: insights } = await supabase
        .from("proactive_insights")
        .select("title, body, trigger")
        .eq("trip_id", tripId)
        .eq("acted_on", true)
        .limit(10)

      if (insights) {
        magicMoments = insights.map(i => ({
          name: i.title?.replace(/^[^\w]+/, "").trim() ?? "",
          emoji: i.title?.match(/^(\p{Emoji})/u)?.[1] ?? "✨",
          reason: i.body ?? "",
        }))
      }
    } catch { /* optional */ }

    // ─── Traveler profile ───
    const allActivities = days.flatMap(d => d.activities)
    const typeCount: Record<string, number> = {}
    for (const a of allActivities) {
      typeCount[a.type] = (typeCount[a.type] ?? 0) + 1
    }
    const sortedTypes = Object.entries(typeCount).sort(([,a],[,b]) => b - a)
    const topType = sortedTypes[0]?.[0] ?? "cultural"

    const TRAVELER_PROFILES: Record<string, { label: string; emoji: string; description: string }> = {
      cultural: { label: "Explorador Cultural", emoji: "🏛️", description: "Priorizaste museos, historia y experiencias culturales" },
      historia: { label: "Viajero del Tiempo", emoji: "🏺", description: "Te apasiona la historia y los sitios emblemáticos" },
      gastronomia: { label: "Foodie Viajero", emoji: "🍽️", description: "Tu viaje giró alrededor de sabores locales" },
      naturaleza: { label: "Amante de la Naturaleza", emoji: "🌿", description: "Buscaste espacios verdes y aire libre" },
      arte: { label: "Alma Artística", emoji: "🎨", description: "Galerías, street art y belleza visual" },
      fotografia: { label: "Cazador de Momentos", emoji: "📸", description: "Cada rincón era una oportunidad de foto" },
      aventura: { label: "Espíritu Aventurero", emoji: "⛰️", description: "Adrenalina y experiencias únicas" },
      playa: { label: "Alma de Playa", emoji: "🏖️", description: "Sol, mar y relax" },
      nocturna: { label: "Noctámbulo", emoji: "🌙", description: "La ciudad cobra vida de noche para ti" },
      shopping: { label: "Cazador de Tesoros", emoji: "🛍️", description: "Mercados, tiendas y souvenirs únicos" },
    }

    const travelerProfile = TRAVELER_PROFILES[topType] ?? TRAVELER_PROFILES.cultural

    // ─── Computed stats ───
    const totalActivities = allActivities.length
    const kmEstimate = Math.round(totalActivities * 1.8)
    const mostIntenseDay = days.reduce((max, d) => d.activities.length > max.activities.length ? d : max, days[0])

    return successResponse({
      trip: {
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        country: trip.country,
        startDate: trip.start_date,
        endDate: trip.end_date,
        status: trip.status,
        imageUrl: (trip as Record<string, unknown>).image_url as string | null ?? null,
      },
      days,
      aiNarrative,
      hasDiaryData: daysWithJournals.length > 0,
      budgetStats,
      magicMoments,
      travelerProfile,
      stats: {
        totalDays: days.length,
        totalActivities,
        kmEstimate,
        diaryEntries: daysWithJournals.length,
        mostIntenseDay: mostIntenseDay ? { dayNumber: mostIntenseDay.dayNumber, count: mostIntenseDay.activities.length } : null,
        topActivityTypes: sortedTypes.slice(0, 3).map(([type, count]) => ({ type, count, emoji: activityEmoji(type) })),
      },
    })
  } catch (error) {
    return normalizeRouteError(error, "Failed to load recap")
  }
}
