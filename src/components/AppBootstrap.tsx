"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useAppStore } from "@/store/useAppStore"
import { selectHydratedAppState } from "@/lib/bootstrap/hydration"
import type { ChatMessage, DayItinerary, Trip } from "@/lib/types"

interface ActiveTripResponse {
  trip: Trip | null
  days: DayItinerary[]
  chatMessages: ChatMessage[]
}

interface ActiveTripEnvelope {
  ok: true
  data: ActiveTripResponse
}

export function AppBootstrap() {
  const pathname = usePathname()
  const hasFetchedRef = useRef(false)
  const {
    currentTrip,
    generatedItinerary,
    chatMessages,
    setCurrentTrip,
    setGeneratedItinerary,
    replaceChatMessages,
  } = useAppStore()

  useEffect(() => {
    if (pathname?.startsWith("/onboarding")) return
    if (hasFetchedRef.current) return
    
    // Small delay to allow Zustand to hydrate from localStorage first
    const timer = setTimeout(() => {
      // Skip hydration if we already have local data (from localStorage)
      if (currentTrip && generatedItinerary?.length) {
        hasFetchedRef.current = true
        return
      }

      hasFetchedRef.current = true

      async function hydrateActiveTrip() {
        try {
          const res = await fetch("/api/trips/active", { cache: "no-store" })
          if (!res.ok) return

          const payload = (await res.json()) as ActiveTripEnvelope
          
          // Only hydrate if remote has data and local doesn't
          if (!payload.data.trip) return

          const nextState = selectHydratedAppState({
            local: {
              currentTrip,
              generatedItinerary,
              chatMessages,
            },
            remote: payload.data,
          })

          setCurrentTrip(nextState.currentTrip)
          setGeneratedItinerary(nextState.generatedItinerary)
          replaceChatMessages(nextState.chatMessages)
        } catch (err) {
          // Silently ignore network errors - localStorage data will be used
          if (process.env.NODE_ENV === "development") {
            console.warn("Could not hydrate active trip:", err)
          }
        }
      }

      void hydrateActiveTrip()
    }, 100)
    
    return () => clearTimeout(timer)
  }, [
    pathname,
    currentTrip,
    generatedItinerary,
    chatMessages,
    setCurrentTrip,
    setGeneratedItinerary,
    replaceChatMessages,
  ])

  return null
}
