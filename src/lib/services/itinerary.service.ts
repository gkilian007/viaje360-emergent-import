import { requireEnv } from "@/lib/env"
import { createServiceClient } from "@/lib/supabase/server"
import type {
  DbActivity,
  DbOnboardingProfile,
  GeneratedItinerary,
} from "@/lib/supabase/database.types"
import type { OnboardingData } from "@/lib/onboarding-types"
import type { DayItinerary, TimelineActivity, ActivityType, Trip } from "@/lib/types"
import {
  buildRepairHint,
  mapDbDaysToGeneratedItinerary,
  runReliableGenerationPipeline,
} from "@/lib/services/itinerary-reliability"
import {
  createAdaptationEvent,
  createItineraryVersion,
  ensureInitialItineraryVersion,
  replaceTripItinerary,
} from "@/lib/services/trip.service"
import {
  buildPersonalRecommendationBrief,
  getPersonalRecommendationContext,
  type PersonalRecommendationContext,
} from "@/lib/services/personal-recommendation"
import {
  annotateItineraryWithLearningReasons,
  formatLearningContextForPrompt,
  getUserLearningContext,
} from "@/lib/services/recommendation.service"
import type { ItineraryVersionSource } from "@/lib/services/itinerary-versioning"

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

const GEMINI_ITINERARY_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    tripName: { type: "STRING" },
    days: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          dayNumber: { type: "NUMBER" },
          date: { type: "STRING" },
          theme: { type: "STRING" },
          isRestDay: { type: "BOOLEAN" },
          activities: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                type: { type: "STRING" },
                location: { type: "STRING" },
                address: { type: "STRING" },
                time: { type: "STRING" },
                endTime: { type: "STRING" },
                duration: { type: "NUMBER" },
                cost: { type: "NUMBER" },
                pricePerPerson: { type: "NUMBER" },
                url: { type: "STRING" },
                description: { type: "STRING" },
                imageQuery: { type: "STRING" },
                notes: { type: "STRING" },
                icon: { type: "STRING" },
                lat: { type: "NUMBER" },
                lng: { type: "NUMBER" }
              },
              required: ["name", "type", "location", "time", "endTime", "duration", "cost", "pricePerPerson", "url", "description", "imageQuery", "notes", "lat", "lng"]
            }
          }
        },
        required: ["dayNumber", "date", "theme", "isRestDay", "activities"]
      }
    }
  },
  required: ["tripName", "days"]
} as const

function buildItineraryPrompt(
  data: OnboardingData,
  personalization?: PersonalRecommendationContext | null
): string {
  const startDate = new Date(data.startDate)
  const endDate = new Date(data.endDate)
  const numDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  )

  const paceActivities = data.pace < 33 ? "3-4" : data.pace > 66 ? "7-8" : "5-6"
  const wakeHour = Math.round(7 + (data.wakeTime / 100) * 4)

  const personalizationBrief = personalization
    ? buildPersonalRecommendationBrief({
        destination: data.destination,
        preferenceSignals: personalization.preferenceSignals,
        destinationMemory: personalization.destinationMemory,
        destinationKnowledge: personalization.destinationKnowledge,
      })
    : null

  return `Generate a ${numDays}-day travel itinerary for ${data.destination} (${data.startDate} to ${data.endDate}).

Traveler: ${data.companion ?? "solo"}, ${data.groupSize} people. Budget: ${data.budget ?? "moderado"}. Pace: ${paceActivities} activities/day. Start at ${wakeHour}:00.
Interests: ${data.interests.join(", ") || "general"}.${data.wantsSiesta ? " Leave 14:00-16:00 free (siesta)." : ""}${data.firstTime ? " First visit — include highlights." : " Returning — focus on hidden gems."}${data.mustSee ? ` Must see: ${data.mustSee}.` : ""}${data.mustAvoid ? ` Avoid: ${data.mustAvoid}.` : ""}${data.dietary.length > 0 ? ` Dietary: ${data.dietary.join(", ")}.` : ""}
${personalizationBrief ? `\n${personalizationBrief}\n` : ""}
EVERY activity MUST include ALL of these fields (no exceptions):
- name, type (restaurant|museum|monument|park|shopping|tour), location (full address), time (HH:MM), endTime (HH:MM), duration (minutes), cost (entry fee €, 0 if free)
- description: 2 short sentences MAX explaining EXACTLY what to do there in practical terms (what to see, what to order, where to enter, what makes it worth it)
- url: official website, ticket purchase page, or restaurant menu/TripAdvisor link (a real working URL)
- pricePerPerson: average € per person for restaurants (0 for non-restaurants)
- imageQuery: search term for Google Images (e.g. "Real Alcázar Sevilla gardens")
- notes: one practical operational tip (best entrance, what to book, what dish to ask for, what to avoid, how early to arrive)
- lat: latitude of the location (decimal, e.g. 35.6762). MANDATORY — look up the real GPS coordinates. DO NOT omit or leave as 0.
- lng: longitude of the location (decimal, e.g. 139.6503). MANDATORY — look up the real GPS coordinates. DO NOT omit or leave as 0.

CRITICAL: NEVER repeat the same restaurant, museum, monument, or activity on different days. Each activity must appear only ONCE in the entire trip. Every day should have completely different places.

URL RULES (VERY IMPORTANT):
- url MUST be a REAL, VERIFIED, currently working URL. Not made up.
- For museums/monuments: use the OFFICIAL ticket purchase page (e.g. sagradafamilia.org/en/tickets, museupicasso.bcn.cat)
- For restaurants: use their official website, Google Maps link (https://maps.google.com/?q=RESTAURANT+NAME+CITY), or TripAdvisor page
- If you are NOT 100% sure the URL exists, use this format instead: https://www.google.com/maps/search/PLACE+NAME+CITY
- NEVER invent a URL. A Google Maps search link is always better than a fake URL.

LANGUAGE: ALL text content (description, notes, theme, tripName) MUST be in SPANISH (es-ES). Write naturally in Spanish, not translated English.

Make it ACTIONABLE, not generic. Bad: "Visita la catedral." Good: "Entra por la Puerta del Lagarto, ve primero a la nave principal y sube a la Giralda antes de la cola del mediodía."
For restaurants: use REAL names that exist. url = menu page or TripAdvisor link. Mention a signature dish and why it fits the user's dietary needs.
For museums/monuments: url = official ticket page. cost = real entry fee. Say what the user should prioritize inside.

Return ONLY JSON, no comments, no markdown:
{"tripName":"...","days":[{"dayNumber":1,"date":"YYYY-MM-DD","theme":"...","isRestDay":false,"activities":[{"name":"...","type":"...","location":"...","time":"HH:MM","endTime":"HH:MM","duration":90,"cost":0,"pricePerPerson":0,"url":"https://...","description":"...","imageQuery":"...","notes":"...","lat":40.4168,"lng":-3.7038}]}]}`
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

function buildSingleDayPrompt(
  data: OnboardingData,
  date: string,
  dayNumber: number,
  totalDays: number,
  personalization?: PersonalRecommendationContext | null
): string {
  const singleDayData = { ...data, startDate: date, endDate: date }
  return `${buildItineraryPrompt(singleDayData, personalization)}

IMPORTANT: This is ONLY for day ${dayNumber} of ${totalDays} of the full trip.
Return exactly 1 day in the days array.
That day must use date ${date} and dayNumber ${dayNumber}.`
}

function buildAdaptationPrompt(
  trip: Record<string, unknown>,
  onboarding: DbOnboardingProfile | null,
  currentSchedule: GeneratedItinerary,
  reason: string,
  personalization?: PersonalRecommendationContext | null
): string {
  const personalizationBrief = personalization
    ? buildPersonalRecommendationBrief({
        destination: String(trip.destination ?? onboarding?.destination ?? "Trip"),
        preferenceSignals: personalization.preferenceSignals,
        destinationMemory: personalization.destinationMemory,
        destinationKnowledge: personalization.destinationKnowledge,
      })
    : null

  return `You are Viaje360 AI. Adapt this itinerary because: "${reason}".

Trip:
- Name: ${String(trip.name ?? "Viaje360 Trip")}
- Destination: ${String(trip.destination ?? "")}
- Dates: ${String(trip.start_date ?? "")} to ${String(trip.end_date ?? "")}
- Budget: ${String(trip.budget ?? "0")}
- Current schedule: ${JSON.stringify(currentSchedule)}

Traveler constraints:
- Companion: ${String(onboarding?.companion ?? "solo")}
- Group size: ${String(onboarding?.group_size ?? 1)}
- Kids/Pets: ${(onboarding?.kids_pets ?? []).join(", ") || "none"}
- Mobility: ${String(onboarding?.mobility ?? "full")}
- Budget level: ${String(onboarding?.budget_level ?? "moderado")}
- Dietary: ${(onboarding?.dietary_restrictions ?? []).join(", ") || "none"}
- Transport: ${(onboarding?.transport ?? []).join(", ") || "mix"}
- Siesta: ${String(onboarding?.siesta ?? false)}
- Booked tickets: ${String(onboarding?.booked_tickets ?? "none")}
${personalizationBrief ? `
${personalizationBrief}
` : ""}
Hard requirements:
- Return ONLY valid JSON
- Keep the same dates/day count
- Use HH:MM times and YYYY-MM-DD dates
- Avoid overlaps and impossible timing
- Respect booked tickets, locked activities, siesta, budget, mobility, kids/pets
- Prefer minimal, credible changes instead of rewriting everything`
}

async function callGeminiRaw(prompt: string): Promise<string> {
  const apiKey = requireEnv("GEMINI_API_KEY", "Gemini itinerary generation")

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 65536,
        responseMimeType: "application/json",
        responseSchema: GEMINI_ITINERARY_RESPONSE_SCHEMA,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("")?.trim() ?? ""
  if (!raw) {
    throw new Error("Gemini returned empty itinerary payload")
  }

  return raw
}

async function callGeminiWithRepair(prompt: string, reason: string): Promise<string> {
  return callGeminiRaw(`${prompt}\n\n${buildRepairHint(reason)}`)
}

/**
 * Ensure every activity has a usable URL.
 * If Gemini's URL looks suspicious or is empty, generate a Google Maps search link.
 */
function ensureActivityUrl(name: string, location: string, type: string, url?: string): string {
  // If no URL at all, generate one
  if (!url || url.trim().length === 0) {
    return `https://www.google.com/maps/search/${encodeURIComponent(`${name} ${location}`)}`
  }

  // Basic validation: must start with http(s)
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `https://www.google.com/maps/search/${encodeURIComponent(`${name} ${location}`)}`
  }

  // Known bad patterns (Gemini hallucinations)
  const suspiciousPatterns = [
    /example\.com/i,
    /placeholder/i,
    /localhost/i,
    /\.test\//i,
    /fakepage/i,
  ]
  if (suspiciousPatterns.some(p => p.test(url))) {
    return `https://www.google.com/maps/search/${encodeURIComponent(`${name} ${location}`)}`
  }

  return url
}

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
      isLocked: act.isLocked ?? false,
      notes: act.notes,
      description: act.description,
      icon: act.icon,
      url: ensureActivityUrl(act.name, act.location ?? "", act.type, act.url),
      pricePerPerson: act.pricePerPerson,
      imageQuery: act.imageQuery,
      recommendationReason: act.recommendationReason,
      lat: act.lat,
      lng: act.lng,
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

export async function generateItinerary(
  onboardingData: OnboardingData,
  options?: { userId?: string | null; personalization?: PersonalRecommendationContext | null }
): Promise<GeneratedItinerary> {
  const personalization = options?.personalization
  const prompt = buildItineraryPrompt(onboardingData, personalization)
  const raw = await callGeminiRaw(prompt)

  const result = await runReliableGenerationPipeline(
    raw,
    onboardingData,
    {
      mode: "generate",
      maxAttempts: 3,
      onAttempt: async (_attempt, reason) => callGeminiWithRepair(prompt, reason),
      log: (message, meta) => console.warn(`[itinerary/generate] ${message}`, meta ?? {}),
    },
    { startDate: onboardingData.startDate, endDate: onboardingData.endDate },
    onboardingData.destination
  )

  if (result.usedFallback) {
    throw new Error("No se pudo generar un plan detallado real. La IA devolvió un resultado inválido varias veces.")
  }

  if (!result.itinerary.days.length) {
    throw new Error("La IA no devolvió ningún día en el itinerario.")
  }

  // Annotate with learning-based recommendation reasons
  const learningContext = await getUserLearningContext(options?.userId, onboardingData.destination)
  return annotateItineraryWithLearningReasons(
    result.itinerary,
    learningContext
  )
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
  reason: string,
  source: ItineraryVersionSource = "manual",
  startFromDayNumber?: number,
  personalization?: PersonalRecommendationContext | null
): Promise<GeneratedItinerary | null> {
  try {
    const supabase = createServiceClient()

    const { data: trip } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single()

    if (!trip) return null

    const { data: onboarding } = trip.onboarding_id
      ? await supabase
          .from("onboarding_profiles")
          .select("*")
          .eq("id", trip.onboarding_id)
          .single()
      : { data: null }

    const { data: days } = await supabase
      .from("itinerary_days")
      .select("*, activities(*)")
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true })

    const resolvedPersonalization = personalization ?? await getPersonalRecommendationContext({
      userId: (trip.user_id as string | null) ?? null,
      destination: String(trip.destination ?? ""),
      country: (trip.country as string | null) ?? null,
    })

    const currentSchedule = mapDbDaysToGeneratedItinerary(
      (days ?? []) as Array<{ day_number: number; date: string; theme: string | null; is_rest_day: boolean; activities?: DbActivity[] }>,
      String(trip.name ?? "Viaje360 Trip")
    )
    const currentVersion = await ensureInitialItineraryVersion({
      tripId,
      itinerary: currentSchedule,
      createdBy: (trip.user_id as string | null) ?? null,
      reason: "Initial generated itinerary",
      source: "generate",
    })
    const prompt = buildAdaptationPrompt(
      trip as Record<string, unknown>,
      onboarding as DbOnboardingProfile | null,
      currentSchedule,
      reason,
      resolvedPersonalization
    )
    const raw = await callGeminiRaw(prompt)

    const result = await runReliableGenerationPipeline(
      raw,
      (onboarding as DbOnboardingProfile | null) ?? {
        destination: String(trip.destination ?? "Trip"),
        start_date: String(trip.start_date ?? ""),
        end_date: String(trip.end_date ?? ""),
        companion: "solo",
        group_size: 1,
        kids_pets: [],
        mobility: "full",
        interests: [],
        traveler_style: null,
        rest_days: false,
        rest_frequency: null,
        wake_style: 30,
        siesta: false,
        budget_level: "moderado",
        dietary_restrictions: [],
        allergies: null,
        transport: [],
        weather_adaptation: true,
        first_time: true,
        must_see: null,
        must_avoid: null,
        booked_tickets: null,
        id: "fallback-onboarding",
        user_id: trip.user_id as string | null,
        arrival_time: null,
        departure_time: null,
        accommodation_zone: null,
        famous_local: "mix",
        pace: 5,
        splurge_categories: [],
        created_at: new Date().toISOString(),
      },
      {
        mode: "adapt",
        maxAttempts: 3,
        onAttempt: async (_attempt, failureReason) => callGeminiWithRepair(prompt, failureReason),
        log: (message, meta) => console.warn(`[itinerary/adapt] ${message}`, meta ?? {}),
      },
      {
        startDate: String(trip.start_date ?? ""),
        endDate: String(trip.end_date ?? ""),
      },
      String(trip.destination ?? "Trip")
    )

    const nextVersion = await createItineraryVersion({
      tripId,
      itinerary: result.itinerary,
      source,
      reason,
      createdBy: (trip.user_id as string | null) ?? null,
    })

    if (!nextVersion) {
      throw new Error("Failed to create itinerary version")
    }

    const adaptationEvent = await createAdaptationEvent({
      tripId,
      fromVersionId: currentVersion?.id ?? null,
      toVersionId: nextVersion.id,
      reason,
      source,
      metadata: {
        fromVersionNumber: currentVersion?.version_number ?? null,
        toVersionNumber: nextVersion.version_number,
      },
    })

    if (!adaptationEvent) {
      await supabase.from("itinerary_versions").delete().eq("id", nextVersion.id)
      throw new Error("Failed to create adaptation event")
    }

    try {
      await replaceTripItinerary(tripId, result.itinerary)
    } catch (replaceError) {
      await supabase.from("adaptation_events").delete().eq("id", adaptationEvent.id)
      await supabase.from("itinerary_versions").delete().eq("id", nextVersion.id)
      throw replaceError
    }

    return result.itinerary
  } catch (err) {
    console.error("adaptItinerary error:", err)
    return null
  }
}
