/**
 * Affiliate link generator for booking integrations.
 *
 * Strategy: we build tracked links to affiliate partners (GetYourGuide, Viator,
 * TheFork, Booking.com) based on activity type, name and destination.
 * No API keys needed — affiliate links are URL-based.
 *
 * Revenue model: commission per completed booking (typical 5–8% for experiences,
 * 3–5% for hotels, ~10% for restaurants via TheFork).
 */

export interface AffiliateLink {
  provider: string
  label: string
  url: string
  emoji: string
  cta: string
  /** Whether this is a high-confidence match (activity name found in URL) */
  confidence: "high" | "medium" | "low"
}

// ─── GetYourGuide ─────────────────────────────────────────────────────────────
// Affiliate partner ID would go in PARTNER_ID. For now uses public search URL.
// Real affiliate: https://partner.getyourguide.com

const GYG_PARTNER_ID = process.env.NEXT_PUBLIC_GYG_PARTNER_ID ?? ""

function buildGetYourGuideUrl(activityName: string, destination: string): string {
  const q = encodeURIComponent(`${activityName} ${destination}`)
  const base = `https://www.getyourguide.com/s/?q=${q}&partner_id=${GYG_PARTNER_ID}`
  return GYG_PARTNER_ID ? base : `https://www.getyourguide.com/s/?q=${q}`
}

// ─── Viator ──────────────────────────────────────────────────────────────────
// Affiliate: https://www.viator.com/tourism/affiliate-program.html

const VIATOR_CAMPAIGN = process.env.NEXT_PUBLIC_VIATOR_CAMPAIGN ?? "VIAJE360"

function buildViatorUrl(activityName: string, destination: string): string {
  const q = encodeURIComponent(`${activityName} ${destination}`)
  return `https://www.viator.com/searchResults/all?text=${q}&pid=P00134994&mcid=42383&medium=link&campaign=${VIATOR_CAMPAIGN}`
}

// ─── TheFork ─────────────────────────────────────────────────────────────────
// TheFork partner: https://partner.thefork.com
// For public search (no partner ID yet):

function buildTheForkUrl(restaurantName: string, destination: string): string {
  const q = encodeURIComponent(restaurantName)
  const city = encodeURIComponent(destination)
  return `https://www.thefork.es/restaurante/?searchText=${q}&location=${city}&source=viaje360`
}

// ─── Booking.com ──────────────────────────────────────────────────────────────
// Affiliate program: https://www.booking.com/affiliate-program/

function buildBookingUrl(destination: string): string {
  const city = encodeURIComponent(destination)
  return `https://www.booking.com/searchresults.html?ss=${city}&label=viaje360&aid=304142`
}

// ─── Activity type classification ────────────────────────────────────────────

const EXPERIENCE_TYPES = new Set([
  "aventura", "deportes", "cultural", "historia", "arte",
  "naturaleza", "outdoor", "tour", "familiar",
])

const RESTAURANT_TYPES = new Set(["gastronomia", "restaurant", "food"])

const HOTEL_TYPES = new Set(["hotel", "alojamiento", "accommodation"])

// Activities whose names suggest a guided tour or ticketed experience
const EXPERIENCE_KEYWORDS = /tour|visita|excursión|entrada|ticket|museo|galería|taller|clase|ruta|escape/i

// ─── Main builder ─────────────────────────────────────────────────────────────

export interface ActivityAffiliateContext {
  name: string
  type: string
  destination: string
  cost?: number
}

export function buildAffiliateLinks(ctx: ActivityAffiliateContext): AffiliateLink[] {
  const { name, type, destination, cost = 0 } = ctx
  const links: AffiliateLink[] = []

  const isRestaurant = RESTAURANT_TYPES.has(type)
  const isHotel = HOTEL_TYPES.has(type)
  const isExperience = EXPERIENCE_TYPES.has(type) || EXPERIENCE_KEYWORDS.test(name)

  if (isRestaurant) {
    links.push({
      provider: "thefork",
      label: "TheFork",
      emoji: "🍽️",
      cta: "Reservar mesa",
      url: buildTheForkUrl(name, destination),
      confidence: "medium",
    })
  }

  if (isExperience && cost > 0) {
    // Paid experiences → GetYourGuide first, Viator as alternative
    links.push({
      provider: "getyourguide",
      label: "GetYourGuide",
      emoji: "🎟️",
      cta: "Ver entradas",
      url: buildGetYourGuideUrl(name, destination),
      confidence: "medium",
    })
    links.push({
      provider: "viator",
      label: "Viator",
      emoji: "🗺️",
      cta: "Ver tours",
      url: buildViatorUrl(name, destination),
      confidence: "low",
    })
  }

  if (isHotel) {
    links.push({
      provider: "booking",
      label: "Booking.com",
      emoji: "🛏️",
      cta: "Ver disponibilidad",
      url: buildBookingUrl(destination),
      confidence: "low",
    })
  }

  // For museums / monuments with known cost — GetYourGuide skip-the-line tickets
  if (!isRestaurant && !isHotel && isExperience && cost === 0) {
    // Free attractions sometimes have paid guided tours
    links.push({
      provider: "getyourguide",
      label: "GetYourGuide",
      emoji: "🎟️",
      cta: "Tours guiados",
      url: buildGetYourGuideUrl(name, destination),
      confidence: "low",
    })
  }

  return links.slice(0, 2) // max 2 affiliate links per activity to avoid noise
}
