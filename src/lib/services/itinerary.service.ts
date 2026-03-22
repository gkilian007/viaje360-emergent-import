import { createServiceClient } from "@/lib/supabase/server"
import type { GeneratedItinerary, DbActivity } from "@/lib/supabase/database.types"
import type { OnboardingData } from "@/lib/onboarding-types"
import type { DayItinerary, TimelineActivity, ActivityType, Trip } from "@/lib/types"

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

// ─── Prompt Builder ────────────────────────────────────────────────────────────

function buildItineraryPrompt(data: OnboardingData): string {
  const startDate = new Date(data.startDate)
  const endDate = new Date(data.endDate)
  const numDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  )

  const famousLocalLabel =
    data.famousLocal < 33 ? "imprescindible (famous spots)" :
    data.famousLocal > 66 ? "autentico (hidden local gems)" :
    "mix (balance of both)"

  const paceLabel =
    data.pace < 33 ? "relajado (few activities, lots of downtime)" :
    data.pace > 66 ? "intenso (many activities, packed days)" :
    "moderado (balanced pace)"

  const wakeHour = Math.round(7 + (data.wakeTime / 100) * 4) // 7am to 11am
  const kidsPets = data.kidsPets.length > 0 ? data.kidsPets.join(", ") : "ninguno"
  const interests = data.interests.length > 0 ? data.interests.join(", ") : "general"
  const dietary = data.dietary.length > 0 ? data.dietary.join(", ") : "ninguna"
  const transport = data.transport.length > 0 ? data.transport.join(", ") : "mix"
  const splurge = data.splurge.length > 0 ? data.splurge.join(", ") : "ninguno"

  return `You are Viaje360, an expert AI travel planner. Generate a detailed day-by-day itinerary in JSON format.

User preferences:
- Destination: ${data.destination}
- Dates: ${data.startDate} to ${data.endDate} (${numDays} days)
- Traveling: ${data.companion ?? "solo"} (${data.groupSize} people)
- Kids/Pets: ${kidsPets}
- Mobility: ${data.mobility ?? "full"}
- Accommodation zone: ${data.accommodationZone || "not specified"}
- Interests: ${interests}
- Traveler style: ${data.travelerStyle ?? "experiencial"}
- Famous vs local: ${famousLocalLabel}
- Pace: ${paceLabel}
- Rest days: ${data.wantsRestDays} (frequency: ${data.restDayFrequency ?? "none"})
- Wake time: ${wakeHour}:00 (${data.wakeTime < 33 ? "early bird" : data.wakeTime > 66 ? "night owl" : "normal"})
- Siesta: ${data.wantsSiesta}
- Budget: ${data.budget ?? "moderado"}
- Splurge on: ${splurge}
- Dietary restrictions: ${dietary}
- Allergies: ${data.allergies || "none"}
- Transport: ${transport}
- Weather adaptation: ${data.weatherAdaptation}
- First time visiting: ${data.firstTime}
- Must see: ${data.mustSee || "not specified"}
- Must avoid: ${data.mustAvoid || "not specified"}
- Already booked: ${data.alreadyBooked || "nothing"}

Rules:
- Group activities by neighborhood to minimize travel
- If kids: add stops every 2h (snacks, playgrounds, ice cream), only restaurants with kids menu, keep activities engaging
- If pets: only pet-friendly venues, add water/shade breaks
- If mobility issues (wheelchair/reduced): accessible routes only, no stairs, elevator access
- If dietary restrictions: only compatible restaurants
- Respect already booked tickets in the schedule at their likely times
- If first time: include main highlights; if returning: focus on hidden gems and local favorites
- Schedule popular attractions at off-peak times (early morning or late afternoon)
- If rest days enabled: insert a free/light day at the specified frequency
- Slow pace = 3-4 activities/day, moderate = 5-6, intense = 7-8
- Start times based on wake style (${wakeHour}:00 first activity)
- If siesta: leave 14:00-16:00 free with no scheduled activities
- Budget economico: free/cheap activities, street food, public transport
- Budget premium: upscale restaurants, private tours, taxis
- For instagrammer style: prioritize photogenic spots, golden hour locations
- For cultural style: museums, historical sites, guided tours

Return ONLY valid JSON with NO markdown, no code fences, no extra text. Use this exact structure:
{
  "tripName": "...",
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "theme": "...",
      "isRestDay": false,
      "activities": [
        {
          "name": "...",
          "type": "restaurant|museum|monument|park|shopping|tour|transport|hotel",
          "location": "Neighborhood name",
          "address": "Full address if known",
          "time": "09:00",
          "endTime": "10:30",
          "duration": 90,
          "cost": 15,
          "notes": "Brief tip or context",
          "icon": "material_symbol_name",
          "indoor": true,
          "weatherDependent": false,
          "kidFriendly": true,
          "petFriendly": false,
          "dietaryTags": ["vegetarian-friendly"]
        }
      ]
    }
  ]
}`
}

// ─── Gemini Call ───────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<GeneratedItinerary> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not set")

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }

  const raw = data.candidates[0]?.content?.parts[0]?.text ?? ""
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()

  return JSON.parse(cleaned) as GeneratedItinerary
}

// ─── Map to App Types ──────────────────────────────────────────────────────────

export function mapToAppTypes(
  itinerary: GeneratedItinerary,
  tripId: string
): { trip: Omit<Trip, "weather">; days: DayItinerary[] } {
  const days: DayItinerary[] = itinerary.days.map((day) => ({
    date: day.date,
    dayNumber: day.dayNumber,
    activities: day.activities.map((act, i): TimelineActivity => ({
      id: `${tripId}-d${day.dayNumber}-a${i}`,
      name: act.name,
      type: (act.type as ActivityType) ?? "tour",
      location: act.location ?? "",
      time: act.time ?? "09:00",
      duration: act.duration ?? 60,
      cost: act.cost ?? 0,
      booked: false,
      notes: act.notes,
      icon: act.icon,
    })),
  }))

  const trip: Omit<Trip, "weather"> = {
    id: tripId,
    name: itinerary.tripName,
    destination: "",
    country: "",
    startDate: itinerary.days[0]?.date ?? "",
    endDate: itinerary.days[itinerary.days.length - 1]?.date ?? "",
    budget: days.reduce((t, d) => t + d.activities.reduce((a, act) => a + act.cost, 0), 0),
    spent: 0,
    status: "active",
  }

  return { trip, days }
}

// ─── Public Service Functions ──────────────────────────────────────────────────

export async function generateItinerary(
  onboardingData: OnboardingData
): Promise<GeneratedItinerary> {
  const prompt = buildItineraryPrompt(onboardingData)
  return callGemini(prompt)
}

export async function getItinerary(tripId: string): Promise<{
  trip: Record<string, unknown>
  days: Array<{ dayNumber: number; date: string; theme: string; activities: DbActivity[] }>
} | null> {
  try {
    const supabase = createServiceClient()

    const { data: trip } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single()

    if (!trip) return null

    const { data: days } = await supabase
      .from("itinerary_days")
      .select("*, activities(*)")
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true })

    return { trip, days: days ?? [] }
  } catch (err) {
    console.error("getItinerary error:", err)
    return null
  }
}

export function mapDbItineraryToAppTypes(
  trip: Record<string, unknown>,
  days: Array<{ dayNumber: number; date: string; theme: string; activities: DbActivity[] }>
): { trip: Trip; days: DayItinerary[] } {
  const mappedDays: DayItinerary[] = days.map((day) => ({
    date: day.date,
    dayNumber: day.dayNumber,
    activities: (day.activities ?? []).map((act): TimelineActivity => ({
      id: act.id,
      name: act.name,
      type: (act.type as ActivityType) ?? "tour",
      location: act.location ?? "",
      time: act.time ?? "09:00",
      duration: act.duration ?? 60,
      cost: act.cost ?? 0,
      booked: act.booked ?? false,
      notes: act.notes ?? undefined,
      icon: act.icon ?? undefined,
    })),
  }))

  const mappedTrip: Trip = {
    id: String(trip.id ?? ""),
    name: String(trip.name ?? "Viaje360 Trip"),
    destination: String(trip.destination ?? ""),
    country: String(trip.country ?? ""),
    startDate: String(trip.start_date ?? ""),
    endDate: String(trip.end_date ?? ""),
    budget: Number(trip.budget ?? 0),
    spent: Number(trip.spent ?? 0),
    status: (trip.status as Trip["status"]) ?? "active",
    currentActivity: typeof trip.current_activity === "string" ? trip.current_activity : undefined,
    weather: trip.weather_temp
      ? {
          temp: Number(trip.weather_temp ?? 0),
          condition: String(trip.weather_condition ?? ""),
          icon: String(trip.weather_icon ?? "partly_cloudy_day"),
          humidity: 0,
          wind: 0,
        }
      : undefined,
  }

  return { trip: mappedTrip, days: mappedDays }
}

export async function adaptItinerary(
  tripId: string,
  reason: string
): Promise<GeneratedItinerary | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return null

    const supabase = createServiceClient()

    // Fetch current trip + itinerary
    const { data: trip } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single()

    if (!trip) return null

    const { data: days } = await supabase
      .from("itinerary_days")
      .select("*, activities(*)")
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true })

    const prompt = `You are Viaje360 AI. The user needs to adapt their trip itinerary for: "${reason}".

Current trip: ${trip.name} to ${trip.destination}
Current schedule: ${JSON.stringify(days, null, 2)}

Suggest modifications to make the itinerary work given the reason above.
Return ONLY valid JSON with the same structure as the original itinerary but with adapted activities.`

    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    })

    if (!res.ok) return null
    const data = await res.json() as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>
    }

    const raw = data.candidates[0]?.content?.parts[0]?.text ?? ""
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()
    return JSON.parse(cleaned) as GeneratedItinerary
  } catch (err) {
    console.error("adaptItinerary error:", err)
    return null
  }
}
