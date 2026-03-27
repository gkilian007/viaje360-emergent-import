/**
 * Server-side geocoding using Nominatim.
 * Called once when the itinerary is generated so coordinates are persisted in the DB.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const HEADERS = {
  Accept: "application/json",
  "Accept-Language": "es,en,it,fr,de,pt",
  "User-Agent": "Viaje360/1.0 (https://viaje360.app)",
}

interface Coords {
  lat: number
  lng: number
}

async function searchNominatim(query: string): Promise<Coords | null> {
  try {
    const params = new URLSearchParams({ q: query, format: "json", limit: "1" })
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

/** Extract a shorter search term from compound names like "Foro Romano y Monte Palatino" */
function simplifyName(name: string): string | null {
  // Split on " y ", " e ", " & ", " and "
  const parts = name.split(/\s+(?:y|e|&|and)\s+/i)
  if (parts.length > 1 && parts[0].trim().length > 3) {
    return parts[0].trim()
  }
  return null
}

/** Geocode a single activity location with destination context and multiple fallback strategies */
async function geocodeLocation(
  name: string,
  location: string,
  destination: string
): Promise<Coords | null> {
  // Strategy 1: location + destination context
  let result = await searchNominatim(`${location}, ${destination}`)
  if (result) return result

  // Strategy 2: activity name + destination
  result = await searchNominatim(`${name}, ${destination}`)
  if (result) return result

  // Strategy 3: simplified name (before "y"/"&") + destination
  const short = simplifyName(name)
  if (short) {
    result = await searchNominatim(`${short}, ${destination}`)
    if (result) return result
  }

  // Strategy 4: location alone
  result = await searchNominatim(location)
  return result
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
  // Collect activities needing geocoding
  const tasks: { activity: GeneratedActivity; index: string }[] = []
  for (const day of itinerary.days) {
    for (let i = 0; i < day.activities.length; i++) {
      const act = day.activities[i]
      if (!hasValidCoords(act.lat, act.lng) && act.location) {
        tasks.push({ activity: act, index: `d${day.dayNumber}-a${i}` })
      }
    }
  }

  if (tasks.length === 0) return itinerary

  console.log(`[geocode] server-side geocoding ${tasks.length} activities for "${destination}"`)

  // Use a simple cache for duplicate locations within same itinerary
  const cache = new Map<string, Coords | null>()

  for (let i = 0; i < tasks.length; i++) {
    const { activity, index } = tasks[i]
    const cacheKey = `${activity.name}|${activity.location}|${destination}`.toLowerCase()

    let coords: Coords | null
    if (cache.has(cacheKey)) {
      coords = cache.get(cacheKey)!
    } else {
      coords = await geocodeLocation(activity.name, activity.location!, destination)
      cache.set(cacheKey, coords)

      // Respect Nominatim rate limit: 1 req/s (we already did up to 3 requests per location)
      // Small delay between unique lookups
      if (i < tasks.length - 1 && !cache.has(
        `${tasks[i + 1].activity.name}|${tasks[i + 1].activity.location}|${destination}`.toLowerCase()
      )) {
        await new Promise(r => setTimeout(r, 350))
      }
    }

    if (coords) {
      activity.lat = coords.lat
      activity.lng = coords.lng
    } else {
      console.warn(`[geocode] failed for ${index}: "${activity.name}" @ "${activity.location}"`)
    }
  }

  const resolved = tasks.filter(t => hasValidCoords(t.activity.lat, t.activity.lng)).length
  console.log(`[geocode] resolved ${resolved}/${tasks.length} activities`)

  return itinerary
}
