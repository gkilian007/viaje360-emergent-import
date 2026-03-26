"use client"

import { useEffect, useState, useRef } from "react"
import type { TimelineActivity } from "@/lib/types"

interface WalkingSegment {
  fromId: string
  toId: string
  walkingMinutes: number
  distanceMeters: number
  mapsUrl: string
}

const cache = new Map<string, WalkingSegment>()

export function useWalkingTimes(activities: TimelineActivity[]) {
  const [segments, setSegments] = useState<Map<string, WalkingSegment>>(new Map())
  const abortRef = useRef(false)

  useEffect(() => {
    // Filter activities that have coordinates
    const withCoords = activities.filter(a => typeof a.lat === "number" && typeof a.lng === "number" && !isNaN(a.lat) && !isNaN(a.lng))
    if (withCoords.length < 2) {
      setSegments(new Map())
      return
    }

    abortRef.current = false
    const result = new Map<string, WalkingSegment>()

    async function fetchAll() {
      for (let i = 0; i < withCoords.length - 1; i++) {
        if (abortRef.current) break

        const from = withCoords[i]
        const to = withCoords[i + 1]
        const key = `${from.id}->${to.id}`

        if (cache.has(key)) {
          result.set(key, cache.get(key)!)
          continue
        }

        try {
          const res = await fetch(
            `/api/directions?fromLat=${from.lat}&fromLng=${from.lng}&toLat=${to.lat}&toLng=${to.lng}`
          )
          if (res.ok) {
            const { data } = await res.json()
            const seg: WalkingSegment = {
              fromId: from.id,
              toId: to.id,
              walkingMinutes: data.walkingMinutes,
              distanceMeters: data.distanceMeters,
              mapsUrl: data.mapsUrl,
            }
            cache.set(key, seg)
            result.set(key, seg)

            if (!abortRef.current) {
              setSegments(new Map(result))
            }
          }
        } catch {
          // skip this segment
        }

        // Rate limit: OSRM allows ~1 req/sec for public
        if (i < withCoords.length - 2) {
          await new Promise(r => setTimeout(r, 300))
        }
      }

      if (!abortRef.current) {
        setSegments(new Map(result))
      }
    }

    fetchAll()
    return () => { abortRef.current = true }
  }, [activities])

  function getSegment(fromId: string, toId: string): WalkingSegment | undefined {
    return segments.get(`${fromId}->${toId}`)
  }

  return { segments, getSegment }
}
