"use client"

import { useEffect, useState, useRef } from "react"

interface RouteSegment {
  fromId: string
  toId: string
  coordinates: [number, number][] // [lat, lng]
  color: string
}

const cache = new Map<string, [number, number][]>()

const OSRM_URL = "https://router.project-osrm.org/route/v1/walking"

async function fetchRouteGeometry(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<[number, number][] | null> {
  try {
    const url = `${OSRM_URL}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    const coords = data.routes?.[0]?.geometry?.coordinates
    if (!coords) return null

    // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
    return coords.map((c: [number, number]) => [c[1], c[0]] as [number, number])
  } catch {
    return null
  }
}

interface GeoActivity {
  id: string
  type: string
  lat: number
  lng: number
}

export function useRouteGeometry(activities: GeoActivity[], typeColors: Record<string, string>) {
  const [segments, setSegments] = useState<RouteSegment[]>([])
  const abortRef = useRef(false)

  useEffect(() => {
    if (activities.length < 2) {
      setSegments([])
      return
    }

    abortRef.current = false
    const result: RouteSegment[] = []

    async function fetchAll() {
      for (let i = 0; i < activities.length - 1; i++) {
        if (abortRef.current) break

        const from = activities[i]
        const to = activities[i + 1]
        const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}->${to.lat.toFixed(5)},${to.lng.toFixed(5)}`

        let coords = cache.get(key) ?? null
        if (!coords) {
          coords = await fetchRouteGeometry(from.lat, from.lng, to.lat, to.lng)
          if (coords) cache.set(key, coords)
        }

        if (coords && !abortRef.current) {
          result.push({
            fromId: from.id,
            toId: to.id,
            coordinates: coords,
            color: typeColors[to.type] ?? "#5856D6",
          })
          setSegments([...result])
        }

        // Rate limit
        if (i < activities.length - 2 && !abortRef.current) {
          await new Promise(r => setTimeout(r, 200))
        }
      }
    }

    fetchAll()
    return () => { abortRef.current = true }
  }, [activities, typeColors])

  return segments
}
