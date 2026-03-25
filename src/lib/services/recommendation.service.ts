import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server"

import type { GeneratedItinerary } from "@/lib/supabase/database.types"

export interface UserLearningContext {
  destination: string
  hasHistory: boolean
  preferredPace: string | null
  preferredMoods: string[]
  likedTags: string[]
  dislikedTags: string[]
  favoriteActivities: string[]
  skippedActivities: string[]
  unfinishedActivities: string[]
  discoveredPlaces: string[]
  destinationKnowledge: Array<{
    name: string
    category: string
    address: string | null
    tags: string[]
  }>
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function toSafeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

async function getActivityNames(activityIds: string[]): Promise<string[]> {
  if (!isSupabaseConfigured() || activityIds.length === 0) return []

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("activities")
      .select("id,name")
      .in("id", activityIds)

    if (error) return []
    return unique((data ?? []).map((row) => String(row.name ?? "")).filter(Boolean))
  } catch {
    return []
  }
}

export async function getUserLearningContext(
  userId: string | null | undefined,
  destination: string
): Promise<UserLearningContext | null> {
  if (!userId || !isSupabaseConfigured()) return null

  try {
    const supabase = createServiceClient()

    const [destinationMemoryRes, preferenceSignalsRes, destinationKnowledgeRes] = await Promise.all([
      supabase
        .from("user_destination_memory")
        .select("*")
        .eq("user_id", userId)
        .eq("destination", destination)
        .maybeSingle(),
      supabase
        .from("user_preference_signals")
        .select("signal_type, signal_key, signal_value")
        .eq("user_id", userId)
        .order("signal_value", { ascending: false }),
      supabase
        .from("activity_knowledge")
        .select("canonical_name, category, address, tags")
        .eq("destination", destination)
        .order("updated_at", { ascending: false })
        .limit(12),
    ])

    const destinationMemory = destinationMemoryRes.data
    const preferenceSignals = preferenceSignalsRes.data ?? []
    const destinationKnowledge = (destinationKnowledgeRes.data ?? []).map((row) => ({
      name: String(row.canonical_name ?? ""),
      category: String(row.category ?? "tour"),
      address: typeof row.address === "string" ? row.address : null,
      tags: toSafeStringArray(row.tags),
    }))

    const preferredPace =
      preferenceSignals.find((signal) => signal.signal_type === "pace")?.signal_key ?? null

    const preferredMoods = unique(
      preferenceSignals
        .filter((signal) => signal.signal_type === "mood")
        .slice(0, 3)
        .map((signal) => String(signal.signal_key ?? ""))
    )

    const favoriteActivities = await getActivityNames(
      toSafeStringArray(destinationMemory?.favorite_activity_ids)
    )
    const skippedActivities = await getActivityNames(
      toSafeStringArray(destinationMemory?.skipped_activity_ids)
    )
    const unfinishedActivities = await getActivityNames(
      toSafeStringArray(destinationMemory?.unfinished_activity_ids)
    )

    const context: UserLearningContext = {
      destination,
      hasHistory:
        Boolean(destinationMemory) ||
        preferenceSignals.length > 0 ||
        destinationKnowledge.length > 0,
      preferredPace,
      preferredMoods,
      likedTags: toSafeStringArray(destinationMemory?.liked_tags),
      dislikedTags: toSafeStringArray(destinationMemory?.disliked_tags),
      favoriteActivities,
      skippedActivities,
      unfinishedActivities,
      discoveredPlaces: toSafeStringArray(destinationMemory?.discovered_places),
      destinationKnowledge,
    }

    return context.hasHistory ? context : null
  } catch (err) {
    console.warn("[recommendation] getUserLearningContext error:", err)
    return null
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function includesNormalized(haystack: string[], needle: string): boolean {
  const target = normalize(needle)
  return haystack.some((item) => normalize(item).includes(target) || target.includes(normalize(item)))
}

function inferRecommendationReason(
  activity: GeneratedItinerary["days"][number]["activities"][number],
  learningContext: UserLearningContext
): string | undefined {
  if (includesNormalized(learningContext.unfinishedActivities, activity.name)) {
    return "Te lo sugerimos porque lo dejaste pendiente en un viaje anterior."
  }

  if (includesNormalized(learningContext.favoriteActivities, activity.name)) {
    return "Te lo sugerimos porque se parece a algo que ya te gustó mucho antes."
  }

  if (includesNormalized(learningContext.discoveredPlaces, activity.name)) {
    return "Aparece porque conecta con un sitio que descubriste por tu cuenta antes."
  }

  if (learningContext.likedTags.some((tag) => normalize(tag) === normalize(activity.type))) {
    return `Te lo sugerimos porque suele encajar con tu preferencia por planes de tipo ${activity.type}.`
  }

  const matchedKnowledge = learningContext.destinationKnowledge.find((place) => {
    const sameCategory = normalize(place.category) === normalize(activity.type)
    const sameName = normalize(place.name).includes(normalize(activity.name)) || normalize(activity.name).includes(normalize(place.name))
    return sameName || sameCategory
  })

  if (matchedKnowledge) {
    return `Lo priorizamos porque encaja con tu memoria guardada en ${learningContext.destination}.`
  }

  if (learningContext.preferredPace) {
    return `Lo hemos metido porque encaja con tu ritmo ${learningContext.preferredPace}.`
  }

  return undefined
}

export function annotateItineraryWithLearningReasons(
  itinerary: GeneratedItinerary,
  learningContext: UserLearningContext | null
): GeneratedItinerary {
  if (!learningContext) return itinerary

  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      activities: day.activities.map((activity) => ({
        ...activity,
        recommendationReason:
          activity.recommendationReason ?? inferRecommendationReason(activity, learningContext),
      })),
    })),
  }
}

export function formatLearningContextForPrompt(
  learningContext: UserLearningContext | null
): string {
  if (!learningContext) return ""

  const lines: string[] = []
  lines.push("PAST TRAVEL LEARNING (use this strongly when planning):")

  if (learningContext.preferredPace) {
    lines.push(`- Learned preferred pace: ${learningContext.preferredPace}`)
  }
  if (learningContext.preferredMoods.length > 0) {
    lines.push(`- Typical positive moods after good days: ${learningContext.preferredMoods.join(", ")}`)
  }
  if (learningContext.likedTags.length > 0) {
    lines.push(`- Liked tags/categories from previous trips: ${learningContext.likedTags.join(", ")}`)
  }
  if (learningContext.dislikedTags.length > 0) {
    lines.push(`- Avoid or de-prioritize tags/categories: ${learningContext.dislikedTags.join(", ")}`)
  }
  if (learningContext.favoriteActivities.length > 0) {
    lines.push(`- Previously loved activities: ${learningContext.favoriteActivities.join(" | ")}`)
  }
  if (learningContext.skippedActivities.length > 0) {
    lines.push(`- Previously skipped activities: ${learningContext.skippedActivities.join(" | ")}`)
  }
  if (learningContext.unfinishedActivities.length > 0) {
    lines.push(`- Unfinished / worth revisiting: ${learningContext.unfinishedActivities.join(" | ")}`)
  }
  if (learningContext.discoveredPlaces.length > 0) {
    lines.push(`- Places discovered outside the plan before: ${learningContext.discoveredPlaces.join(" | ")}`)
  }
  if (learningContext.destinationKnowledge.length > 0) {
    lines.push("- Internal destination knowledge to prefer if it fits this trip:")
    for (const place of learningContext.destinationKnowledge.slice(0, 10)) {
      lines.push(
        `  - ${place.name} (${place.category})${place.address ? ` — ${place.address}` : ""}${place.tags.length > 0 ? ` [${place.tags.join(", ")}]` : ""}`
      )
    }
  }

  lines.push(
    "Use this memory to bias selection: prefer liked patterns, avoid disliked patterns, and mix known-good places with fresh options when appropriate."
  )

  return `\n\n${lines.join("\n")}`
}
