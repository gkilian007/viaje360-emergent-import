/**
 * POST /api/trips/backfill-geocode
 * Geocodes all activities in the user's active trip that have null lat/lng.
 * Called once on /plan page load for legacy trips.
 */
import { NextRequest } from "next/server"
import { normalizeRouteError, successResponse } from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { createServiceClient } from "@/lib/supabase/server"

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const HEADERS = {
  Accept: "application/json",
  "Accept-Language": "es,en,it,fr,de,pt",
  "User-Agent": "Viaje360/1.0 (https://viaje360.app)",
}

async function geocodeSingle(query: string): Promise<{ lat: number; lng: number } | null> {
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

function simplify(name: string): string | null {
  const parts = name.split(/\s+(?:y|e|&|and)\s+/i)
  return parts.length > 1 ? parts[0].trim() : null
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export async function POST(request: NextRequest) {
  try {
    const identity = await resolveRequestIdentity()
    if (!identity.userId) {
      return successResponse({ updated: 0 })
    }

    const supabase = createServiceClient()

    // Get active trip
    const { data: trip } = await supabase
      .from("trips")
      .select("id, destination")
      .eq("user_id", identity.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!trip) return successResponse({ updated: 0 })

    const destination = String(trip.destination ?? "")

    // Fetch activities that have no lat/lng
    const { data: activities } = await supabase
      .from("activities")
      .select("id, name, location, latitude, longitude, neighborhood")
      .eq("trip_id", trip.id)
      .or("latitude.is.null,longitude.is.null")
      .limit(80) // reasonable cap

    if (!activities || activities.length === 0) {
      return successResponse({ updated: 0, message: "No activities need geocoding" })
    }

    console.log(`[backfill-geocode] ${activities.length} activities without coords for trip ${trip.id} (${destination})`)

    const cache = new Map<string, { lat: number; lng: number } | null>()
    let updated = 0

    for (const act of activities) {
      const location = act.location ?? act.neighborhood ?? ""
      if (!location) continue

      const cacheKey = `${act.name}|${location}|${destination}`.toLowerCase()

      let coords: { lat: number; lng: number } | null
      if (cache.has(cacheKey)) {
        coords = cache.get(cacheKey)!
      } else {
        // Try location + destination first
        coords = await geocodeSingle(`${location}, ${destination}`)
        if (!coords) await delay(1100)

        // Try name + destination
        if (!coords) {
          coords = await geocodeSingle(`${act.name}, ${destination}`)
          if (!coords) await delay(1100)
        }

        // Try simplified name
        if (!coords) {
          const short = simplify(act.name)
          if (short) {
            coords = await geocodeSingle(`${short}, ${destination}`)
            if (!coords) await delay(1100)
          }
        }

        cache.set(cacheKey, coords)
        // Rate limit between different locations
        if (coords) await delay(1100)
      }

      if (coords) {
        await supabase
          .from("activities")
          .update({ latitude: coords.lat, longitude: coords.lng })
          .eq("id", act.id)
        updated++
      }
    }

    console.log(`[backfill-geocode] updated ${updated}/${activities.length} activities`)
    return successResponse({ updated, total: activities.length })
  } catch (error) {
    console.error("backfill-geocode error:", error)
    return normalizeRouteError(error, "Failed to geocode activities")
  }
}
