import type { MobilityProfile } from "@/lib/mobility"

// ─── Transit fare database ────────────────────────────────────────────────────
// Sources: official TMB/Metro websites (2024 prices)

interface TransitFare {
  currency: string
  singleTicket: number
  tenJourney: number | null
  dayPass: number | null
  notes: string
  isFallback?: boolean
}

const TRANSIT_FARES: Record<string, TransitFare> = {
  barcelona: { currency: "€", singleTicket: 2.55, tenJourney: 11.35, dayPass: 11.20, notes: "T-Casual 10 viajes · Metro/Bus TMB" },
  madrid: { currency: "€", singleTicket: 1.50, tenJourney: 12.20, dayPass: 8.40, notes: "Abono 10 viajes Metro · Zona A" },
  paris: { currency: "€", singleTicket: 2.15, tenJourney: 17.35, dayPass: 15.60, notes: "Ticket t+ RATP · Carnet x10" },
  london: { currency: "£", singleTicket: 2.80, tenJourney: null, dayPass: 15.00, notes: "Contactless daily cap · TfL 2024" },
  rome: { currency: "€", singleTicket: 1.50, tenJourney: 15.00, dayPass: 7.00, notes: "BIT ticket · ATAC Roma" },
  amsterdam: { currency: "€", singleTicket: 3.40, tenJourney: null, dayPass: 8.00, notes: "OV-chipkaart GVB" },
  berlin: { currency: "€", singleTicket: 3.50, tenJourney: null, dayPass: 9.20, notes: "VBB Einzelticket AB" },
  lisbon: { currency: "€", singleTicket: 2.00, tenJourney: null, dayPass: 6.90, notes: "Carris/Metro single" },
  prague: { currency: "CZK", singleTicket: 40, tenJourney: null, dayPass: 120, notes: "DPP Praha · 90min ticket" },
  vienna: { currency: "€", singleTicket: 2.40, tenJourney: null, dayPass: 8.00, notes: "Wiener Linien Einzelticket" },
  tokyo: { currency: "¥", singleTicket: 180, tenJourney: null, dayPass: 600, notes: "Tokyo Metro average segment" },
  "new york": { currency: "$", singleTicket: 2.90, tenJourney: null, dayPass: 34.00, notes: "MTA single ride" },
  "nueva york": { currency: "$", singleTicket: 2.90, tenJourney: null, dayPass: 34.00, notes: "MTA single ride" },
  bali: { currency: "$", singleTicket: 1.50, tenJourney: null, dayPass: null, notes: "Grab/taxi estimate · no public metro" },
}

const FALLBACK_FARE: TransitFare = {
  currency: "€",
  singleTicket: 2.00,
  tenJourney: null,
  dayPass: null,
  notes: "Estimated generic European fare",
  isFallback: true,
}

export function getTransitFare(destination: string): TransitFare {
  const key = destination.toLowerCase().trim()
  return TRANSIT_FARES[key] ?? FALLBACK_FARE
}

// ─── Transit time estimation ──────────────────────────────────────────────────
// We don't have a free real-time transit API, so we estimate using:
//   - Walk to nearest stop: ~3-5 min for urban centers
//   - Average wait: depends on city / time of day
//   - Ride time: faster than walking (empirical ~3× speed for metro, ~2× for bus)

export interface TransitEstimate {
  walkToStopMinutes: number
  waitMinutes: number
  rideMinutes: number
  totalMinutes: number
  fareAmount: number
  fareCurrency: string
  fareNotes: string
  transitMapsUrl: string
}

export function estimateTransitOption(
  walking: { walkingMinutes: number; distanceMeters: number },
  destination: string
): TransitEstimate {
  const fare = getTransitFare(destination)

  // Walk to nearest stop: 3 min for urban, 5 min for less dense
  const walkToStopMinutes = walking.distanceMeters > 3000 ? 5 : 3

  // Average metro/bus wait (peak hours ~4 min, off-peak ~7 min — we use 5 as typical)
  const waitMinutes = 5

  // Ride speed: metro ~35 km/h effective including stops, bus ~20 km/h
  // For city center distances, metro (~3×) is roughly right
  const rideSpeedFactor = walking.distanceMeters < 1000 ? 2 : 3
  const rideMinutes = Math.max(3, Math.round((walking.walkingMinutes / rideSpeedFactor)))

  const totalMinutes = walkToStopMinutes + waitMinutes + rideMinutes

  const transitMapsUrl = `https://www.google.com/maps/dir/?api=1&travelmode=transit`

  return {
    walkToStopMinutes,
    waitMinutes,
    rideMinutes,
    totalMinutes,
    fareAmount: fare.singleTicket,
    fareCurrency: fare.currency,
    fareNotes: fare.notes,
    transitMapsUrl,
  }
}

// ─── Should we offer the transit choice? ─────────────────────────────────────

export function shouldOfferTransitChoice(
  distanceMeters: number,
  mobilityProfileKey: MobilityProfile["key"]
): boolean {
  const thresholds: Record<MobilityProfile["key"], number> = {
    adult: 1200,
    "family-baby": 500,
    "family-kids": 700,
    "family-teens": 900,
    "family-pet-small": 800,
    "family-pet-large": 1000,
    reduced: 300,
    "frequent-rest": 200,
    wheelchair: 150,
  }
  return distanceMeters > (thresholds[mobilityProfileKey] ?? 1200)
}

// ─── Transfer context (for the UI card) ──────────────────────────────────────

export interface TransferContext {
  fromActivity: string
  toActivity: string
  distanceMeters: number
  walkingMinutes: number
  destination: string
  mobilityProfileKey: MobilityProfile["key"]
  /** 0 = start of day, 1 = end of day */
  dayProgress: number
}

export interface TransferOption {
  mode: "walk" | "transit"
  totalMinutes: number
  hint: string
  mapsUrl: string
  fareAmount?: number
  fareCurrency?: string
}

export interface TransferSummary {
  walkingOption: TransferOption
  transitOption: TransferOption
  recommendTransit: boolean
  /** Why we recommend one over the other */
  rationale: string
}

// Generic walking-route hints by destination + from/to pairing
// (Real impl: could call a small Gemini call but keep it static for now)
function buildWalkingHint(from: string, to: string, destination: string): string {
  const dest = destination.toLowerCase()
  const hints: string[] = []

  if (dest === "barcelona") {
    if (/sagrada|familia/i.test(to)) hints.push("Pasarás por el Passeig de Gràcia y el Eixample modernista.")
    if (/born|barceloneta/i.test(to)) hints.push("Cruzarás el Barrio Gótico y podrás ver la Catedral de camino.")
    if (/güell|park/i.test(from) || /güell|park/i.test(to)) hints.push("Bajarás por el barrio de Gràcia con sus plazas y terrazas.")
    if (/montju/i.test(to)) hints.push("La subida al castillo ofrece vistas panorámicas de toda la ciudad.")
  } else if (dest === "madrid") {
    if (/prado|reina sofia/i.test(to)) hints.push("Pasarás por el Paseo del Prado, uno de los bulevares más bonitos de Europa.")
    if (/retiro/i.test(to)) hints.push("El camino al Retiro pasa por la calle de Alcalá.")
    if (/gran via/i.test(to)) hints.push("La Gran Vía está llena de arquitectura modernista del s. XX.")
  } else if (dest === "paris") {
    if (/eiffel/i.test(to)) hints.push("Cruzarás el Champ de Mars con vistas a la Torre Eiffel.")
    if (/louvre/i.test(to)) hints.push("El camino pasa por las Tullerías y los quais del Sena.")
  }

  if (hints.length === 0) {
    hints.push("Caminar por la ciudad es la mejor forma de descubrir rincones inesperados.")
  }

  return hints[0]
}

export function buildTransferContext(ctx: TransferContext): TransferSummary {
  const transit = estimateTransitOption(
    { walkingMinutes: ctx.walkingMinutes, distanceMeters: ctx.distanceMeters },
    ctx.destination
  )

  const transitMapsUrl =
    `https://www.google.com/maps/dir/?api=1&travelmode=transit`

  const walkMapsUrl =
    `https://www.google.com/maps/dir/?api=1&travelmode=walking`

  const walkingOption: TransferOption = {
    mode: "walk",
    totalMinutes: ctx.walkingMinutes,
    hint: buildWalkingHint(ctx.fromActivity, ctx.toActivity, ctx.destination),
    mapsUrl: walkMapsUrl,
  }

  const transitOption: TransferOption = {
    mode: "transit",
    totalMinutes: transit.totalMinutes,
    hint: `${transit.walkToStopMinutes} min a la parada + ${transit.waitMinutes} min espera + ${transit.rideMinutes} min de trayecto.`,
    mapsUrl: transitMapsUrl,
    fareAmount: transit.fareAmount,
    fareCurrency: transit.fareCurrency,
  }

  // Recommend transit when:
  // - user is tired (dayProgress > 0.6)
  // - distance forces it (mobility profile)
  // - OR it saves more than 8 min
  const timeSaving = ctx.walkingMinutes - transit.totalMinutes
  const userTired = ctx.dayProgress > 0.6
  const mobilityForced = shouldOfferTransitChoice(ctx.distanceMeters, ctx.mobilityProfileKey)

  const recommendTransit =
    (userTired && timeSaving >= 3) ||
    (mobilityForced && timeSaving >= 0) ||
    timeSaving >= 8

  let rationale: string
  if (mobilityForced && userTired) {
    rationale = `Con tu perfil de movilidad y la energía de esta hora, el transporte es la opción más cómoda.`
  } else if (userTired) {
    rationale = `Llevas ya un buen rato caminando. El transporte te llegará en ${transit.totalMinutes} min y te ahorrará ${timeSaving} min.`
  } else if (timeSaving >= 8) {
    rationale = `El transporte es ${timeSaving} min más rápido y cuesta solo ${transit.fareAmount}${transit.fareCurrency}.`
  } else {
    rationale = `Es un tramo cómodo a pie. ${walkingOption.hint}`
  }

  return { walkingOption, transitOption, recommendTransit, rationale }
}
