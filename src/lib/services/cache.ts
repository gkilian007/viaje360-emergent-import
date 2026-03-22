import { getFeatureFlag } from "@/lib/feature-flags"
import { createServiceClient } from "@/lib/supabase/server"

/**
 * Lightweight cache layer backed by Supabase tables.
 * TTL: places = 7 days, weather = 1 hour.
 * Controlled by feature flags: FEATURE_PLACES_CACHE, FEATURE_WEATHER_CACHE.
 */

export function placesCacheKey(
  location: string,
  query: string,
  filters?: Record<string, unknown>
): string {
  const filterStr = filters ? JSON.stringify(filters, Object.keys(filters).sort()) : ""
  return `places:${location.toLowerCase().trim()}:${query.toLowerCase().trim()}:${filterStr}`
}

export async function getPlacesFromCache(cacheKey: string): Promise<unknown[] | null> {
  if (!getFeatureFlag("PLACES_CACHE")) return null

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("places_cache")
      .select("results")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .single()

    if (error || !data) return null
    return Array.isArray(data.results) ? (data.results as unknown[]) : null
  } catch {
    return null
  }
}

export async function setPlacesCache(
  cacheKey: string,
  location: string,
  query: string,
  results: unknown[],
  provider: string
): Promise<void> {
  if (!getFeatureFlag("PLACES_CACHE")) return

  try {
    const supabase = createServiceClient()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await supabase.from("places_cache").upsert(
      {
        cache_key: cacheKey,
        location,
        query,
        results,
        provider,
        expires_at: expiresAt,
      },
      { onConflict: "cache_key" }
    )
  } catch (err) {
    console.warn("[setPlacesCache] Failed to write cache:", err)
  }
}

export function weatherCacheKey(lat: number, lng: number, days = 7): string {
  return `weather:${lat.toFixed(2)}:${lng.toFixed(2)}:${days}`
}

interface WeatherCacheEntry {
  result: unknown
  forecast: unknown
}

export async function getWeatherFromCache(cacheKey: string): Promise<WeatherCacheEntry | null> {
  if (!getFeatureFlag("WEATHER_CACHE")) return null

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("weather_cache")
      .select("result, forecast")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .single()

    if (error || !data) return null
    return { result: data.result, forecast: data.forecast }
  } catch {
    return null
  }
}

export async function setWeatherCache(
  cacheKey: string,
  lat: number,
  lng: number,
  result: unknown,
  forecast: unknown
): Promise<void> {
  if (!getFeatureFlag("WEATHER_CACHE")) return

  try {
    const supabase = createServiceClient()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    await supabase.from("weather_cache").upsert(
      {
        cache_key: cacheKey,
        lat,
        lng,
        result,
        forecast,
        expires_at: expiresAt,
      },
      { onConflict: "cache_key" }
    )
  } catch (err) {
    console.warn("[setWeatherCache] Failed to write cache:", err)
  }
}
