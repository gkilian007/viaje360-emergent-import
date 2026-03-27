"use client"

import { useState, useEffect, useMemo } from "react"
import type { DayItinerary } from "@/lib/types"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import {
  findNearbyPOIs,
  buildMagicMomentSuggestion,
  overpassPOIToNearbyPOI,
  type MagicMomentSuggestion,
  type NearbyPOI,
} from "@/lib/magic-moment"

interface UseMagicMomentProps {
  today: DayItinerary | undefined
  currentIndex: number
  minutesToNext: number
  dayProgress: number
  destination: string
  /** ISO date string — trip must have started for Magic Moment to activate */
  tripStartDate?: string | null
}

const GEOLOCATION_TIMEOUT_MS = 8000
const SUGGESTION_COOLDOWN_MS = 5 * 60 * 1000

/** Haversine distance in km between two lat/lng points */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useMagicMoment({
  today,
  currentIndex,
  minutesToNext,
  dayProgress,
  destination,
  tripStartDate,
}: UseMagicMomentProps) {
  const onboarding = useOnboardingStore((s) => s.data)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [suggestion, setSuggestion] = useState<MagicMomentSuggestion | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [lastShownAt, setLastShownAt] = useState<Record<string, number>>({})
  const [geoError, setGeoError] = useState(false)

  // Trip must have started — no magic moments while planning from home
  const tripHasStarted = useMemo(() => {
    if (!tripStartDate) return false
    return new Date() >= new Date(tripStartDate)
  }, [tripStartDate])

  // Try to get user's GPS position (only if trip has started)
  useEffect(() => {
    if (!tripHasStarted) return
    if (!navigator.geolocation) { setGeoError(true); return }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
        setGeoError(false)
      },
      () => { setGeoError(true) },
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 60000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [tripHasStarted])

  // Current activity coords — always available as fallback
  const activityLat = useMemo(() => {
    const activity = today?.activities[currentIndex >= 0 ? currentIndex : 0]
    return activity?.lat ?? null
  }, [today, currentIndex])

  const activityLng = useMemo(() => {
    const activity = today?.activities[currentIndex >= 0 ? currentIndex : 0]
    return activity?.lng ?? null
  }, [today, currentIndex])

  // Resolve position:
  // - If GPS is within 50km of the current activity → user is in destination → use GPS
  // - Otherwise → user is planning from home → use activity coords
  // This prevents showing POIs near the user's home when they're planning the trip
  const resolvedLat = useMemo(() => {
    if (userLat !== null && activityLat !== null) {
      const dist = distanceKm(userLat, userLng ?? 0, activityLat, activityLng ?? 0)
      if (dist <= 50) return userLat // GPS close to destination → use real GPS
    }
    return activityLat // fallback: use activity coords
  }, [userLat, userLng, activityLat, activityLng])

  const resolvedLng = useMemo(() => {
    if (userLng !== null && activityLat !== null) {
      const dist = distanceKm(userLat ?? 0, userLng, activityLat, activityLng ?? 0)
      if (dist <= 50) return userLng
    }
    return activityLng
  }, [userLat, userLng, activityLat, activityLng])

  // Build suggestion when position changes or we move between activities
  useEffect(() => {
    if (!resolvedLat || !resolvedLng || !today) return
    if (!destination) return
    // Don't show Magic Moments while the user is planning from home
    if (!tripHasStarted) { setSuggestion(null); return }

    void (async () => {

    const nextAct = today.activities[currentIndex + 1] ?? today.activities[0]
    if (!nextAct) return

    const ctx = {
      currentLat: resolvedLat,
      currentLng: resolvedLng,
      nextActivity: {
        name: nextAct.name,
        lat: nextAct.lat,
        lng: nextAct.lng,
        time: nextAct.time,
      },
      minutesToNext,
      userInterests: onboarding.interests ?? [],
      dayProgress,
      destination,
    }

    // Get curated POIs first
    let nearbyPOIs: NearbyPOI[] = findNearbyPOIs(ctx)

    // If no curated POIs for this destination, try Overpass API (real-time, all destinations)
    if (nearbyPOIs.length === 0 && resolvedLat && resolvedLng) {
      try {
        const overpassRes = await fetch(
          `/api/nearby?lat=${resolvedLat}&lng=${resolvedLng}&radius=600`
        )
        if (overpassRes.ok) {
          const { data } = await overpassRes.json()
          nearbyPOIs = (data?.pois ?? []).map(overpassPOIToNearbyPOI)
        }
      } catch {
        // Overpass is optional — continue without it
      }
    }

    const eligiblePOIs = nearbyPOIs.filter(poi => {
      const key = poi.name
      if (dismissed.has(key)) return false
      const lastShown = lastShownAt[key] ?? 0
      return Date.now() - lastShown > SUGGESTION_COOLDOWN_MS
    })

    const s = buildMagicMomentSuggestion(eligiblePOIs, ctx)
    setSuggestion(s)
    })()
  }, [resolvedLat, resolvedLng, currentIndex, minutesToNext, dayProgress, destination, today, onboarding.interests, dismissed, lastShownAt, tripHasStarted])

  function dismiss() {
    if (!suggestion) return
    const key = suggestion.poi.name
    setDismissed(prev => new Set([...prev, key]))
    setLastShownAt(prev => ({ ...prev, [key]: Date.now() }))
    setSuggestion(null)
  }

  function accept() {
    if (!suggestion) return
    // Open Google Maps for the POI
    window.open(suggestion.poi.mapsUrl, "_blank", "noopener,noreferrer")
    // Mark as shown so it doesn't re-appear immediately
    const key = suggestion.poi.name
    setLastShownAt(prev => ({ ...prev, [key]: Date.now() }))
    setSuggestion(null)
  }

  return { suggestion, dismiss, accept, geoError, hasPosition: resolvedLat !== null }
}
