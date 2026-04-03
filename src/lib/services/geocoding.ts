const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const PHOTON_URL = "https://photon.komoot.io/api"
const CACHE = new Map<string, { lat: number; lng: number } | null>()

/**
 * Geocode a place name + destination to lat/lng.
 * Strategy:
 *   1. Photon (Komoot) — better for POIs like "Catedral de Sevilla"
 *   2. Nominatim fallback — broader coverage
 *   3. Nominatim with just place name (no destination) — last resort
 *
 * Uses destination city coordinates as location bias when available.
 */
export async function geocode(
  placeName: string,
  destination: string
): Promise<{ lat: number; lng: number } | null> {
  const query = `${placeName}, ${destination}`
  const cacheKey = query.toLowerCase().trim()

  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey) ?? null

  // Try Photon first (better POI matching)
  const photonResult = await geocodePhoton(placeName, destination)
  if (photonResult) {
    CACHE.set(cacheKey, photonResult)
    return photonResult
  }

  // Fallback to Nominatim with full query
  const nominatimResult = await geocodeNominatim(`${placeName}, ${destination}`)
  if (nominatimResult) {
    CACHE.set(cacheKey, nominatimResult)
    return nominatimResult
  }

  // Last resort: Nominatim with structured query
  const structuredResult = await geocodeNominatimStructured(placeName, destination)
  if (structuredResult) {
    CACHE.set(cacheKey, structuredResult)
    return structuredResult
  }

  CACHE.set(cacheKey, null)
  return null
}

/**
 * Photon geocoder (Komoot) — excellent for tourism POIs.
 * Supports location bias to prefer results near the destination.
 */
async function geocodePhoton(
  placeName: string,
  destination: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    // First get approximate destination coordinates for bias
    const destCoords = await getDestinationBias(destination)

    const params = new URLSearchParams({
      q: `${placeName} ${destination}`,
      limit: "3",
      lang: "es",
    })

    // Add location bias if we have destination coordinates
    if (destCoords) {
      params.set("lat", destCoords.lat.toString())
      params.set("lon", destCoords.lng.toString())
    }

    const res = await fetch(`${PHOTON_URL}?${params}`, {
      headers: { "User-Agent": "Viaje360/1.0 (travel-planning-app)" },
    })

    if (!res.ok) return null

    const data = await res.json()
    const features = data?.features
    if (!Array.isArray(features) || features.length === 0) return null

    // Pick the best match: prefer tourism/amenity POIs, and results
    // that are geographically close to the destination
    const best = destCoords
      ? pickBestMatch(features, destCoords)
      : features[0]

    const coords = best?.geometry?.coordinates
    if (!coords || coords.length < 2) return null

    return { lat: coords[1], lng: coords[0] }
  } catch {
    return null
  }
}

/**
 * Pick the best Photon result based on:
 * 1. Type preference (tourism > amenity > other)
 * 2. Distance to destination (closer is better)
 */
function pickBestMatch(
  features: Array<{
    properties?: { osm_key?: string; osm_value?: string; city?: string; country?: string }
    geometry?: { coordinates?: number[] }
  }>,
  destCoords: { lat: number; lng: number }
): (typeof features)[0] {
  const scored = features.map((f) => {
    let score = 0
    const props = f.properties ?? {}

    // Prefer tourism POIs
    if (props.osm_key === "tourism") score += 10
    if (props.osm_key === "amenity") score += 5
    if (props.osm_key === "historic") score += 8
    if (props.osm_key === "leisure") score += 4
    if (props.osm_value === "museum") score += 8
    if (props.osm_value === "place_of_worship") score += 7

    // Distance penalty (rough km)
    const coords = f.geometry?.coordinates
    if (coords && coords.length >= 2) {
      const dLat = coords[1] - destCoords.lat
      const dLng = coords[0] - destCoords.lng
      const distKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111
      // Penalize results far from destination (>50km is suspicious)
      if (distKm > 50) score -= 20
      else if (distKm > 20) score -= 5
    }

    return { feature: f, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0].feature
}

// Cache for destination center coordinates
const DEST_CACHE = new Map<string, { lat: number; lng: number }>()

/**
 * Get approximate center coordinates for a destination city.
 * Used as location bias for POI geocoding.
 */
async function getDestinationBias(
  destination: string
): Promise<{ lat: number; lng: number } | null> {
  const key = destination.toLowerCase().trim()
  if (DEST_CACHE.has(key)) return DEST_CACHE.get(key)!

  const result = await geocodeNominatim(destination)
  if (result) {
    DEST_CACHE.set(key, result)
  }
  return result
}

async function geocodeNominatim(
  query: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
      addressdetails: "0",
    })

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        "User-Agent": "Viaje360/1.0 (travel-planning-app)",
        Accept: "application/json",
      },
    })

    if (!res.ok) return null

    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null

    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

/**
 * Nominatim structured query — searches POI within a specific city.
 * More precise than free-text when the place name is ambiguous.
 */
async function geocodeNominatimStructured(
  placeName: string,
  city: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const params = new URLSearchParams({
      q: placeName,
      format: "json",
      limit: "3",
      addressdetails: "1",
      viewbox: "", // Will be set if we have city coords
      bounded: "0",
    })

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        "User-Agent": "Viaje360/1.0 (travel-planning-app)",
        Accept: "application/json",
      },
    })

    if (!res.ok) return null

    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null

    // If we have multiple results, prefer the one closest to the city
    const destCoords = DEST_CACHE.get(city.toLowerCase().trim())
    if (destCoords && data.length > 1) {
      data.sort((a: { lat: string; lon: string }, b: { lat: string; lon: string }) => {
        const distA = Math.abs(parseFloat(a.lat) - destCoords.lat) + Math.abs(parseFloat(a.lon) - destCoords.lng)
        const distB = Math.abs(parseFloat(b.lat) - destCoords.lat) + Math.abs(parseFloat(b.lon) - destCoords.lng)
        return distA - distB
      })
    }

    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

/**
 * Batch geocode multiple places.
 * Pre-fetches destination coordinates once, then geocodes POIs
 * with location bias for much better accuracy.
 * Uses 500ms delay between requests to respect rate limits.
 */
export async function batchGeocode(
  items: Array<{ name: string; location: string; destination: string }>
): Promise<Map<string, { lat: number; lng: number }>> {
  const results = new Map<string, { lat: number; lng: number }>()

  // Pre-warm destination cache for location bias
  const destinations = [...new Set(items.map((i) => i.destination))]
  for (const dest of destinations) {
    await getDestinationBias(dest)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  for (const item of items) {
    const key = `${item.name}|${item.location}`
    const searchName = item.location
      ? `${item.name} ${item.location}`
      : item.name
    const coords = await geocode(searchName, item.destination)
    if (coords) {
      results.set(key, coords)
    }
    // Rate limit: 500ms between requests (Photon is more lenient than Nominatim)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return results
}
