"use client"

import { useState, useEffect, useRef } from "react"

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
const GOOGLE_PLACES_PHOTO_ENABLED = !!process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

// In-memory cache persists across re-renders within the same session
const imageCache = new Map<string, string | null>()

/**
 * Fetch a real photo for an activity.
 * Priority: Google Places (if key set) → Wikipedia → null (gradient fallback)
 */
export function useActivityImage(query: string | undefined, name: string) {
  const [src, setSrc] = useState<string | null>(() => {
    const key = (query || name).toLowerCase().trim()
    return imageCache.get(key) ?? null
  })
  const [loading, setLoading] = useState(() => {
    const key = (query || name).toLowerCase().trim()
    return !imageCache.has(key) && !!(query || name)
  })

  useEffect(() => {
    const searchTerm = query || name
    if (!searchTerm) {
      setLoading(false)
      return
    }

    const cacheKey = searchTerm.toLowerCase().trim()
    if (imageCache.has(cacheKey)) {
      setSrc(imageCache.get(cacheKey) ?? null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function fetchImage() {
      let url: string | null = null

      // Strategy 1: Google Places Photos (if enabled)
      if (GOOGLE_PLACES_PHOTO_ENABLED && !cancelled) {
        url = await fetchWithTimeout(fetchGooglePlacesPhoto(searchTerm), 5000)
      }

      // Strategy 2: Wikipedia with imageQuery
      if (!url && !cancelled) {
        url = await fetchWithTimeout(fetchWikipediaImage(searchTerm), 5000)
      }

      // Strategy 3: Try with just the activity name if query failed
      if (!url && !cancelled && query && query !== name) {
        url = await fetchWithTimeout(fetchWikipediaImage(name), 5000)
      }

      imageCache.set(cacheKey, url)
      if (!cancelled) {
        setSrc(url)
        setLoading(false)
      }
    }

    fetchImage()

    return () => { cancelled = true }
  }, [query, name])

  return { src, loading }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  try {
    const result = await Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ])
    return result
  } catch {
    return null
  }
}

// ─── Wikipedia ────────────────────────────────────────────────────────────────

async function fetchWikipediaImage(searchTerm: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      gsrsearch: searchTerm,
      generator: "search",
      gsrlimit: "1",
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "800",
    })

    const res = await fetch(`${WIKIPEDIA_API}?${params}`)
    if (!res.ok) return null

    const data = await res.json()
    const pages = data.query?.pages
    if (!pages) return null

    const page = Object.values(pages)[0] as { thumbnail?: { source?: string } }
    return page?.thumbnail?.source ?? null
  } catch {
    return null
  }
}

// ─── Google Places (upgrade path) ─────────────────────────────────────────────

async function fetchGooglePlacesPhoto(searchTerm: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
  if (!apiKey) return null

  try {
    const params = new URLSearchParams({
      input: searchTerm,
      inputtype: "textquery",
      fields: "photos",
      key: apiKey,
    })

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`
    )
    if (!res.ok) return null

    const data = await res.json()
    const photoRef = data.candidates?.[0]?.photos?.[0]?.photo_reference
    if (!photoRef) return null

    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`
  } catch {
    return null
  }
}
