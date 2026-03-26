"use client"

import { useEffect, useState } from "react"

interface UseActivityAssetsInput {
  name: string
  location?: string
  destination?: string
  type?: string
  imageQuery?: string
  url?: string
}

interface ActivityAssetsResult {
  imageUrl: string | null
  imageSource: string | null
  primaryUrl: string
  primaryKind: "menu" | "booking" | "maps"
  mapsUrl: string
  cached: boolean
}

const cache = new Map<string, ActivityAssetsResult>()

export function useActivityAssets(input: UseActivityAssetsInput) {
  const key = JSON.stringify({
    name: input.name,
    location: input.location ?? "",
    destination: input.destination ?? "",
    type: input.type ?? "tour",
    imageQuery: input.imageQuery ?? "",
    url: input.url ?? "",
  })

  const [data, setData] = useState<ActivityAssetsResult | null>(() => cache.get(key) ?? null)
  const [loading, setLoading] = useState(!cache.has(key))

  useEffect(() => {
    if (!input.name) {
      setData(null)
      setLoading(false)
      return
    }

    if (cache.has(key)) {
      setData(cache.get(key) ?? null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch("/api/activity-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
      .then((r) => r.json())
      .then((payload) => {
        if (!payload?.ok) throw new Error(payload?.error?.message ?? "Failed")
        const result = payload.data as ActivityAssetsResult
        cache.set(key, result)
        if (!cancelled) {
          setData(result)
          setLoading(false)
        }
      })
      .catch(() => {
        const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${input.name} ${input.location ?? ""}`.trim())}`
        const fallback: ActivityAssetsResult = {
          imageUrl: null,
          imageSource: null,
          primaryUrl: mapsUrl,
          primaryKind: "maps",
          mapsUrl,
          cached: false,
        }
        cache.set(key, fallback)
        if (!cancelled) {
          setData(fallback)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [key, input])

  return { data, loading }
}
