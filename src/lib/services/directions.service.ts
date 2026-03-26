const OSRM_BASE = "https://router.project-osrm.org/route/v1/walking"

interface DirectionsResult {
  walkingMinutes: number
  distanceMeters: number
  mapsUrl: string
}

export async function getWalkingDirections(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<DirectionsResult | null> {
  try {
    const url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}?overview=false`
    const res = await fetch(url, { next: { revalidate: 86400 } }) // cache 24h
    if (!res.ok) return null

    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return null

    const walkingMinutes = Math.round(route.duration / 60)
    const distanceMeters = Math.round(route.distance)
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=walking`

    return { walkingMinutes, distanceMeters, mapsUrl }
  } catch {
    return null
  }
}
