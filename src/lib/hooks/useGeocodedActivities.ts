"use client"

import { useState, useEffect, useRef } from "react"
import type { TimelineActivity } from "@/lib/types"

interface GeocodedActivity {
  activity: TimelineActivity
  lat: number
  lng: number
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

async function geocodeClient(
  query: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
    })

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { Accept: "application/json" },
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
 * Geocode activities for the current day.
 * If activities already have lat/lng (from Gemini), use them immediately.
 * Falls back to Nominatim for activities without coordinates.
 * Caches results in a ref so re-renders don't re-fetch.
 */
export function useGeocodedActivities(
  activities: TimelineActivity[],
  destination: string
) {
  const [geocoded, setGeocoded] = useState<GeocodedActivity[]>([])
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef(new Map<string, { lat: number; lng: number } | null>())
  const abortRef = useRef(false)

  useEffect(() => {
    if (!activities.length || !destination) {
      setGeocoded([])
      setLoading(false)
      return
    }

    abortRef.current = false

    // Separate activities with and without coordinates
    const withCoords: GeocodedActivity[] = []
    const needsGeocoding: TimelineActivity[] = []

    for (const activity of activities) {
      if (activity.lat != null && activity.lng != null && activity.lat !== 0 && activity.lng !== 0) {
        withCoords.push({ activity, lat: activity.lat, lng: activity.lng })
      } else {
        needsGeocoding.push(activity)
      }
    }

    // Show pre-geocoded activities immediately
    if (withCoords.length > 0) {
      setGeocoded(withCoords)
    }

    // If all activities have coords, we're done
    if (needsGeocoding.length === 0) {
      setGeocoded(withCoords)
      setLoading(false)
      return
    }

    setLoading(true)

    async function run() {
      const results: GeocodedActivity[] = [...withCoords]
      const cache = cacheRef.current

      for (const activity of needsGeocoding) {
        if (abortRef.current) break

        const hasFullAddress = activity.location.includes(",")
        const cacheKey = `${activity.name}|${activity.location}|${destination}`.toLowerCase()

        if (cache.has(cacheKey)) {
          const cached = cache.get(cacheKey)
          if (cached) results.push({ activity, ...cached })
          continue
        }

        const queries = hasFullAddress
          ? [activity.location, `${activity.name}, ${destination}`]
          : [`${activity.name}, ${destination}`]

        let coords: { lat: number; lng: number } | null = null
        for (const query of queries) {
          coords = await geocodeClient(query)
          if (coords) break
          if (!abortRef.current) {
            await new Promise((r) => setTimeout(r, 1100))
          }
        }
        cache.set(cacheKey, coords)

        if (coords && !abortRef.current) {
          results.push({ activity, ...coords })
          setGeocoded([...results])
        }

        if (!abortRef.current) {
          await new Promise((r) => setTimeout(r, 1100))
        }
      }

      if (!abortRef.current) {
        setGeocoded(results)
        setLoading(false)
      }
    }

    run()

    return () => {
      abortRef.current = true
    }
  }, [activities, destination])

  // Center of all geocoded points
  const center =
    geocoded.length > 0
      ? {
          lat: geocoded.reduce((sum, g) => sum + g.lat, 0) / geocoded.length,
          lng: geocoded.reduce((sum, g) => sum + g.lng, 0) / geocoded.length,
        }
      : null

  return { geocoded, center, loading }
}
