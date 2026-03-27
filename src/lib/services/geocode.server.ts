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
  const parts = name.split(/\s+(?:y|e|&|and)\s+/i)
  if (parts.length > 1 && parts[0].trim().length > 3) {
    return parts[0].trim()
  }
  return null
}

/** Minimum delay between Nominatim requests (their policy: 1 req/s) */
const NOMINATIM_DELAY_MS = 1100

async function delayMs(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

/** Geocode a single activity location — returns coords or null.
 *  Each call to searchNominatim counts as 1 request; we space them apart.
 */
async function geocodeLocation(
  name: string,
  location: string,
  destination: string
): Promise<Coords | null> {
  // Build a priority-ordered list of queries (most specific first)
  const queries: string[] = []

  // The location field should already be a real address in local language
  queries.push(`${location}, ${destination}`)

  // Fallback: activity name + destination
  if (name !== location) {
    queries.push(`${name}, ${destination}`)
  }

  // Fallback: simplified name for compound names
  const short = simplifyName(name)
  if (short) {
    queries.push(`${short}, ${destination}`)
  }

  for (const query of queries) {
    const result = await searchNominatim(query)
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
    console.log(`[geocode] all ${llmOk} activities have valid LLM coords (${llmRejected} rejected)`)
    return itinerary
  }

  console.log(`[geocode] ${llmOk} LLM coords ok, ${llmRejected} rejected, ${tasks.length} need Nominatim for "${destination}"`)

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
      // geocodeLocation already handles delays between its own Nominatim calls
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
