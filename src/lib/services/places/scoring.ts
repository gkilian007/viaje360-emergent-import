import type { NormalizedPlace } from "./types"

export interface ScoringContext {
  /** Accommodation coordinates for distance scoring */
  accommodationLat?: number
  accommodationLng?: number
  /** Current weather for indoor/outdoor preference */
  weatherCondition?: string
  /** User preferences from filters */
  filters?: {
    kidFriendly?: boolean
    petFriendly?: boolean
    dietary?: string[]
    accessible?: boolean
    type?: string
    budget?: string
  }
  /** Current time for opening hours scoring */
  currentTime?: string
}

interface ScoredPlace extends NormalizedPlace {
  score: number
}

/**
 * Score and rank place candidates.
 * Higher score = better match. Returns sorted descending.
 */
export function scorePlaces(
  places: NormalizedPlace[],
  context: ScoringContext
): NormalizedPlace[] {
  if (places.length === 0) return []

  const scored: ScoredPlace[] = places.map((place) => ({
    ...place,
    score: computeScore(place, context),
  }))

  scored.sort((a, b) => b.score - a.score)

  // Strip internal score from output
  return scored.map(({ score: _score, ...place }) => place)
}

function computeScore(place: NormalizedPlace, ctx: ScoringContext): number {
  let score = 0
  const filters = ctx.filters ?? {}

  // --- Rating (0-25 pts) ---
  if (place.rating != null) {
    score += (place.rating / 5) * 25
  } else {
    score += 10 // neutral for unknown
  }

  // --- Kid/Pet friendliness match (0-15 pts each) ---
  if (filters.kidFriendly) {
    score += place.kidFriendly ? 15 : -5
  }
  if (filters.petFriendly) {
    score += place.petFriendly ? 15 : -5
  }

  // --- Accessibility (0-15 pts) ---
  if (filters.accessible) {
    score += place.accessible ? 15 : -10
  }

  // --- Dietary fit (0-15 pts) ---
  if (filters.dietary && filters.dietary.length > 0) {
    const matched = filters.dietary.filter((d) =>
      place.dietaryOptions.some(
        (opt) => opt.toLowerCase().includes(d.toLowerCase())
      )
    )
    score += (matched.length / filters.dietary.length) * 15
  }

  // --- Budget level (0-10 pts) ---
  if (filters.budget && place.priceLevel) {
    score += scoreBudgetMatch(place.priceLevel, filters.budget)
  }

  // --- Weather fit: indoor/outdoor (0-10 pts) ---
  if (ctx.weatherCondition) {
    const isBadWeather = isBadWeatherCondition(ctx.weatherCondition)
    if (isBadWeather && place.indoor) {
      score += 10
    } else if (!isBadWeather && place.indoor === false) {
      score += 5 // slight bonus for outdoor on good weather
    }
  }

  // --- Distance from accommodation (0-15 pts) ---
  if (
    ctx.accommodationLat != null &&
    ctx.accommodationLng != null &&
    place.lat != null &&
    place.lng != null
  ) {
    const dist = haversineKm(
      ctx.accommodationLat,
      ctx.accommodationLng,
      place.lat,
      place.lng
    )
    // Closer = more points; max 15 pts at 0km, 0 pts at 10km+
    score += Math.max(0, 15 - dist * 1.5)
  }

  // --- Opening hours rough match (0-5 pts) ---
  if (place.openingHours && ctx.currentTime) {
    score += isLikelyOpen(place.openingHours, ctx.currentTime) ? 5 : -2
  }

  return Math.max(0, score)
}

function scoreBudgetMatch(priceLevel: string, budget: string): number {
  const priceTier = priceLevel.length // €=1, €€=2, etc.
  const budgetMap: Record<string, number> = {
    economico: 1,
    moderado: 2,
    premium: 4,
  }
  const target = budgetMap[budget] ?? 2
  const diff = Math.abs(priceTier - target)
  return Math.max(0, 10 - diff * 3)
}

function isBadWeatherCondition(condition: string): boolean {
  const bad = [
    "lluvia",
    "tormenta",
    "chubascos",
    "nieve",
    "rain",
    "storm",
    "thunder",
    "snow",
  ]
  const lower = condition.toLowerCase()
  return bad.some((b) => lower.includes(b))
}

function isLikelyOpen(hours: string, currentTime: string): boolean {
  // Simple heuristic: parse "9:00-20:00" style
  const match = hours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)
  if (!match) return true // if can't parse, assume open

  const [, oh, om, ch, cm] = match
  const open = parseInt(oh) * 60 + parseInt(om)
  const close = parseInt(ch) * 60 + parseInt(cm)

  const timeParts = currentTime.match(/(\d{1,2}):(\d{2})/)
  if (!timeParts) return true
  const now = parseInt(timeParts[1]) * 60 + parseInt(timeParts[2])

  return now >= open && now <= close
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
