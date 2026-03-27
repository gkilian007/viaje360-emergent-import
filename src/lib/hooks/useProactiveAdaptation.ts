"use client"

import { useMemo, useState } from "react"
import type { DayItinerary } from "@/lib/types"
import type { DayWeather } from "@/lib/weather-utils"
import {
  detectTripIssues,
  itineraryToDaySnapshots,
  type TripIssue,
} from "@/lib/proactive-adaptation"

interface UseProactiveAdaptationProps {
  itinerary: DayItinerary[]
  getWeatherForDate: (date: string) => DayWeather | undefined
  tripId: string
  onAdapted?: (days: DayItinerary[]) => void
}

export function useProactiveAdaptation({
  itinerary,
  getWeatherForDate,
  tripId,
  onAdapted,
}: UseProactiveAdaptationProps) {
  const [dismissedKinds, setDismissedKinds] = useState<Set<string>>(new Set())
  const [adaptingKind, setAdaptingKind] = useState<string | null>(null)
  const [doneKinds, setDoneKinds] = useState<Set<string>>(new Set())

  const issues = useMemo(() => {
    const snapshots = itineraryToDaySnapshots(itinerary, getWeatherForDate)
    return detectTripIssues(snapshots)
  }, [itinerary, getWeatherForDate])

  // The most urgent issue not yet dismissed or done
  const topIssue: TripIssue | null = useMemo(() => {
    return issues.find(
      i => !dismissedKinds.has(`${i.kind}-${i.dayNumber}`) &&
           !doneKinds.has(`${i.kind}-${i.dayNumber}`)
    ) ?? null
  }, [issues, dismissedKinds, doneKinds])

  function dismiss(issue: TripIssue) {
    setDismissedKinds(prev => new Set([...prev, `${issue.kind}-${issue.dayNumber}`]))
  }

  async function adapt(issue: TripIssue) {
    const key = `${issue.kind}-${issue.dayNumber}`
    setAdaptingKind(key)
    try {
      const res = await fetch("/api/itinerary/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          reason: issue.adaptationPrompt,
          startFromDayNumber: issue.dayNumber,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.data?.days && onAdapted) {
          onAdapted(data.data.days)
        }
        setDoneKinds(prev => new Set([...prev, key]))
      }
    } catch {
      // silent fail
    } finally {
      setAdaptingKind(null)
    }
  }

  const isAdapting = adaptingKind !== null

  return { topIssue, issues, dismiss, adapt, isAdapting, adaptingKind }
}
