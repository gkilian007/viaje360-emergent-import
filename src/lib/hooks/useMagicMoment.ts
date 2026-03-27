"use client"

import { useState, useEffect, useMemo } from "react"
import type { DayItinerary } from "@/lib/types"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import {
  findNearbyPOIs,
  buildMagicMomentSuggestion,
  type MagicMomentSuggestion,
} from "@/lib/magic-moment"

interface UseMagicMomentProps {
  today: DayItinerary | undefined
  /** Index of the activity we're currently in (from useCurrentActivity) */
  currentIndex: number
  minutesToNext: number
  dayProgress: number
  destination: string
}

const GEOLOCATION_TIMEOUT_MS = 8000
const SUGGESTION_COOLDOWN_MS = 5 * 60 * 1000 // don't re-show same POI within 5 min

export function useMagicMoment({
  today,
  currentIndex,
  minutesToNext,
  dayProgress,
  destination,
}: UseMagicMomentProps) {
  const onboarding = useOnboardingStore((s) => s.data)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [suggestion, setSuggestion] = useState<MagicMomentSuggestion | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [lastShownAt, setLastShownAt] = useState<Record<string, number>>({})
  const [geoError, setGeoError] = useState(false)

  // Try to get user's GPS position
  useEffect(() => {
    if (!navigator.geolocation) { setGeoError(true); return }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
        setGeoError(false)
      },
      () => {
        setGeoError(true)
        // Fallback: use the current activity's coords
      },
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 60000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // Resolve position: GPS > current activity coords > next activity coords
  const resolvedLat = useMemo(() => {
    if (userLat !== null) return userLat
    const activity = today?.activities[currentIndex >= 0 ? currentIndex : 0]
    return activity?.lat ?? null
  }, [userLat, today, currentIndex])

  const resolvedLng = useMemo(() => {
    if (userLng !== null) return userLng
    const activity = today?.activities[currentIndex >= 0 ? currentIndex : 0]
    return activity?.lng ?? null
  }, [userLng, today, currentIndex])

  // Build suggestion when position changes or we move between activities
  useEffect(() => {
    if (!resolvedLat || !resolvedLng || !today) return
    if (!destination) return

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

    const nearbyPOIs = findNearbyPOIs(ctx)
    const eligiblePOIs = nearbyPOIs.filter(poi => {
      const key = poi.name
      if (dismissed.has(key)) return false
      const lastShown = lastShownAt[key] ?? 0
      return Date.now() - lastShown > SUGGESTION_COOLDOWN_MS
    })

    const s = buildMagicMomentSuggestion(eligiblePOIs, ctx)
    setSuggestion(s)
  }, [resolvedLat, resolvedLng, currentIndex, minutesToNext, dayProgress, destination, today, onboarding.interests, dismissed, lastShownAt])

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
