import { generatedActivitySchema, generatedItinerarySchema } from "@/lib/api/contracts"
import type { OnboardingData } from "@/lib/onboarding-types"
import type {
  DbActivity,
  DbItineraryDay,
  DbOnboardingProfile,
  GeneratedActivity,
  GeneratedDay,
  GeneratedItinerary,
} from "@/lib/supabase/database.types"
import type { ActivityType } from "@/lib/types"

type RuleWarningCode =
  | "json_extract_failed"
  | "schema_repaired"
  | "invalid_activity_removed"
  | "overlap_repaired"
  | "siesta_repaired"
  | "booked_ticket_inserted"
  | "booked_ticket_retimed"
  | "budget_adjusted"
  | "constraint_replaced"

type GenerationMode = "generate" | "adapt"

export interface ItineraryRuleWarning {
  code: RuleWarningCode
  message: string
}

export interface ItineraryValidationResult {
  itinerary: GeneratedItinerary
  warnings: ItineraryRuleWarning[]
}

export interface ReliableGenerationResult extends ItineraryValidationResult {
  usedFallback: boolean
  attempts: number
  failureReasons: string[]
}

export interface RetryPipelineOptions {
  mode: GenerationMode
  maxAttempts?: number
  onAttempt?: (attempt: number, reason: string) => Promise<string>
  log?: (message: string, meta?: Record<string, unknown>) => void
}

const ACTIVITY_TYPES: ActivityType[] = [
  "museum",
  "restaurant",
  "monument",
  "park",
  "shopping",
  "tour",
  "hotel",
  "transport",
]

const PET_OPTIONS = new Set(["perro-pequeno", "perro-grande", "otro-animal"])
const KID_OPTIONS = new Set(["bebe", "ninos", "pre-adolescentes"])
const ACCESSIBILITY_RISK_REGEX = /stairs?|climb|hike|steep|summit|trail|ladder|cobblestone|crawl|mirador|bunker|fortress/i
const KID_RISK_REGEX = /bar|club|cocktail|nightlife|pub|wine|speakeasy|casino|strip/i
const PET_RISK_REGEX = /museum|cathedral|theatre|theater|opera|fine dining|gallery/i
const BUDGET_RISK_REGEX = /michelin|luxury|private|exclusive|vip|degustation|tasting menu/i
const BOOKED_HINT_REGEX = /booked|ticket|reservation|entrada|reserv/i

const DEFAULT_ICON_BY_TYPE: Record<ActivityType, string> = {
  museum: "museum",
  restaurant: "restaurant",
  monument: "fort",
  park: "park",
  shopping: "shopping_bag",
  tour: "map",
  hotel: "hotel",
  transport: "directions_transit",
}

const BUDGET_MAX_BY_LEVEL = {
  economico: { perActivity: 35, perDay: 120 },
  moderado: { perActivity: 120, perDay: 280 },
  premium: { perActivity: 400, perDay: 900 },
} as const

interface NormalizedGenerationContext {
  destination: string
  startDate: string
  endDate: string
  companion: string | null
  groupSize: number
  kidsPets: string[]
  mobility: string | null
  accommodationZone: string
  interests: string[]
  travelerStyle: string | null
  wantsRestDays: boolean
  restDayFrequency: string | null
  wakeTime: number
  wantsSiesta: boolean
  budget: "economico" | "moderado" | "premium"
  dietary: string[]
  allergies: string
  transport: string[]
  weatherAdaptation: boolean
  firstTime: boolean | null
  mustSee: string
  mustAvoid: string
  alreadyBooked: string
}

interface ParsedBookedTicket {
  title: string
  date?: string
  time?: string
  duration: number
}

function isActivityType(value: string): value is ActivityType {
  return ACTIVITY_TYPES.includes(value as ActivityType)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeWhitespace(value: string | null | undefined): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "yes", "1", "si", "sí"].includes(normalized)) return true
    if (["false", "no", "0"].includes(normalized)) return false
  }
  return fallback
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.,-]/g, "").replace(",", ".")
    const parsed = Number(normalized)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function minutesToTime(totalMinutes: number): string {
  const safe = ((totalMinutes % 1440) + 1440) % 1440
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function timeToMinutes(value: string | undefined, fallback = 9 * 60): number {
  if (!value) return fallback
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return fallback
  return hours * 60 + minutes
}

function normalizeTime(value: unknown, fallbackMinutes: number): string {
  if (typeof value === "string") {
    const trimmed = value.trim()
    const hhmm = trimmed.match(/^(\d{1,2}):(\d{2})$/)
    if (hhmm) {
      const hours = clamp(Number(hhmm[1]), 0, 23)
      const minutes = clamp(Number(hhmm[2]), 0, 59)
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
    }

    const ampm = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
    if (ampm) {
      let hours = Number(ampm[1]) % 12
      if (ampm[3].toLowerCase() === "pm") hours += 12
      const minutes = Number(ampm[2] ?? 0)
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
    }
  }

  return minutesToTime(fallbackMinutes)
}

function addMinutes(time: string, duration: number): string {
  return minutesToTime(timeToMinutes(time) + duration)
}

function normalizeDate(value: unknown, fallbackDate: string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim()
  }
  return fallbackDate
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [startDate]
  }

  const dates: string[] = []
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10))
  }
  return dates.length > 0 ? dates : [startDate]
}

function normalizeActivityType(value: unknown): ActivityType {
  const normalized = normalizeWhitespace(String(value ?? "")).toLowerCase()
  if (isActivityType(normalized)) return normalized

  if (/cafe|food|brunch|lunch|dinner|breakfast|restaurant/.test(normalized)) return "restaurant"
  if (/museum|gallery|exhibit/.test(normalized)) return "museum"
  if (/park|garden|playground/.test(normalized)) return "park"
  if (/taxi|bus|train|metro|transport/.test(normalized)) return "transport"
  if (/hotel|check-in|check out|hostel|apartment/.test(normalized)) return "hotel"
  if (/shop|market|mall/.test(normalized)) return "shopping"
  if (/monument|cathedral|church|basilica|tower|castle/.test(normalized)) return "monument"
  return "tour"
}

function extractJsonObject(raw: string): string {
  // Strip markdown fences
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found in model output")
  }
  let json = cleaned.slice(firstBrace, lastBrace + 1)
  // Fix trailing commas before ] or } (common Gemini issue)
  json = json.replace(/,\s*([}\]])/g, "$1")
  return json
}

export function buildRepairHint(reason: string): string {
  return `The previous itinerary response was rejected: ${reason}. Return ONLY valid JSON matching the required schema. Ensure every day has valid YYYY-MM-DD date, activities use HH:MM times, duration is a positive integer in minutes, endTime is after time, and avoid overlaps. Respect booked tickets, siesta, budget, mobility, kids/pets, and basic feasibility.`
}

export function normalizeGenerationContext(
  source: OnboardingData | DbOnboardingProfile,
  tripDates?: { startDate?: string | null; endDate?: string | null },
  destinationFallback = "Trip"
): NormalizedGenerationContext {
  const onboarding = source as Partial<OnboardingData & DbOnboardingProfile>

  return {
    destination: normalizeWhitespace(String(onboarding.destination ?? destinationFallback)) || destinationFallback,
    startDate: String(onboarding.startDate ?? onboarding.start_date ?? tripDates?.startDate ?? new Date().toISOString().slice(0, 10)),
    endDate: String(onboarding.endDate ?? onboarding.end_date ?? tripDates?.endDate ?? tripDates?.startDate ?? new Date().toISOString().slice(0, 10)),
    companion: (onboarding.companion as string | null | undefined) ?? null,
    groupSize: Number(onboarding.groupSize ?? onboarding.group_size ?? 1) || 1,
    kidsPets: ((onboarding.kidsPets ?? onboarding.kids_pets ?? []) as string[]).filter(Boolean),
    mobility: (onboarding.mobility as string | null | undefined) ?? null,
    accommodationZone: normalizeWhitespace(String(onboarding.accommodationZone ?? onboarding.accommodation_zone ?? "")),
    interests: ((onboarding.interests ?? []) as string[]).filter(Boolean),
    travelerStyle: (onboarding.travelerStyle ?? onboarding.traveler_style ?? null) as string | null,
    wantsRestDays: Boolean(onboarding.wantsRestDays ?? onboarding.rest_days ?? false),
    restDayFrequency: (onboarding.restDayFrequency ?? onboarding.rest_frequency ?? null) as string | null,
    wakeTime: Number(onboarding.wakeTime ?? onboarding.wake_style ?? 30) || 30,
    wantsSiesta: Boolean(onboarding.wantsSiesta ?? onboarding.siesta ?? false),
    budget: ((onboarding.budget ?? onboarding.budget_level ?? "moderado") as "economico" | "moderado" | "premium") ?? "moderado",
    dietary: ((onboarding.dietary ?? onboarding.dietary_restrictions ?? []) as string[]).filter(Boolean),
    allergies: normalizeWhitespace(String(onboarding.allergies ?? "")),
    transport: ((onboarding.transport ?? []) as string[]).filter(Boolean),
    weatherAdaptation: Boolean(onboarding.weatherAdaptation ?? onboarding.weather_adaptation ?? true),
    firstTime: (onboarding.firstTime ?? onboarding.first_time ?? null) as boolean | null,
    mustSee: normalizeWhitespace(String(onboarding.mustSee ?? onboarding.must_see ?? "")),
    mustAvoid: normalizeWhitespace(String(onboarding.mustAvoid ?? onboarding.must_avoid ?? "")),
    alreadyBooked: normalizeWhitespace(String(onboarding.alreadyBooked ?? onboarding.booked_tickets ?? "")),
  }
}

function normalizeActivity(
  raw: Partial<GeneratedActivity>,
  fallbackStartMinutes: number,
  context: NormalizedGenerationContext,
  warnings: ItineraryRuleWarning[]
): GeneratedActivity | null {
  const name = normalizeWhitespace(raw.name)
  if (!name) {
    warnings.push({ code: "invalid_activity_removed", message: "Removed activity without a name" })
    return null
  }

  const type = normalizeActivityType(raw.type ?? raw.name)
  const time = normalizeTime(raw.time, fallbackStartMinutes)
  const duration = clamp(Math.round(parseNumber(raw.duration, raw.endTime ? timeToMinutes(String(raw.endTime)) - timeToMinutes(time) : 90)), 30, 300)
  const endTime = normalizeTime(raw.endTime, timeToMinutes(time) + duration)
  const location = normalizeWhitespace(raw.location) || context.destination
  const cost = Math.max(0, Math.round(parseNumber(raw.cost, 0)))
  const activity: GeneratedActivity = {
    name,
    type,
    location,
    address: normalizeWhitespace(raw.address) || undefined,
    time,
    endTime: timeToMinutes(endTime) <= timeToMinutes(time) ? addMinutes(time, duration) : endTime,
    duration,
    cost,
    notes: normalizeWhitespace(raw.notes) || undefined,
    icon: normalizeWhitespace(raw.icon) || DEFAULT_ICON_BY_TYPE[type],
    indoor: toBoolean(raw.indoor, type === "museum" || type === "restaurant" || type === "hotel"),
    weatherDependent: toBoolean(raw.weatherDependent, type === "park"),
    kidFriendly: toBoolean(raw.kidFriendly, context.kidsPets.some((entry) => KID_OPTIONS.has(entry))),
    petFriendly: toBoolean(raw.petFriendly, context.kidsPets.some((entry) => PET_OPTIONS.has(entry)) && type === "park"),
    dietaryTags: Array.isArray(raw.dietaryTags)
      ? raw.dietaryTags.map((tag) => normalizeWhitespace(String(tag))).filter(Boolean)
      : [],
  }

  if (!generatedActivitySchema.safeParse(activity).success) {
    warnings.push({ code: "schema_repaired", message: `Repaired malformed activity: ${name}` })
  }

  return activity
}

function normalizeDay(
  raw: Partial<GeneratedDay>,
  index: number,
  dates: string[],
  context: NormalizedGenerationContext,
  warnings: ItineraryRuleWarning[]
): GeneratedDay {
  const fallbackDate = dates[index] ?? dates[dates.length - 1]
  const firstActivityMinutes = clamp(Math.round(7 * 60 + (context.wakeTime / 100) * 240), 7 * 60, 11 * 60)
  const activitiesInput = Array.isArray(raw.activities) ? raw.activities : []
  const activities = activitiesInput
    .map((activity, activityIndex) => normalizeActivity(activity, firstActivityMinutes + activityIndex * 120, context, warnings))
    .filter((activity): activity is GeneratedActivity => Boolean(activity))
    .sort((left, right) => timeToMinutes(left.time) - timeToMinutes(right.time))

  return {
    dayNumber: Math.max(1, Math.round(parseNumber(raw.dayNumber, index + 1))),
    date: normalizeDate(raw.date, fallbackDate),
    theme: normalizeWhitespace(raw.theme) || `Day ${index + 1} in ${context.destination}`,
    isRestDay: toBoolean(raw.isRestDay, false),
    activities,
  }
}

function normalizeItinerary(itinerary: Partial<GeneratedItinerary>, context: NormalizedGenerationContext): ItineraryValidationResult {
  const warnings: ItineraryRuleWarning[] = []
  const dates = enumerateDates(context.startDate, context.endDate)
  const rawDays = Array.isArray(itinerary.days) ? itinerary.days : []
  const normalizedDays = (rawDays.length > 0 ? rawDays : dates.map((date, index) => ({ dayNumber: index + 1, date, activities: [] })))
    .slice(0, dates.length)
    .map((day, index) => normalizeDay(day, index, dates, context, warnings))

  while (normalizedDays.length < dates.length) {
    normalizedDays.push(normalizeDay({ dayNumber: normalizedDays.length + 1, date: dates[normalizedDays.length], activities: [] }, normalizedDays.length, dates, context, warnings))
  }

  const normalized: GeneratedItinerary = {
    tripName: normalizeWhitespace(itinerary.tripName) || `${context.destination} Adventure`,
    days: normalizedDays.map((day, index) => ({
      ...day,
      dayNumber: index + 1,
      date: dates[index] ?? day.date,
    })),
  }

  return applyRuleChecks(normalized, context, warnings)
}

function hasKids(context: NormalizedGenerationContext): boolean {
  return context.kidsPets.some((entry) => KID_OPTIONS.has(entry))
}

function hasPets(context: NormalizedGenerationContext): boolean {
  return context.kidsPets.some((entry) => PET_OPTIONS.has(entry))
}

function hasMobilityConstraints(context: NormalizedGenerationContext): boolean {
  return ["moderate", "frequent-rest", "wheelchair", "reduced"].includes(context.mobility ?? "")
}

function parseBookedTickets(input: string): ParsedBookedTicket[] {
  const normalized = input
    .split(/\n|;|\|/)
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean)

  return normalized.map((entry) => {
    const date = entry.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]
    const time = entry.match(/\b(\d{1,2}:\d{2})\b/)?.[1]
    const title = normalizeWhitespace(
      entry
        .replace(/\b(20\d{2}-\d{2}-\d{2})\b/, "")
        .replace(/\b(\d{1,2}:\d{2})\b/, "")
        .replace(/^(booked|ticket|tickets|reservation|entrada)\s*:?/i, "")
        .replace(/\bat\b/gi, "")
    )

    return {
      title: title || "Booked activity",
      date,
      time,
      duration: 90,
    }
  })
}

function insertOrRetimeBookedTickets(
  days: GeneratedDay[],
  context: NormalizedGenerationContext,
  warnings: ItineraryRuleWarning[]
): GeneratedDay[] {
  const tickets = parseBookedTickets(context.alreadyBooked)
  if (tickets.length === 0) return days

  return days.map((day, index) => {
    const dayTickets = tickets.filter((ticket) => !ticket.date || ticket.date === day.date || (!ticket.date && index === 0))
    if (dayTickets.length === 0) return day

    const activities = [...day.activities]

    for (const ticket of dayTickets) {
      const normalizedTime = ticket.time ? normalizeTime(ticket.time, timeToMinutes(day.activities[0]?.time, 10 * 60)) : undefined
      const existingIndex = activities.findIndex((activity) => activity.name.toLowerCase().includes(ticket.title.toLowerCase()) || ticket.title.toLowerCase().includes(activity.name.toLowerCase()))

      if (existingIndex >= 0) {
        if (normalizedTime && activities[existingIndex].time !== normalizedTime) {
          activities[existingIndex] = {
            ...activities[existingIndex],
            time: normalizedTime,
            endTime: addMinutes(normalizedTime, activities[existingIndex].duration),
            notes: [activities[existingIndex].notes, "Booked ticket preserved"].filter(Boolean).join(" · "),
          }
          warnings.push({ code: "booked_ticket_retimed", message: `Retimed booked activity '${activities[existingIndex].name}' to ${normalizedTime}` })
        }
        continue
      }

      const fallbackTime = normalizedTime ?? minutesToTime(11 * 60 + dayTickets.indexOf(ticket) * 120)
      activities.push({
        name: ticket.title,
        type: "tour",
        location: context.destination,
        time: fallbackTime,
        endTime: addMinutes(fallbackTime, ticket.duration),
        duration: ticket.duration,
        cost: 0,
        notes: "Booked ticket inserted by validation layer",
        icon: DEFAULT_ICON_BY_TYPE.tour,
        indoor: false,
        weatherDependent: false,
        kidFriendly: hasKids(context),
        petFriendly: false,
        dietaryTags: [],
      })
      warnings.push({ code: "booked_ticket_inserted", message: `Inserted booked activity '${ticket.title}'` })
    }

    return {
      ...day,
      activities: activities.sort((left, right) => timeToMinutes(left.time) - timeToMinutes(right.time)),
    }
  })
}

function applySiestaWindow(day: GeneratedDay, context: NormalizedGenerationContext, warnings: ItineraryRuleWarning[]): GeneratedDay {
  if (!context.wantsSiesta) return day

  const siestaStart = 14 * 60
  const siestaEnd = 16 * 60
  let shifted = false
  const repaired = day.activities.map((activity) => {
    const start = timeToMinutes(activity.time)
    const end = timeToMinutes(activity.endTime, start + activity.duration)
    if (start < siestaEnd && end > siestaStart) {
      shifted = true
      const nextStart = Math.max(siestaEnd, end <= siestaEnd ? siestaEnd : start + (siestaEnd - siestaStart))
      return {
        ...activity,
        time: minutesToTime(nextStart),
        endTime: minutesToTime(nextStart + activity.duration),
        notes: [activity.notes, "Shifted to preserve siesta window 14:00-16:00"].filter(Boolean).join(" · "),
      }
    }
    return activity
  })

  if (shifted) {
    warnings.push({ code: "siesta_repaired", message: `Adjusted activities on ${day.date} to preserve siesta window` })
  }

  return {
    ...day,
    activities: repaired.sort((left, right) => timeToMinutes(left.time) - timeToMinutes(right.time)),
  }
}

function applyOverlapRepair(day: GeneratedDay, warnings: ItineraryRuleWarning[]): GeneratedDay {
  let lastEnd = 0
  let changed = false

  const repaired = day.activities
    .sort((left, right) => timeToMinutes(left.time) - timeToMinutes(right.time))
    .map((activity) => {
      const start = timeToMinutes(activity.time)
      const proposedStart = Math.max(start, lastEnd === 0 ? start : lastEnd + 15)
      const next = {
        ...activity,
        time: minutesToTime(proposedStart),
        endTime: minutesToTime(proposedStart + activity.duration),
      }
      if (proposedStart !== start) {
        changed = true
      }
      lastEnd = timeToMinutes(next.endTime)
      return next
    })

  if (changed) {
    warnings.push({ code: "overlap_repaired", message: `Adjusted overlapping activities on ${day.date}` })
  }

  return { ...day, activities: repaired }
}

function applyBudgetSanity(day: GeneratedDay, context: NormalizedGenerationContext, warnings: ItineraryRuleWarning[]): GeneratedDay {
  const budgetLimits = BUDGET_MAX_BY_LEVEL[context.budget] ?? BUDGET_MAX_BY_LEVEL.moderado
  let total = 0
  let changed = false

  const adjusted = day.activities.map((activity) => {
    const maxCost = activity.type === "restaurant" ? Math.round(budgetLimits.perActivity * 0.8) : budgetLimits.perActivity
    const nextCost = Math.min(activity.cost, maxCost)
    if (nextCost !== activity.cost || (context.budget !== "premium" && BUDGET_RISK_REGEX.test(`${activity.name} ${activity.notes ?? ""}`))) {
      changed = true
    }
    const sanitizedCost = context.budget !== "premium" && BUDGET_RISK_REGEX.test(`${activity.name} ${activity.notes ?? ""}`)
      ? Math.min(nextCost, Math.round(maxCost * 0.75))
      : nextCost
    total += sanitizedCost
    return {
      ...activity,
      cost: sanitizedCost,
    }
  })

  if (total > budgetLimits.perDay) {
    changed = true
    let overflow = total - budgetLimits.perDay
    for (let index = adjusted.length - 1; index >= 0 && overflow > 0; index -= 1) {
      const activity = adjusted[index]
      if (BOOKED_HINT_REGEX.test(`${activity.name} ${activity.notes ?? ""}`)) continue
      const minimumCost = activity.type === "restaurant" ? 8 : 0
      const reducible = Math.max(0, activity.cost - minimumCost)
      const reduction = Math.min(reducible, overflow)
      adjusted[index] = {
        ...activity,
        cost: activity.cost - reduction,
        notes: [activity.notes, "Budget-normalized estimate"].filter(Boolean).join(" · "),
      }
      overflow -= reduction
    }
  }

  if (changed) {
    warnings.push({ code: "budget_adjusted", message: `Adjusted costs on ${day.date} for ${context.budget} budget sanity` })
  }

  return { ...day, activities: adjusted }
}

function createConstraintFriendlyReplacement(activity: GeneratedActivity, context: NormalizedGenerationContext): GeneratedActivity {
  const start = activity.time
  const duration = clamp(activity.duration, 45, 120)
  const isPetCase = hasPets(context)

  if (isPetCase) {
    return {
      name: "Pet-friendly park break",
      type: "park",
      location: activity.location || context.destination,
      time: start,
      endTime: addMinutes(start, duration),
      duration,
      cost: Math.min(activity.cost, 10),
      notes: "Auto-replaced to keep the plan pet-friendly",
      icon: DEFAULT_ICON_BY_TYPE.park,
      indoor: false,
      weatherDependent: true,
      kidFriendly: hasKids(context),
      petFriendly: true,
      dietaryTags: [],
    }
  }

  return {
    name: "Accessible low-effort stop",
    type: "tour",
    location: activity.location || context.destination,
    time: start,
    endTime: addMinutes(start, duration),
    duration,
    cost: Math.min(activity.cost, 20),
    notes: "Auto-replaced to respect mobility/family constraints",
    icon: DEFAULT_ICON_BY_TYPE.tour,
    indoor: true,
    weatherDependent: false,
    kidFriendly: true,
    petFriendly: false,
    dietaryTags: [],
  }
}

function applyConstraintChecks(day: GeneratedDay, context: NormalizedGenerationContext, warnings: ItineraryRuleWarning[]): GeneratedDay {
  const kids = hasKids(context)
  const pets = hasPets(context)
  const mobility = hasMobilityConstraints(context)

  const repaired = day.activities.map((activity) => {
    const haystack = `${activity.name} ${activity.notes ?? ""} ${activity.location}`

    if (mobility && ACCESSIBILITY_RISK_REGEX.test(haystack)) {
      warnings.push({ code: "constraint_replaced", message: `Replaced mobility-risk activity '${activity.name}'` })
      return createConstraintFriendlyReplacement(activity, context)
    }

    if (kids && KID_RISK_REGEX.test(haystack)) {
      warnings.push({ code: "constraint_replaced", message: `Replaced kid-unfriendly activity '${activity.name}'` })
      return {
        ...createConstraintFriendlyReplacement(activity, context),
        name: "Family-friendly break",
        kidFriendly: true,
        petFriendly: false,
      }
    }

    if (pets && !activity.petFriendly && PET_RISK_REGEX.test(haystack)) {
      warnings.push({ code: "constraint_replaced", message: `Replaced pet-unfriendly activity '${activity.name}'` })
      return createConstraintFriendlyReplacement(activity, context)
    }

    if (kids) {
      return { ...activity, kidFriendly: true }
    }
    if (pets && activity.type === "park") {
      return { ...activity, petFriendly: true }
    }
    return activity
  })

  return { ...day, activities: repaired }
}

export function applyRuleChecks(
  itinerary: GeneratedItinerary,
  context: NormalizedGenerationContext,
  seedWarnings: ItineraryRuleWarning[] = []
): ItineraryValidationResult {
  const warnings = [...seedWarnings]
  const withTickets = insertOrRetimeBookedTickets(itinerary.days, context, warnings)

  const days = withTickets.map((day) => {
    const constrained = applyConstraintChecks(day, context, warnings)
    const siestaSafe = applySiestaWindow(constrained, context, warnings)
    const overlapSafe = applyOverlapRepair(siestaSafe, warnings)
    return applyBudgetSanity(overlapSafe, context, warnings)
  })

  const validated = generatedItinerarySchema.parse({
    tripName: itinerary.tripName,
    days,
  })

  return {
    itinerary: validated,
    warnings,
  }
}

export function validateAndRepairItinerary(
  raw: string,
  context: OnboardingData | DbOnboardingProfile,
  tripDates?: { startDate?: string | null; endDate?: string | null },
  destinationFallback?: string
): ItineraryValidationResult {
  const normalizedContext = normalizeGenerationContext(context, tripDates, destinationFallback)
  const extracted = extractJsonObject(raw)
  const parsed = JSON.parse(extracted) as Partial<GeneratedItinerary>
  return normalizeItinerary(parsed, normalizedContext)
}

export function buildFallbackItinerary(
  source: OnboardingData | DbOnboardingProfile,
  tripDates?: { startDate?: string | null; endDate?: string | null },
  destinationFallback?: string
): ItineraryValidationResult {
  const context = normalizeGenerationContext(source, tripDates, destinationFallback)
  const dates = enumerateDates(context.startDate, context.endDate)
  const wakeMinutes = clamp(Math.round(7 * 60 + (context.wakeTime / 100) * 240), 7 * 60, 11 * 60)
  const hasSiesta = context.wantsSiesta
  const budgetLimit = BUDGET_MAX_BY_LEVEL[context.budget] ?? BUDGET_MAX_BY_LEVEL.moderado

  const days: GeneratedDay[] = dates.map((date, index) => {
    const baseActivities: GeneratedActivity[] = [
      {
        name: `Orientation walk in ${context.destination}`,
        type: "tour",
        location: context.accommodationZone || context.destination,
        time: minutesToTime(wakeMinutes),
        endTime: minutesToTime(wakeMinutes + 90),
        duration: 90,
        cost: context.budget === "premium" ? 25 : 0,
        notes: "Minimal fallback itinerary generated after model validation failures",
        icon: DEFAULT_ICON_BY_TYPE.tour,
        indoor: false,
        weatherDependent: false,
        kidFriendly: hasKids(context),
        petFriendly: hasPets(context),
        dietaryTags: [],
      },
      {
        name: hasKids(context) ? "Family-friendly lunch" : "Flexible local lunch",
        type: "restaurant",
        location: context.accommodationZone || context.destination,
        time: hasSiesta ? "13:00" : minutesToTime(wakeMinutes + 180),
        endTime: hasSiesta ? "14:00" : minutesToTime(wakeMinutes + 240),
        duration: 60,
        cost: Math.min(18, budgetLimit.perActivity),
        notes: "Safe fallback meal slot",
        icon: DEFAULT_ICON_BY_TYPE.restaurant,
        indoor: true,
        weatherDependent: false,
        kidFriendly: hasKids(context),
        petFriendly: hasPets(context) ? true : false,
        dietaryTags: context.dietary,
      },
      {
        name: hasPets(context) ? "Pet-friendly sunset park" : "Flexible highlight slot",
        type: hasPets(context) ? "park" : "tour",
        location: context.destination,
        time: hasSiesta ? "16:30" : minutesToTime(wakeMinutes + 360),
        endTime: hasSiesta ? "18:00" : minutesToTime(wakeMinutes + 450),
        duration: hasSiesta ? 90 : 90,
        cost: context.budget === "premium" ? 30 : 10,
        notes: "Can be replaced once richer recommendations are available",
        icon: hasPets(context) ? DEFAULT_ICON_BY_TYPE.park : DEFAULT_ICON_BY_TYPE.tour,
        indoor: false,
        weatherDependent: true,
        kidFriendly: hasKids(context),
        petFriendly: hasPets(context),
        dietaryTags: [],
      },
    ]

    return {
      dayNumber: index + 1,
      date,
      theme: `Reliable fallback day ${index + 1}`,
      isRestDay: Boolean(context.wantsRestDays && context.restDayFrequency === "cada-2" && (index + 1) % 2 === 0),
      activities: baseActivities,
    }
  })

  return applyRuleChecks(
    {
      tripName: `${context.destination} Essentials`,
      days,
    },
    context,
    [{ code: "json_extract_failed", message: "Generated fallback itinerary after repeated validation failures" }]
  )
}

export async function runReliableGenerationPipeline(
  initialRaw: string,
  context: OnboardingData | DbOnboardingProfile,
  options: RetryPipelineOptions,
  tripDates?: { startDate?: string | null; endDate?: string | null },
  destinationFallback?: string
): Promise<ReliableGenerationResult> {
  const maxAttempts = options.maxAttempts ?? 3
  const failures: string[] = []
  let raw = initialRaw

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = validateAndRepairItinerary(raw, context, tripDates, destinationFallback)
      if (attempt > 1) {
        options.log?.("Itinerary generation recovered after retry", { attempt, warnings: result.warnings.length, mode: options.mode })
      }
      return {
        ...result,
        usedFallback: false,
        attempts: attempt,
        failureReasons: failures,
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown itinerary validation error"
      failures.push(reason)
      options.log?.("Itinerary generation validation failed", { attempt, reason, mode: options.mode })

      if (attempt < maxAttempts && options.onAttempt) {
        raw = await options.onAttempt(attempt + 1, reason)
        continue
      }
    }
  }

  options.log?.("Using fallback itinerary after repeated validation failures", {
    mode: options.mode,
    failures,
  })

  const fallback = buildFallbackItinerary(context, tripDates, destinationFallback)
  return {
    ...fallback,
    usedFallback: true,
    attempts: maxAttempts,
    failureReasons: failures,
  }
}

export function mapDbDaysToGeneratedItinerary(
  days: Array<Pick<DbItineraryDay, "day_number" | "date" | "theme" | "is_rest_day"> & { activities?: DbActivity[] }>,
  tripName: string
): GeneratedItinerary {
  return {
    tripName,
    days: days.map((day) => ({
      dayNumber: day.day_number,
      date: day.date,
      theme: day.theme ?? `Day ${day.day_number}`,
      isRestDay: day.is_rest_day,
      activities: (day.activities ?? []).map((activity) => ({
        name: activity.name,
        type: normalizeActivityType(activity.type),
        location: activity.location ?? "",
        address: activity.address ?? undefined,
        time: activity.time ?? "09:00",
        endTime: activity.end_time ?? addMinutes(activity.time ?? "09:00", activity.duration ?? 60),
        duration: activity.duration ?? 60,
        cost: activity.cost ?? 0,
        notes: activity.notes ?? undefined,
        icon: activity.icon ?? undefined,
        indoor: activity.indoor ?? false,
        weatherDependent: activity.weather_dependent ?? false,
        kidFriendly: activity.kid_friendly ?? false,
        petFriendly: activity.pet_friendly ?? false,
        dietaryTags: activity.dietary_tags ?? [],
      })),
    })),
  }
}
