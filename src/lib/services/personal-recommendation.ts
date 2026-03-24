import type {
  DbActivityKnowledge,
  DbUserDestinationMemory,
  DbUserPreferenceSignal,
  GeneratedActivity,
} from "@/lib/supabase/database.types"
import { createServiceClient } from "@/lib/supabase/server"

export interface PersonalRecommendationContext {
  preferenceSignals: DbUserPreferenceSignal[]
  destinationMemory: DbUserDestinationMemory | null
  destinationKnowledge: DbActivityKnowledge[]
}

export interface RankedActivityForUser {
  activity: GeneratedActivity
  score: number
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

function getActivityTraits(activity: GeneratedActivity): string[] {
  const traits = [activity.type]

  if (activity.indoor) traits.push("indoor")
  if (activity.weatherDependent) traits.push("weather_dependent")
  if (activity.kidFriendly) traits.push("kid_friendly")
  if (activity.petFriendly) traits.push("pet_friendly")
  if (activity.dietaryTags?.length) traits.push(...activity.dietaryTags)

  return unique(traits.map(normalizeText))
}

function scoreSignalMatch(activity: GeneratedActivity, signals: DbUserPreferenceSignal[]): number {
  const activityType = normalizeText(activity.type)
  const traits = getActivityTraits(activity)

  return signals.reduce((total, signal) => {
    const signalType = normalizeText(signal.signal_type)
    const signalKey = normalizeText(signal.signal_key)

    if (signalType === "category" && signalKey === activityType) {
      return total + Number(signal.signal_value) * 2
    }

    if (signalType === "tag" && traits.includes(signalKey)) {
      return total + Number(signal.signal_value) * 1.5
    }

    return total
  }, 0)
}

function scoreDestinationMemoryMatch(
  activity: GeneratedActivity,
  destinationMemory: DbUserDestinationMemory | null
): number {
  if (!destinationMemory) return 0

  const traits = getActivityTraits(activity)
  let score = 0

  for (const likedTag of destinationMemory.liked_tags ?? []) {
    if (traits.includes(normalizeText(likedTag))) score += 2
  }

  for (const dislikedTag of destinationMemory.disliked_tags ?? []) {
    if (traits.includes(normalizeText(dislikedTag))) score -= 2.5
  }

  return score
}

function scoreKnowledgeMatch(
  activity: GeneratedActivity,
  destinationMemory: DbUserDestinationMemory | null,
  destinationKnowledge: DbActivityKnowledge[]
): number {
  if (!destinationMemory || destinationKnowledge.length === 0) return 0

  const favoriteIds = new Set(destinationMemory.favorite_activity_ids ?? [])
  const activityName = normalizeText(activity.name)
  const activityType = normalizeText(activity.type)
  const activityTraits = getActivityTraits(activity)
  let score = 0

  for (const knowledge of destinationKnowledge) {
    const knowledgeName = normalizeText(knowledge.canonical_name)
    const knowledgeCategory = normalizeText(knowledge.category)
    const knowledgeTags = (knowledge.tags ?? []).map(normalizeText)
    const isFavorite = favoriteIds.has(knowledge.id)

    if (knowledgeName === activityName) {
      score += isFavorite ? 4 : 2
      continue
    }

    if (knowledgeCategory === activityType || knowledgeTags.some((tag) => activityTraits.includes(tag))) {
      score += isFavorite ? 1.5 : 0.5
    }
  }

  return score
}

export function scoreActivityForUser(
  activity: GeneratedActivity,
  context: PersonalRecommendationContext
): number {
  return Number(
    (
      scoreSignalMatch(activity, context.preferenceSignals) +
      scoreDestinationMemoryMatch(activity, context.destinationMemory) +
      scoreKnowledgeMatch(activity, context.destinationMemory, context.destinationKnowledge)
    ).toFixed(2)
  )
}

export function rankActivitiesForUser(
  activities: GeneratedActivity[],
  context: PersonalRecommendationContext
): RankedActivityForUser[] {
  return activities
    .map((activity) => ({
      activity,
      score: scoreActivityForUser(activity, context),
    }))
    .sort((a, b) => b.score - a.score)
}

function formatStrongSignals(signals: DbUserPreferenceSignal[], positive: boolean): string[] {
  return signals
    .filter((signal) => positive ? Number(signal.signal_value) > 0 : Number(signal.signal_value) < 0)
    .sort((a, b) => Math.abs(Number(b.signal_value)) - Math.abs(Number(a.signal_value)))
    .slice(0, 5)
    .map((signal) => `${signal.signal_type}:${signal.signal_key} (${Number(signal.signal_value).toFixed(1)})`)
}

function formatDiscoveredPlaces(discoveredPlaces: unknown[]): string[] {
  return discoveredPlaces
    .map((value) => (typeof value === "string" ? value : null))
    .filter((value): value is string => Boolean(value))
    .slice(0, 5)
}

export function buildPersonalRecommendationBrief(input: {
  destination: string
  preferenceSignals: DbUserPreferenceSignal[]
  destinationMemory: DbUserDestinationMemory | null
  destinationKnowledge: DbActivityKnowledge[]
}): string {
  const lines: string[] = [
    `Personal memory for ${input.destination}:`,
  ]

  const positiveSignals = formatStrongSignals(input.preferenceSignals, true)
  if (positiveSignals.length > 0) {
    lines.push(`- Strong positives: ${positiveSignals.join(", ")}`)
  }

  const negativeSignals = formatStrongSignals(input.preferenceSignals, false)
  if (negativeSignals.length > 0) {
    lines.push(`- Avoid or de-prioritize: ${negativeSignals.join(", ")}`)
  }

  if (input.destinationMemory) {
    lines.push(`- Visit count: ${input.destinationMemory.visit_count}`)

    if (input.destinationMemory.summary) {
      lines.push(`- Destination summary: ${input.destinationMemory.summary}`)
    }

    const discoveredPlaces = formatDiscoveredPlaces(input.destinationMemory.discovered_places ?? [])
    if (discoveredPlaces.length > 0) {
      lines.push(`- Previously discovered places: ${discoveredPlaces.join(", ")}`)
    }

    const favoriteKnowledge = input.destinationKnowledge
      .filter((knowledge) => input.destinationMemory?.favorite_activity_ids?.includes(knowledge.id))
      .map((knowledge) => knowledge.canonical_name)
      .slice(0, 5)

    if (favoriteKnowledge.length > 0) {
      lines.push(`- Known favorites to build on: ${favoriteKnowledge.join(", ")}`)
    }
  }

  if (lines.length === 1) {
    lines.push("- No prior history yet. Use onboarding preferences only.")
  }

  lines.push("Use this memory as a bias, not a hard constraint: keep the plan fresh but consistent with what the traveler has already liked and disliked.")

  return lines.join("\n")
}

export async function getUserPreferenceSignals(userId: string): Promise<DbUserPreferenceSignal[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("user_preference_signals")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("getUserPreferenceSignals error:", error)
      return []
    }

    return (data as DbUserPreferenceSignal[]) ?? []
  } catch (error) {
    console.error("getUserPreferenceSignals exception:", error)
    return []
  }
}

export async function getUserDestinationMemory(input: {
  userId: string
  destination: string
  country?: string | null
}): Promise<DbUserDestinationMemory | null> {
  try {
    const supabase = createServiceClient()
    let query = supabase
      .from("user_destination_memory")
      .select("*")
      .eq("user_id", input.userId)
      .eq("destination", input.destination)
      .limit(1)

    if (input.country) {
      query = query.eq("country", input.country)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error("getUserDestinationMemory error:", error)
      return null
    }

    return (data as DbUserDestinationMemory | null) ?? null
  } catch (error) {
    console.error("getUserDestinationMemory exception:", error)
    return null
  }
}

export async function getDestinationKnowledge(destination: string): Promise<DbActivityKnowledge[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("activity_knowledge")
      .select("*")
      .eq("destination", destination)
      .order("updated_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("getDestinationKnowledge error:", error)
      return []
    }

    return (data as DbActivityKnowledge[]) ?? []
  } catch (error) {
    console.error("getDestinationKnowledge exception:", error)
    return []
  }
}

export async function getPersonalRecommendationContext(input: {
  userId: string | null
  destination: string
  country?: string | null
}): Promise<PersonalRecommendationContext> {
  if (!input.userId) {
    return {
      preferenceSignals: [],
      destinationMemory: null,
      destinationKnowledge: [],
    }
  }

  const [preferenceSignals, destinationMemory, destinationKnowledge] = await Promise.all([
    getUserPreferenceSignals(input.userId),
    getUserDestinationMemory({
      userId: input.userId,
      destination: input.destination,
      country: input.country ?? null,
    }),
    getDestinationKnowledge(input.destination),
  ])

  return {
    preferenceSignals,
    destinationMemory,
    destinationKnowledge,
  }
}
