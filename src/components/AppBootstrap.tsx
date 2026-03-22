"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useAppStore } from "@/store/useAppStore"
import type { DayItinerary, Trip } from "@/lib/types"

interface ActiveTripResponse {
  trip: Trip | null
  days: DayItinerary[]
}

export function AppBootstrap() {
  const pathname = usePathname()
  const hasFetchedRef = useRef(false)
  const { currentTrip, generatedItinerary, setCurrentTrip, setGeneratedItinerary } = useAppStore()

  useEffect(() => {
    if (pathname?.startsWith("/onboarding")) return
    if (hasFetchedRef.current) return
    if (currentTrip && generatedItinerary?.length) return

    hasFetchedRef.current = true

    async function hydrateActiveTrip() {
      try {
        const res = await fetch("/api/trips/active", { cache: "no-store" })
        if (!res.ok) return

        const data = (await res.json()) as ActiveTripResponse
        if (data.trip) setCurrentTrip(data.trip)
        if (data.days?.length) setGeneratedItinerary(data.days)
      } catch (err) {
        console.warn("Could not hydrate active trip:", err)
      }
    }

    void hydrateActiveTrip()
  }, [pathname, currentTrip, generatedItinerary, setCurrentTrip, setGeneratedItinerary])

  return null
}
