import type { KidsPets, MobilityOption, Transport, TravelCompanion } from "@/lib/onboarding-types"

export interface MobilityProfileInput {
  companion?: TravelCompanion | null
  kidsPets?: KidsPets[] | null
  mobility?: MobilityOption | null
  transport?: Transport[] | null
}

export interface MobilityProfile {
  key:
    | "adult"
    | "family-baby"
    | "family-kids"
    | "family-teens"
    | "family-pet-small"
    | "family-pet-large"
    | "reduced"
    | "frequent-rest"
    | "wheelchair"
  label: string
  walkingSpeedKmh: number
  maxComfortableWalkMeters: number
  restAfterMeters: number
  notes: string[]
}

export interface SegmentMobilityAdvice {
  mode: "walk" | "walk-with-rest" | "public-transport"
  needsRestStop: boolean
  reason: string
}

const PROFILES: Record<MobilityProfile["key"], MobilityProfile> = {
  adult: {
    key: "adult",
    label: "Adultos / turismo general",
    walkingSpeedKmh: 4.8,
    maxComfortableWalkMeters: 1500,
    restAfterMeters: 1200,
    notes: ["Adult tourism default based on typical urban walking tolerance."],
  },
  "family-baby": {
    key: "family-baby",
    label: "Familia con bebé o toddler",
    walkingSpeedKmh: 2.8,
    maxComfortableWalkMeters: 600,
    restAfterMeters: 450,
    notes: ["Toddlers fatigue fast. Use stroller/carrier and frequent breaks."],
  },
  "family-kids": {
    key: "family-kids",
    label: "Familia con niños",
    walkingSpeedKmh: 4,
    maxComfortableWalkMeters: 900,
    restAfterMeters: 700,
    notes: ["Children 6-12 can walk, but sightseeing requires extra breaks."],
  },
  "family-teens": {
    key: "family-teens",
    label: "Familia con preadolescentes",
    walkingSpeedKmh: 4.6,
    maxComfortableWalkMeters: 1200,
    restAfterMeters: 900,
    notes: ["Pre-teens tolerate longer segments than small children."],
  },
  "family-pet-small": {
    key: "family-pet-small",
    label: "Viaje con perro pequeño",
    walkingSpeedKmh: 4.2,
    maxComfortableWalkMeters: 1000,
    restAfterMeters: 800,
    notes: ["Small dogs need more frequent hydration / pause windows."],
  },
  "family-pet-large": {
    key: "family-pet-large",
    label: "Viaje con perro grande",
    walkingSpeedKmh: 4.4,
    maxComfortableWalkMeters: 1300,
    restAfterMeters: 1000,
    notes: ["Larger dogs tolerate longer walks but still need hydration stops."],
  },
  reduced: {
    key: "reduced",
    label: "Movilidad reducida",
    walkingSpeedKmh: 3,
    maxComfortableWalkMeters: 350,
    restAfterMeters: 250,
    notes: ["Keep transfers short and favor accessible transport."],
  },
  "frequent-rest": {
    key: "frequent-rest",
    label: "Necesita descansos frecuentes",
    walkingSpeedKmh: 2.4,
    maxComfortableWalkMeters: 250,
    restAfterMeters: 180,
    notes: ["Bench / café / shade stop should appear often."],
  },
  wheelchair: {
    key: "wheelchair",
    label: "Silla de ruedas / accesibilidad alta",
    walkingSpeedKmh: 2.7,
    maxComfortableWalkMeters: 200,
    restAfterMeters: 150,
    notes: ["Default to accessible public transport or taxi for most transfers."],
  },
}

export function resolveMobilityProfile(input: MobilityProfileInput): MobilityProfile {
  const kidsPets = input.kidsPets ?? []
  const mobility = input.mobility ?? "full"

  if (mobility === "wheelchair") return PROFILES.wheelchair
  if (mobility === "frequent-rest") return PROFILES["frequent-rest"]
  if (mobility === "moderate" || mobility === "reduced") return PROFILES.reduced

  if (kidsPets.includes("bebe")) return PROFILES["family-baby"]
  if (kidsPets.includes("ninos")) return PROFILES["family-kids"]
  if (kidsPets.includes("pre-adolescentes")) return PROFILES["family-teens"]
  if (kidsPets.includes("perro-pequeno")) return PROFILES["family-pet-small"]
  if (kidsPets.includes("perro-grande")) return PROFILES["family-pet-large"]

  return PROFILES.adult
}

export function getSegmentMobilityAdvice(
  distanceMeters: number,
  profile: MobilityProfile
): SegmentMobilityAdvice {
  if (distanceMeters > profile.maxComfortableWalkMeters) {
    const km = (profile.maxComfortableWalkMeters / 1000).toFixed(1).replace('.0', '')
    return {
      mode: "public-transport",
      needsRestStop: false,
      reason: `This segment exceeds the comfortable walking threshold for ${profile.label} (${km} km). Prefer public transport, taxi, or a more accessible transfer.`,
    }
  }

  if (distanceMeters > profile.restAfterMeters) {
    return {
      mode: "walk-with-rest",
      needsRestStop: true,
      reason: `This segment is still walkable for ${profile.label}, but it should include a rest stop or recovery point.`,
    }
  }

  return {
    mode: "walk",
    needsRestStop: false,
    reason: `This walking segment is within the comfortable range for ${profile.label}.`,
  }
}

export function buildMobilityPlanningBrief(input: MobilityProfileInput): string {
  const profile = resolveMobilityProfile(input)
  const transport = input.transport?.length ? input.transport.join(", ") : "mix"
  const contextBits: string[] = []

  if ((input.kidsPets ?? []).includes("bebe")) contextBits.push("baby/toddler")
  if ((input.kidsPets ?? []).includes("ninos")) contextBits.push("children")
  if ((input.kidsPets ?? []).includes("pre-adolescentes")) contextBits.push("pre-teens")
  if ((input.kidsPets ?? []).includes("perro-pequeno")) contextBits.push("small dog")
  if ((input.kidsPets ?? []).includes("perro-grande")) contextBits.push("large dog")

  return [
    `Mobility planning profile: ${profile.label}.`,
    contextBits.length ? `Context: ${contextBits.join(", ")}.` : null,
    `Preferred transport mix: ${transport}.`,
    `If distance between consecutive activities exceeds ${profile.maxComfortableWalkMeters}m, use public transport, taxi, or another low-effort transfer instead of walking.`,
    `If a segment exceeds ${profile.restAfterMeters}m but stays under the transport threshold, add a real named rest stop (bench area, café, playground, shaded square, etc.).`,
    `Use an assumed walking speed of ${profile.walkingSpeedKmh} km/h for feasibility.`,
    ...profile.notes,
  ].filter(Boolean).join(" ")
}
