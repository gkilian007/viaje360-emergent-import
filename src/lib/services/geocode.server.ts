/**
 * Server-side geocoding with multi-provider fallback:
 *   1. Photon (Komoot) — best for tourism POIs, lenient rate limits
 *   2. Nominatim (OSM) — broader coverage, stricter rate limits
 * Called once when the itinerary is generated so coordinates are persisted in the DB.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const PHOTON_URL = "https://photon.komoot.io/api"
const HEADERS = {
  Accept: "application/json",
  // Broad accept-language so Nominatim returns results for any language name
  "Accept-Language": "it,fr,de,ja,pt,es,en",
  "User-Agent": "Viaje360/1.0 (https://viaje360.app)",
}

// Bounding boxes for cities whose name matches their province/state
// Prevents Nominatim returning results from province instead of the city itself
const CITY_VIEWBOXES: Record<string, string> = {
  toledo: "-4.15,39.82,-3.95,39.92",
  madrid: "-3.85,40.30,-3.55,40.55",
  barcelona: "2.05,41.30,2.25,41.50",
  sevilla: "-6.05,37.30,-5.85,37.45",
  valencia: "-0.45,39.40,-0.30,39.55",
  granada: "-3.65,37.14,-3.55,37.22",
  córdoba: "-4.85,37.86,-4.75,37.92",
  cordoba: "-4.85,37.86,-4.75,37.92",
  bilbao: "-2.98,43.24,-2.88,43.30",
  málaga: "-4.48,36.69,-4.38,36.74",
  malaga: "-4.48,36.69,-4.38,36.74",
}

interface Coords {
  lat: number
  lng: number
}

async function searchNominatim(query: string, extra: Record<string, string> = {}): Promise<Coords | null> {
  try {
    const params = new URLSearchParams({ q: query, format: "json", limit: "1", ...extra })
    const res = await fetch(`${NOMINATIM_URL}?${params}`, { headers: HEADERS })
    if (!res.ok) return null

    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null

    const lat = parseFloat(data[0].lat)
    const lng = parseFloat(data[0].lon)
    if (!isFinite(lat) || !isFinite(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}

/**
 * Photon geocoder (Komoot) — excellent for tourism POIs.
 * Rate limits are more lenient than Nominatim.
 * Supports location bias via lat/lon params.
 */
async function searchPhoton(
  query: string,
  bias?: Coords
): Promise<Coords | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: "3",
      lang: "en",
    })
    if (bias) {
      params.set("lat", bias.lat.toString())
      params.set("lon", bias.lng.toString())
    }

    const res = await fetch(`${PHOTON_URL}?${params}`, {
      headers: { "User-Agent": "Viaje360/1.0 (https://viaje360.app)" },
    })
    if (!res.ok) return null

    const data = await res.json()
    const features = data?.features
    if (!Array.isArray(features) || features.length === 0) return null

    // Pick the best match: prefer tourism/historic POIs near the bias
    const best = bias ? pickBestPhotonMatch(features, bias) : features[0]
    const coords = best?.geometry?.coordinates
    if (!coords || coords.length < 2) return null

    const lat = coords[1]
    const lng = coords[0]
    if (!isFinite(lat) || !isFinite(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}

function pickBestPhotonMatch(
  features: Array<{
    properties?: { osm_key?: string; osm_value?: string }
    geometry?: { coordinates?: number[] }
  }>,
  bias: Coords
): (typeof features)[0] {
  const scored = features.map((f) => {
    let score = 0
    const props = f.properties ?? {}

    if (props.osm_key === "tourism") score += 10
    if (props.osm_key === "historic") score += 8
    if (props.osm_key === "amenity") score += 5
    if (props.osm_key === "leisure") score += 4
    if (props.osm_value === "museum") score += 8
    if (props.osm_value === "place_of_worship") score += 7

    const coords = f.geometry?.coordinates
    if (coords && coords.length >= 2) {
      const dLat = coords[1] - bias.lat
      const dLng = coords[0] - bias.lng
      const distKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111
      if (distKm > 50) score -= 20
      else if (distKm > 20) score -= 5
    }

    return { feature: f, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0].feature
}

/** Extract a shorter search term from compound names like "Foro Romano y Monte Palatino" */
function simplifyName(name: string): string | null {
  const parts = name.split(/\s+(?:y|e|&|and)\s+/i)
  if (parts.length > 1 && parts[0].trim().length > 3) {
    return parts[0].trim()
  }
  return null
}

/**
 * Spanish→local language translations for famous landmarks.
 * Nominatim indexes landmarks in their local language;
 * Spanish names for international sites fail ~100% of the time.
 */
const SPANISH_TO_LOCAL: Record<string, string> = {
  // Italian landmarks
  "coliseo romano": "Colosseo",
  "coliseo": "Colosseo",
  "foro romano": "Foro Romano",
  "ciudad del vaticano": "Città del Vaticano",
  "vaticano": "Vatican City",
  "plaza de san pedro": "Piazza San Pietro",
  "fontana de trevi": "Fontana di Trevi",
  "panteón de agripa": "Pantheon",
  "panteón": "Pantheon",
  "muralla aureliana": "Mura Aureliane",
  "basílica de san pedro": "Basilica di San Pietro",
  "galería borghese": "Galleria Borghese",
  "catacumbas de roma": "Catacombe di Roma",
  "palacio del quirinal": "Palazzo del Quirinale",
  "plaza navona": "Piazza Navona",
  "plaza de españa": "Piazza di Spagna",
  "escalinata de la trinidad": "Scalinata di Trinità dei Monti",
  "campo de fiori": "Campo de' Fiori",
  // French landmarks
  "torre eiffel": "Tour Eiffel",
  "museo del louvre": "Musée du Louvre",
  "louvre": "Musée du Louvre",
  "catedral de notre dame": "Cathédrale Notre-Dame de Paris",
  "notre dame": "Notre-Dame de Paris",
  "palacio de versalles": "Château de Versailles",
  "versalles": "Château de Versailles",
  "barrio montmartre": "Montmartre",
  "arco de triunfo": "Arc de Triomphe",
  "museo de orsay": "Musée d'Orsay",
  "cementerio pere lachaise": "Cimetière du Père-Lachaise",
  // Japanese landmarks
  "templo senso-ji": "Sensō-ji",
  "templo kinkaku-ji": "Kinkaku-ji",
  "monte fuji": "Mount Fuji",
  "palacio imperial de tokio": "Imperial Palace Tokyo",
  "santuario meiji": "Meiji Jingu",
  // German landmarks
  "puerta de brandeburgo": "Brandenburger Tor",
  "muro de berlín": "Berliner Mauer",
  "castillo de neuschwanstein": "Schloss Neuschwanstein",
  // Greek landmarks
  "acrópolis": "Acropolis of Athens",
  "partenón": "Parthenon",
  // UK landmarks
  "palacio de buckingham": "Buckingham Palace",
  "torre de londres": "Tower of London",
  "puente de la torre": "Tower Bridge",
  "parlamento de londres": "Palace of Westminster",
  "abadía de westminster": "Westminster Abbey",
  // US landmarks
  "estatua de la libertad": "Statue of Liberty",
  "central park": "Central Park",
  "times square": "Times Square",
  // Other
  "sagrada familia": "Sagrada Família",
  "park güell": "Parc Güell",
  "palau de la música catalana": "Palau de la Música Catalana",
}

function tryLocalName(name: string): string | null {
  const normalized = name.toLowerCase().trim()
  return SPANISH_TO_LOCAL[normalized] ?? null
}

/** Minimum delay between Nominatim requests (their policy: 1 req/s) */
const NOMINATIM_DELAY_MS = 1100

async function delayMs(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

/** Geocode a single activity location — returns coords or null.
 *  Strategy: try Photon first (faster, better for POIs), then Nominatim as fallback.
 */
async function geocodeLocation(
  name: string,
  location: string,
  destination: string,
  destBias?: Coords | null
): Promise<Coords | null> {
  const cityKey = destination.toLowerCase().trim()
  const viewbox = CITY_VIEWBOXES[cityKey]

  // Build a priority-ordered list of queries (most specific first)
  const queries: string[] = []

  // 1. The location field should already be a real address in local language
  queries.push(`${location}, ${destination}`)

  // 2. Try local-language name if we have a known translation
  const localName = tryLocalName(name)
  if (localName) {
    queries.push(`${localName}, ${destination}`)
    queries.push(localName)
  }

  // 3. Fallback: activity name + destination
  if (name !== location) {
    queries.push(`${name}, ${destination}`)
  }

  // 4. Simplified name for compound names
  const short = simplifyName(name)
  if (short) {
    queries.push(`${short}, ${destination}`)
  }

  // 5. Last resort: location alone (works well for proper street addresses)
  if (location && location !== name && location.length > 5) {
    queries.push(location)
  }

  // 6. Name alone
  if (name.length > 3 && !queries.includes(name)) {
    queries.push(name)
  }

  // Deduplicate while preserving order
  const seen = new Set<string>()
  const uniqueQueries = queries.filter(q => {
    const k = q.toLowerCase().trim()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  // Phase 1: Try Photon for all queries (faster, no strict rate limit)
  for (const query of uniqueQueries) {
    const result = await searchPhoton(query, destBias ?? undefined)
    if (result) return result
    await delayMs(200) // Photon is lenient, 200ms is plenty
  }

  // Phase 2: Fall back to Nominatim
  for (const query of uniqueQueries) {
    let result: Coords | null = null
    if (viewbox) {
      result = await searchNominatim(query, { viewbox, bounded: "1" })
    }
    if (!result) {
      result = await searchNominatim(query)
    }
    if (result) return result
    await delayMs(NOMINATIM_DELAY_MS)
  }

  return null
}

function hasValidCoords(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat !== 0 &&
    lng !== 0
  )
}

/** Quick geocode just the destination city to get a reference point for validation */
async function geocodeDestination(destination: string): Promise<Coords | null> {
  return searchNominatim(destination)
}

/** Check if coords are within ~200km of destination (catches LLM hallucinations) */
function isNearDestination(coords: Coords, destCoords: Coords, maxKm = 200): boolean {
  const R = 6371 // earth radius km
  const dLat = (coords.lat - destCoords.lat) * Math.PI / 180
  const dLng = (coords.lng - destCoords.lng) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(destCoords.lat * Math.PI / 180) * Math.cos(coords.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return dist <= maxKm
}

import type { GeneratedItinerary, GeneratedActivity } from "@/lib/supabase/database.types"

/**
 * Geocode all activities in the itinerary that lack valid coordinates.
 * Mutates the itinerary in place and returns it.
 * Runs requests with a small delay to respect Nominatim usage policy (max 1 req/s).
 */
export async function geocodeItinerary(
  itinerary: GeneratedItinerary,
  destination: string
): Promise<GeneratedItinerary> {
  // Get destination reference point for validating LLM coords
  const destCoords = await geocodeDestination(destination)
  if (destCoords) {
    await delayMs(NOMINATIM_DELAY_MS)
  }

  // Phase 1: Validate LLM-provided coords — reject if too far from destination
  let llmOk = 0
  let llmRejected = 0
  for (const day of itinerary.days) {
    for (const act of day.activities) {
      if (hasValidCoords(act.lat, act.lng)) {
        if (destCoords && !isNearDestination({ lat: act.lat!, lng: act.lng! }, destCoords)) {
          // LLM hallucinated coords far from destination — clear them
          act.lat = undefined
          act.lng = undefined
          llmRejected++
        } else {
          llmOk++
        }
      }
    }
  }

  // Phase 2: Collect activities still needing geocoding
  const tasks: { activity: GeneratedActivity; index: string }[] = []
  for (const day of itinerary.days) {
    for (let i = 0; i < day.activities.length; i++) {
      const act = day.activities[i]
      if (!hasValidCoords(act.lat, act.lng) && act.location) {
        tasks.push({ activity: act, index: `d${day.dayNumber}-a${i}` })
      }
    }
  }

  if (tasks.length === 0) {
    console.info(`[geocode] all ${llmOk} activities have valid LLM coords (${llmRejected} rejected)`)
    return itinerary
  }

  console.info(`[geocode] ${llmOk} LLM coords ok, ${llmRejected} rejected, ${tasks.length} need Nominatim for "${destination}"`)

  // Use a simple cache for duplicate locations within same itinerary
  const cache = new Map<string, Coords | null>()

  for (let i = 0; i < tasks.length; i++) {
    const { activity, index } = tasks[i]
    const cacheKey = `${activity.name}|${activity.location}|${destination}`.toLowerCase()

    let coords: Coords | null
    if (cache.has(cacheKey)) {
      coords = cache.get(cacheKey)!
    } else {
      coords = await geocodeLocation(activity.name, activity.location!, destination, destCoords)
      cache.set(cacheKey, coords)
    }

    if (coords) {
      activity.lat = coords.lat
      activity.lng = coords.lng
    } else {
      console.warn(`[geocode] failed for ${index}: "${activity.name}" @ "${activity.location}"`)
    }
  }

  const resolved = tasks.filter(t => hasValidCoords(t.activity.lat, t.activity.lng)).length
  console.info(`[geocode] resolved ${resolved}/${tasks.length} activities`)

  return itinerary
}

/**
 * Fast validation-only pass — no Nominatim calls, just removes hallucinated LLM coords.
 * Use this inline during generation to keep response time <5s.
 * Full geocoding (filling missing coords via Nominatim) runs in background after save.
 */
export async function geocodeItineraryFast(
  itinerary: GeneratedItinerary,
  destination: string
): Promise<GeneratedItinerary> {
  // Try Photon first (faster), then Nominatim
  const destCoords = await searchPhoton(destination) ?? await geocodeDestination(destination)

  if (!destCoords) return itinerary

  for (const day of itinerary.days) {
    for (const act of day.activities) {
      if (hasValidCoords(act.lat, act.lng)) {
        if (!isNearDestination({ lat: act.lat!, lng: act.lng! }, destCoords)) {
          act.lat = undefined
          act.lng = undefined
        }
      }
    }
  }

  return itinerary
}
