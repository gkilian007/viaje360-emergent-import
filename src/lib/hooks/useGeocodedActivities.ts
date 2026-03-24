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
 * Caches results in a ref so re-renders don't re-fetch.
 * Serializes requests (1.1s gap) to respect Nominatim limits.
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
    setLoading(true)

    async function run() {
      const results: GeocodedActivity[] = []
      const cache = cacheRef.current

      for (const activity of activities) {
        if (abortRef.current) break

        // Use the activity location directly if it looks like a full address
        const hasFullAddress = activity.location.includes(",")
        const cacheKey = `${activity.name}|${activity.location}|${destination}`.toLowerCase()

        if (cache.has(cacheKey)) {
          const cached = cache.get(cacheKey)
          if (cached) results.push({ activity, ...cached })
          continue
        }

        // Try full address first, then name + destination as fallback
        const queries = hasFullAddress
          ? [activity.location, `${activity.name}, ${destination}`]
          : [`${activity.name}, ${destination}`]

        let coords: { lat: number; lng: number } | null = null
        for (const query of queries) {
          coords = await geocodeClient(query)
          if (coords) break
          // Rate limit between retries too
          if (!abortRef.current) {
            await new Promise((r) => setTimeout(r, 1100))
          }
        }
        cache.set(cacheKey, coords)

        if (coords && !abortRef.current) {
          results.push({ activity, ...coords })
          // Update progressively
          setGeocoded([...results])
        }

        // Rate limit
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
