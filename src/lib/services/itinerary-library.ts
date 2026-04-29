import type { OnboardingData } from "@/lib/onboarding-types"
import type { GeneratedItinerary, DbOnboardingProfile, DbItineraryVersion } from "@/lib/supabase/database.types"
import { createServiceClient } from "@/lib/supabase/server"

interface ItineraryLibraryMatch {
  itinerary: GeneratedItinerary
  sourceTripId: string
  sourceVersionId: string
  sourceDestination: string
  score: number
  reasons: string[]
}

interface LibraryCandidate {
  tripId: string
  versionId: string
  destination: string
  snapshot: GeneratedItinerary
  onboarding: Pick<
    DbOnboardingProfile,
    | "destination"
    | "companion"
    | "group_size"
    | "kids_pets"
    | "mobility"
    | "interests"
    | "traveler_style"
    | "budget_level"
    | "transport"
    | "first_time"
  > | null
}

interface VersionRow {
  id: string
  trip_id: string
  snapshot: GeneratedItinerary | null
  trips: { destination: string; onboarding_id: string | null } | { destination: string; onboarding_id: string | null }[] | null
}

function firstTripRelation(row: VersionRow): { destination: string; onboarding_id: string | null } | null {
  if (!row.trips) return null
  return Array.isArray(row.trips) ? (row.trips[0] ?? null) : row.trips
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function normalizeList(values: string[] | null | undefined): string[] {
  return (values ?? []).map(normalizeText).filter(Boolean)
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function remapDateKeepingTime(originalDate: string, targetDate: string, itinerary: GeneratedItinerary): GeneratedItinerary {
  const original = new Date(`${originalDate}T00:00:00Z`)
  const target = new Date(`${targetDate}T00:00:00Z`)
  const baseDiffMs = target.getTime() - original.getTime()

  return {
    ...itinerary,
    days: itinerary.days.map((day) => {
      const dayDate = new Date(`${day.date}T00:00:00Z`)
      const shifted = new Date(dayDate.getTime() + baseDiffMs)
      return {
        ...day,
        date: shifted.toISOString().slice(0, 10),
      }
    }),
  }
}

function scoreCandidate(input: OnboardingData, candidate: LibraryCandidate): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  const inputDestination = normalizeText(input.destination)
  const candidateDestination = normalizeText(candidate.destination)
  if (inputDestination !== candidateDestination) {
    return { score: -1, reasons: ["destination-mismatch"] }
  }
  score += 50
  reasons.push("same-destination")

  if (!candidate.onboarding) {
    score += 5
    reasons.push("no-profile-fallback")
    return { score, reasons }
  }

  if ((input.companion ?? "") === candidate.onboarding.companion) {
    score += 10
    reasons.push("same-companion")
  }

  if ((input.groupSize ?? 1) === (candidate.onboarding.group_size ?? 1)) {
    score += 6
    reasons.push("same-group-size")
  }

  if ((input.mobility ?? "") === (candidate.onboarding.mobility ?? "")) {
    score += 10
    reasons.push("same-mobility")
  }

  if ((input.travelerStyle ?? "") === (candidate.onboarding.traveler_style ?? "")) {
    score += 8
    reasons.push("same-style")
  }

  if ((input.budget ?? "") === (candidate.onboarding.budget_level ?? "")) {
    score += 8
    reasons.push("same-budget")
  }

  if ((input.firstTime ?? null) === (candidate.onboarding.first_time ?? null)) {
    score += 5
    reasons.push("same-first-time")
  }

  const inputInterests = new Set(normalizeList(input.interests))
  const candidateInterests = new Set(normalizeList(candidate.onboarding.interests))
  const sharedInterests = [...inputInterests].filter((interest) => candidateInterests.has(interest))
  if (sharedInterests.length > 0) {
    score += Math.min(18, sharedInterests.length * 4)
    reasons.push(`shared-interests:${sharedInterests.join(",")}`)
  }

  const inputTransport = new Set(normalizeList(input.transport))
  const candidateTransport = new Set(normalizeList(candidate.onboarding.transport))
  const sharedTransport = [...inputTransport].filter((item) => candidateTransport.has(item))
  if (sharedTransport.length > 0) {
    score += Math.min(8, sharedTransport.length * 3)
    reasons.push(`shared-transport:${sharedTransport.join(",")}`)
  }

  const inputKidsPets = new Set(normalizeList(input.kidsPets))
  const candidateKidsPets = new Set(normalizeList(candidate.onboarding.kids_pets))
  const sharedKidsPets = [...inputKidsPets].filter((item) => candidateKidsPets.has(item))
  if (sharedKidsPets.length > 0) {
    score += Math.min(8, sharedKidsPets.length * 4)
    reasons.push(`shared-kids-pets:${sharedKidsPets.join(",")}`)
  }

  return { score, reasons }
}

export async function findReusableItinerary(
  input: OnboardingData,
  options?: { minScore?: number; limit?: number }
): Promise<ItineraryLibraryMatch | null> {
  const minScore = options?.minScore ?? 72
  const limit = options?.limit ?? 20
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("itinerary_versions")
    .select(`
      id,
      trip_id,
      snapshot,
      trips!inner(
        destination,
        onboarding_id
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit * 3)

  if (error || !data) {
    console.warn("[itinerary-library] version lookup failed", error)
    return null
  }

  const destination = normalizeText(input.destination)
  const rows = data as VersionRow[]
  const filtered = rows.filter((row) => normalizeText(firstTripRelation(row)?.destination) === destination)
  if (filtered.length === 0) return null

  const onboardingIds = unique(
    filtered.map((row) => firstTripRelation(row)?.onboarding_id).filter((value): value is string => Boolean(value))
  )

  let onboardingMap = new Map<string, LibraryCandidate["onboarding"]>()
  if (onboardingIds.length > 0) {
    const { data: onboardingRows } = await supabase
      .from("onboarding_profiles")
      .select("id,destination,companion,group_size,kids_pets,mobility,interests,traveler_style,budget_level,transport,first_time")
      .in("id", onboardingIds)

    onboardingMap = new Map((onboardingRows ?? []).map((row) => [row.id, row]))
  }

  let best: ItineraryLibraryMatch | null = null

  for (const row of filtered.slice(0, limit)) {
    const snapshot = row.snapshot as GeneratedItinerary | null
    if (!snapshot?.days?.length) continue

    const candidate: LibraryCandidate = {
      tripId: row.trip_id,
      versionId: row.id,
      destination: firstTripRelation(row)?.destination ?? input.destination,
      snapshot,
      onboarding: firstTripRelation(row)?.onboarding_id ? onboardingMap.get(firstTripRelation(row)!.onboarding_id as string) ?? null : null,
    }

    const scored = scoreCandidate(input, candidate)
    if (scored.score < minScore) continue

    const remapped = remapDateKeepingTime(snapshot.days[0]?.date ?? input.startDate, input.startDate, snapshot)
    const match: ItineraryLibraryMatch = {
      itinerary: remapped,
      sourceTripId: candidate.tripId,
      sourceVersionId: candidate.versionId,
      sourceDestination: candidate.destination,
      score: scored.score,
      reasons: scored.reasons,
    }

    if (!best || match.score > best.score) {
      best = match
    }
  }

  return best
}
