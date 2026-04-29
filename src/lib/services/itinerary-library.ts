import type { OnboardingData } from "@/lib/onboarding-types"
import type { GeneratedItinerary, DbOnboardingProfile } from "@/lib/supabase/database.types"
import { createServiceClient } from "@/lib/supabase/server"
import curatedSeeds from "@/../knowledge/seed-itineraries/curated-seeds.json"

interface ItineraryLibraryMatch {
  itinerary: GeneratedItinerary
  sourceTripId: string
  sourceVersionId: string
  sourceDestination: string
  score: number
  reasons: string[]
  sourceType?: "library" | "curated-seed"
}

interface CuratedSeedEntry {
  destination: string
  targetProfiles: string[]
  notes: string
  seedIds: string[]
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

const DESTINATION_ALIASES: Record<string, string> = {
  "new york": "nueva york",
  "nueva york": "nueva york",
  "nyc": "nueva york",
  "saint petersburg": "saint petersburg",
  "st petersburg": "saint petersburg",
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function normalizeDestination(value: string | null | undefined): string {
  const normalized = normalizeText(value)
  return DESTINATION_ALIASES[normalized] ?? normalized
}

function normalizeList(values: string[] | null | undefined): string[] {
  return (values ?? []).map(normalizeText).filter(Boolean)
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function slugify(value: string | null | undefined): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function buildSeedKey(destination: string, tripId: string, versionNumber = 1): string {
  return `${slugify(destination)}-${tripId}-v${versionNumber}`
}

function getRequestedDayCount(input: OnboardingData): number {
  const start = new Date(`${input.startDate}T00:00:00Z`)
  const end = new Date(`${input.endDate}T00:00:00Z`)
  const diffMs = end.getTime() - start.getTime()
  return Math.max(1, Math.round(diffMs / 86400000) + 1)
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

interface ExportedLibraryEntry {
  id: string
  tripId: string
  versionId: string
  destination: string
  tripName?: string
  dayCount: number
  createdAt: string
  snapshot: GeneratedItinerary
}

function buildCuratedSeedBoostMap(): Map<string, CuratedSeedEntry> {
  const map = new Map<string, CuratedSeedEntry>()
  for (const entry of curatedSeeds as CuratedSeedEntry[]) {
    for (const seedId of entry.seedIds) {
      map.set(seedId, entry)
    }
  }
  return map
}

const curatedSeedBoostMap = buildCuratedSeedBoostMap()
const exportedLibrary = new Map<string, ExportedLibraryEntry>()

function scoreCandidate(input: OnboardingData, candidate: LibraryCandidate): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  const inputDestination = normalizeDestination(input.destination)
  const candidateDestination = normalizeDestination(candidate.destination)
  if (inputDestination !== candidateDestination) {
    return { score: -1, reasons: ["destination-mismatch"] }
  }
  score += 50
  reasons.push("same-destination")

  const requestedDayCount = getRequestedDayCount(input)
  const candidateDayCount = candidate.snapshot.days.length
  if (candidateDayCount === requestedDayCount) {
    score += 12
    reasons.push("same-day-count")
  } else if (Math.abs(candidateDayCount - requestedDayCount) === 1) {
    score += 6
    reasons.push("near-day-count")
  }

  if (!candidate.onboarding) {
    score += 5
    reasons.push("no-profile-fallback")
  } else if ((input.companion ?? "") === candidate.onboarding.companion) {
    score += 10
    reasons.push("same-companion")
  }

  if (candidate.onboarding && (input.groupSize ?? 1) === (candidate.onboarding.group_size ?? 1)) {
    score += 6
    reasons.push("same-group-size")
  }

  if (candidate.onboarding && (input.mobility ?? "") === (candidate.onboarding.mobility ?? "")) {
    score += 10
    reasons.push("same-mobility")
  }

  if (candidate.onboarding && (input.travelerStyle ?? "") === (candidate.onboarding.traveler_style ?? "")) {
    score += 8
    reasons.push("same-style")
  }

  if (candidate.onboarding && (input.budget ?? "") === (candidate.onboarding.budget_level ?? "")) {
    score += 8
    reasons.push("same-budget")
  }

  if (candidate.onboarding && (input.firstTime ?? null) === (candidate.onboarding.first_time ?? null)) {
    score += 5
    reasons.push("same-first-time")
  }

  const inputInterests = new Set(normalizeList(input.interests))
  const candidateInterests = new Set(normalizeList(candidate.onboarding?.interests))
  const sharedInterests = [...inputInterests].filter((interest) => candidateInterests.has(interest))
  if (sharedInterests.length > 0) {
    score += Math.min(18, sharedInterests.length * 4)
    reasons.push(`shared-interests:${sharedInterests.join(",")}`)
  }

  const inputTransport = new Set(normalizeList(input.transport))
  const candidateTransport = new Set(normalizeList(candidate.onboarding?.transport))
  const sharedTransport = [...inputTransport].filter((item) => candidateTransport.has(item))
  if (sharedTransport.length > 0) {
    score += Math.min(8, sharedTransport.length * 3)
    reasons.push(`shared-transport:${sharedTransport.join(",")}`)
  }

  const inputKidsPets = new Set(normalizeList(input.kidsPets))
  const candidateKidsPets = new Set(normalizeList(candidate.onboarding?.kids_pets))
  const sharedKidsPets = [...inputKidsPets].filter((item) => candidateKidsPets.has(item))
  if (sharedKidsPets.length > 0) {
    score += Math.min(8, sharedKidsPets.length * 4)
    reasons.push(`shared-kids-pets:${sharedKidsPets.join(",")}`)
  }

  const curatedSeed = curatedSeedBoostMap.get(buildSeedKey(candidate.destination, candidate.tripId))
  if (curatedSeed) {
    score += 20
    reasons.push("curated-seed")

    const profileText = normalizeText(curatedSeed.targetProfiles.join(" "))
    if (input.companion && profileText.includes(normalizeText(input.companion))) {
      score += 6
      reasons.push("curated-profile-companion")
    }
    if (input.budget && profileText.includes(normalizeText(input.budget))) {
      score += 4
      reasons.push("curated-profile-budget")
    }
  }

  return { score, reasons }
}

async function loadExportedLibrary(): Promise<Map<string, ExportedLibraryEntry>> {
  if (exportedLibrary.size > 0) return exportedLibrary
  const data = (await import("@/../knowledge/seed-itineraries/library.json")).default as ExportedLibraryEntry[]
  for (const entry of data) exportedLibrary.set(entry.id, entry)
  return exportedLibrary
}

async function findCuratedSeedFallback(input: OnboardingData): Promise<ItineraryLibraryMatch | null> {
  const destination = normalizeDestination(input.destination)
  const requestedDayCount = getRequestedDayCount(input)
  const library = await loadExportedLibrary()

  let best: ItineraryLibraryMatch | null = null
  for (const entry of curatedSeeds as CuratedSeedEntry[]) {
    if (normalizeDestination(entry.destination) !== destination) continue

    const profileText = normalizeText(entry.targetProfiles.join(" "))
    for (const seedId of entry.seedIds) {
      const seed = library.get(seedId)
      if (!seed?.snapshot?.days?.length) continue

      let score = 60
      const reasons = ["curated-destination-match"]
      if (seed.dayCount === requestedDayCount) {
        score += 12
        reasons.push("same-day-count")
      } else if (Math.abs(seed.dayCount - requestedDayCount) === 1) {
        score += 6
        reasons.push("near-day-count")
      }
      if (input.companion && profileText.includes(normalizeText(input.companion))) {
        score += 6
        reasons.push("curated-profile-companion")
      }
      if (input.budget && profileText.includes(normalizeText(input.budget))) {
        score += 4
        reasons.push("curated-profile-budget")
      }
      if (input.travelerStyle && profileText.includes(normalizeText(input.travelerStyle))) {
        score += 4
        reasons.push("curated-profile-style")
      }
      const sharedInterests = normalizeList(input.interests).filter((interest) => profileText.includes(interest))
      if (sharedInterests.length > 0) {
        score += Math.min(12, sharedInterests.length * 4)
        reasons.push(`curated-shared-interests:${sharedInterests.join(",")}`)
      }

      const remapped = remapDateKeepingTime(seed.snapshot.days[0]?.date ?? input.startDate, input.startDate, seed.snapshot)
      const candidate: ItineraryLibraryMatch = {
        itinerary: remapped,
        sourceTripId: seed.tripId,
        sourceVersionId: seed.versionId,
        sourceDestination: seed.destination,
        score,
        reasons,
        sourceType: "curated-seed",
      }
      if (!best || candidate.score > best.score) best = candidate
    }
  }

  return best
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

  const destination = normalizeDestination(input.destination)
  const rows = data as VersionRow[]
  const filtered = rows.filter((row) => normalizeDestination(firstTripRelation(row)?.destination) === destination)
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

  if (best) return best
  return findCuratedSeedFallback(input)
}
