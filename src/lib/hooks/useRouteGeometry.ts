"use client"

import { useEffect, useState, useRef } from "react"

export type RouteMode = "foot" | "car" | "transit"

export interface RouteSegment {
  fromId: string
  toId: string
  coordinates: [number, number][] // [lat, lng]
  color: string
  mode: RouteMode
  distanceMeters?: number
  durationSeconds?: number
  /** For transit segments: line details */
  transitInfo?: {
    lineName: string
    lineShort: string
    vehicle: string
    color: string
    textColor: string
    departureStop: string
    arrivalStop: string
    stopCount: number
    headsign: string
  }
}

const osrmCache = new Map<string, { coords: [number, number][]; distance?: number; duration?: number }>()

const OSRM_BASE = "https://router.project-osrm.org/route/v1"

/** Haversine distance in meters */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Decode Google's encoded polyline to [lat, lng][] */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let b
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    points.push([lat / 1e5, lng / 1e5])
  }

  return points
}

async function fetchOsrmRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  profile: "foot" | "driving" = "foot"
): Promise<{ coords: [number, number][]; distance?: number; duration?: number } | null> {
  try {
    const osrmProfile = profile === "driving" ? "driving" : "foot"
    const url = `${OSRM_BASE}/${osrmProfile}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const route = data.routes?.[0]
    const coords = route?.geometry?.coordinates
    if (!coords) return null
    return {
      coords: coords.map((c: [number, number]) => [c[1], c[0]] as [number, number]),
      distance: route.distance,
      duration: route.duration,
    }
  } catch {
    return null
  }
}

export interface GeoActivity {
  id: string
  type: string
  lat: number
  lng: number
  name?: string
}

export interface UseRouteGeometryOptions {
  transportPrefs?: string[]
  maxWalkMeters?: number
  /** City name for transit route API */
  destination?: string
}

function resolveSegmentMode(
  distanceMeters: number,
  transportPrefs: string[],
  maxWalkMeters: number
): RouteMode {
  if (distanceMeters <= maxWalkMeters) return "foot"
  if (transportPrefs.includes("publico") || transportPrefs.includes("mix")) return "transit"
  if (transportPrefs.includes("coche") || transportPrefs.includes("taxi")) return "car"
  return "foot"
}

const MODE_COLORS: Record<RouteMode, string> = {
  foot: "#30D158",
  transit: "#32ADE6",
  car: "#FF9F0A",
}

export function useRouteGeometry(
  activities: GeoActivity[],
  typeColors: Record<string, string>,
  options: UseRouteGeometryOptions = {}
) {
  const { transportPrefs = [], maxWalkMeters = 1500, destination = "" } = options
  const [segments, setSegments] = useState<RouteSegment[]>([])
  const abortRef = useRef(false)
  const prefsKey = transportPrefs.join(",")

  useEffect(() => {
    const valid = activities.filter(
      (a) => typeof a.lat === "number" && typeof a.lng === "number" && !isNaN(a.lat) && !isNaN(a.lng)
    )
    if (valid.length < 2) {
      setSegments([])
      return
    }

    abortRef.current = false
    const result: RouteSegment[] = []
    const prefs = prefsKey ? prefsKey.split(",") : []

    async function fetchAll() {
      for (let i = 0; i < valid.length - 1; i++) {
        if (abortRef.current) break

        const from = valid[i]
        const to = valid[i + 1]
        const straightDist = haversineMeters(from.lat, from.lng, to.lat, to.lng)
        const mode = resolveSegmentMode(straightDist, prefs, maxWalkMeters)

        if (mode === "transit") {
          // Use Google Routes API via our endpoint for real transit data
          try {
            const params = new URLSearchParams({
              olat: from.lat.toString(),
              olng: from.lng.toString(),
              dlat: to.lat.toString(),
              dlng: to.lng.toString(),
              city: destination,
              oname: from.name ?? "",
              dname: to.name ?? "",
            })
            const res = await fetch(`/api/transit-route?${params}`)
            if (res.ok) {
              const { data } = await res.json()
              if (data?.steps?.length) {
                // Create sub-segments for each step (walk vs transit)
                for (const step of data.steps) {
                  if (abortRef.current) break
                  const coords = step.polyline ? decodePolyline(step.polyline) : []
                  if (coords.length < 2) continue

                  const isTransitStep = step.travelMode === "TRANSIT"
                  result.push({
                    fromId: from.id,
                    toId: to.id,
                    coordinates: coords,
                    color: isTransitStep
                      ? step.transitDetails?.color ?? MODE_COLORS.transit
                      : MODE_COLORS.foot,
                    mode: isTransitStep ? "transit" : "foot",
                    distanceMeters: undefined,
                    durationSeconds: undefined,
                    transitInfo: isTransitStep ? step.transitDetails : undefined,
                  })
                }
                setSegments([...result])
                // Rate limit
                if (i < valid.length - 2 && !abortRef.current) {
                  await new Promise((r) => setTimeout(r, 100))
                }
                continue
              }
            }
          } catch {
            // Fallback to OSRM below
          }
        }

        // OSRM fallback (foot or car)
        const osrmProfile = mode === "car" ? "driving" : "foot"
        const key = `${osrmProfile}:${from.lat.toFixed(5)},${from.lng.toFixed(5)}->${to.lat.toFixed(5)},${to.lng.toFixed(5)}`

        let cached = osrmCache.get(key) ?? null
        if (!cached) {
          cached = await fetchOsrmRoute(from.lat, from.lng, to.lat, to.lng, osrmProfile === "driving" ? "driving" : "foot")
          if (cached) osrmCache.set(key, cached)
        }

        if (cached && !abortRef.current) {
          result.push({
            fromId: from.id,
            toId: to.id,
            coordinates: cached.coords,
            color: MODE_COLORS[mode],
            mode,
            distanceMeters: cached.distance,
            durationSeconds: cached.duration,
          })
          setSegments([...result])
        }

        // Rate limit
        if (i < valid.length - 2 && !abortRef.current) {
          await new Promise((r) => setTimeout(r, 200))
        }
      }
    }

    fetchAll()
    return () => {
      abortRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, prefsKey, maxWalkMeters, destination])

  return segments
}
