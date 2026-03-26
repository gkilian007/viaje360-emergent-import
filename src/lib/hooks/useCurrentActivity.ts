"use client"

import { useState, useEffect } from "react"
import type { TimelineActivity } from "@/lib/types"

interface CurrentActivityState {
  current: TimelineActivity | null
  next: TimelineActivity | null
  currentIndex: number
  minutesRemaining: number
  minutesToNext: number
  progress: number // 0-1
  isDayOver: boolean
  isDayNotStarted: boolean
}

function parseTime(timeStr: string, referenceDate?: Date): Date {
  const [h, m] = timeStr.split(":").map(Number)
  const d = referenceDate ? new Date(referenceDate) : new Date()
  d.setHours(h, m, 0, 0)
  return d
}

export function useCurrentActivity(
  activities: TimelineActivity[],
  tripStartDate?: string
): CurrentActivityState {
  const [state, setState] = useState<CurrentActivityState>({
    current: null,
    next: null,
    currentIndex: -1,
    minutesRemaining: 0,
    minutesToNext: 0,
    progress: 0,
    isDayOver: false,
    isDayNotStarted: true,
  })

  useEffect(() => {
    if (!activities.length) return

    function update() {
      const now = new Date()

      // Find current activity based on time slots
      let currentIdx = -1
      for (let i = 0; i < activities.length; i++) {
        const act = activities[i]
        const start = parseTime(act.time)
        const end = act.endTime ? parseTime(act.endTime) : new Date(start.getTime() + act.duration * 60000)

        if (now >= start && now < end) {
          currentIdx = i
          break
        }
      }

      // If no exact match, find the next upcoming
      if (currentIdx === -1) {
        const firstStart = parseTime(activities[0].time)
        const lastAct = activities[activities.length - 1]
        const lastEnd = lastAct.endTime
          ? parseTime(lastAct.endTime)
          : new Date(parseTime(lastAct.time).getTime() + lastAct.duration * 60000)

        if (now < firstStart) {
          setState({
            current: null,
            next: activities[0],
            currentIndex: -1,
            minutesRemaining: 0,
            minutesToNext: Math.round((firstStart.getTime() - now.getTime()) / 60000),
            progress: 0,
            isDayOver: false,
            isDayNotStarted: true,
          })
          return
        }

        if (now >= lastEnd) {
          setState({
            current: null,
            next: null,
            currentIndex: -1,
            minutesRemaining: 0,
            minutesToNext: 0,
            progress: 1,
            isDayOver: true,
            isDayNotStarted: false,
          })
          return
        }

        // Between activities — find the next one
        for (let i = 0; i < activities.length; i++) {
          const start = parseTime(activities[i].time)
          if (now < start) {
            setState({
              current: null,
              next: activities[i],
              currentIndex: -1,
              minutesRemaining: 0,
              minutesToNext: Math.round((start.getTime() - now.getTime()) / 60000),
              progress: i / activities.length,
              isDayOver: false,
              isDayNotStarted: false,
            })
            return
          }
        }
      }

      if (currentIdx >= 0) {
        const act = activities[currentIdx]
        const start = parseTime(act.time)
        const end = act.endTime ? parseTime(act.endTime) : new Date(start.getTime() + act.duration * 60000)
        const total = end.getTime() - start.getTime()
        const elapsed = now.getTime() - start.getTime()
        const remaining = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60000))
        const progress = Math.min(1, elapsed / total)

        const nextAct = activities[currentIdx + 1] ?? null
        const minutesToNext = nextAct
          ? Math.round((parseTime(nextAct.time).getTime() - now.getTime()) / 60000)
          : 0

        setState({
          current: act,
          next: nextAct,
          currentIndex: currentIdx,
          minutesRemaining: remaining,
          minutesToNext,
          progress,
          isDayOver: false,
          isDayNotStarted: false,
        })
      }
    }

    update()
    const interval = setInterval(update, 30000) // update every 30s
    return () => clearInterval(interval)
  }, [activities, tripStartDate])

  return state
}
