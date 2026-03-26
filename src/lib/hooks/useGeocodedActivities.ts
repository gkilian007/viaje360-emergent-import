"use client"

import { useState, useEffect, useRef } from "react"
import type { TimelineActivity } from "@/lib/types"

interface GeocodedActivity {
  activity: TimelineActivity
  lat: number
  lng: number
}

async function geocodeClient(
  query: string,
  destination?: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const params = new URLSearchParams({ q: query })
    if (destination) params.set("near", destination)
    const res = await fetch(`/api/geocode?${params}`)
    if (!res.ok) return null

    const { data } = await res.json()
    return data ?? null
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
  const versionRef = useRef(0)

  // Stable key for activities
  const activityKey = activities.map(a => a.id).join(",")

  useEffect(() => {
    if (!activities.length || !destination) {
      setGeocoded([])
      setLoading(false)
      return
    }

    const myVersion = ++versionRef.current

    // Separate activities with and without coordinates
    const withCoords: GeocodedActivity[] = []
    const needsGeocoding: TimelineActivity[] = []

    for (const activity of activities) {
      if (typeof activity.lat === "number" && typeof activity.lng === "number" && isFinite(activity.lat) && isFinite(activity.lng) && activity.lat !== 0 && activity.lng !== 0) {
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

      for (let i = 0; i < needsGeocoding.length; i++) {
        if (versionRef.current !== myVersion) return

        const activity = needsGeocoding[i]
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
          coords = await geocodeClient(query, destination)
          if (coords) break
        }
        cache.set(cacheKey, coords)

        if (coords && versionRef.current === myVersion) {
          results.push({ activity, ...coords })
        }

        // Small delay between requests
        if (versionRef.current === myVersion && i < needsGeocoding.length - 1) {
          await new Promise((r) => setTimeout(r, 300))
        }
      }

      if (versionRef.current === myVersion) {
        setGeocoded([...results])
        setLoading(false)
      }
    }

    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityKey, destination])

  // Center of all geocoded points
  const validForCenter = geocoded.filter(g => isFinite(g.lat) && isFinite(g.lng))
  const center =
    validForCenter.length > 0
      ? {
          lat: validForCenter.reduce((sum, g) => sum + g.lat, 0) / validForCenter.length,
          lng: validForCenter.reduce((sum, g) => sum + g.lng, 0) / validForCenter.length,
        }
      : null

  return { geocoded, center, loading }
}
