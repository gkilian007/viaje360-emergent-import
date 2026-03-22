import { NextRequest } from "next/server"
import { placesSearchRequestSchema } from "@/lib/api/contracts"
import {
  normalizeRouteError,
  parseJsonBody,
  successResponse,
} from "@/lib/api/route-helpers"
import { searchPlaces } from "@/lib/services/places"
import type { NormalizedPlace } from "@/lib/services/places"
import { scorePlaces } from "@/lib/services/places/scoring"
import { withRateLimit } from "@/lib/middleware/rate-limit"
import { structuredLog } from "@/lib/ops/logger"
import { getPlacesFromCache, placesCacheKey, setPlacesCache } from "@/lib/services/cache"

export async function POST(req: NextRequest) {
  const start = Date.now()
  const requestId = crypto.randomUUID()
  const route = "POST /api/places/search"

  try {
    const rateLimitResult = await withRateLimit(req, "places-search")
    if (rateLimitResult) return rateLimitResult

    const body = await parseJsonBody(req, placesSearchRequestSchema)
    const cacheKey = placesCacheKey(body.location, body.query, body.filters)

    const cached = await getPlacesFromCache(cacheKey)
    const rawPlaces = cached
      ? (cached as NormalizedPlace[])
      : await searchPlaces({
          query: body.query,
          location: body.location,
          lat: body.lat,
          lng: body.lng,
          filters: body.filters,
        })

    if (!cached && rawPlaces.length > 0) {
      await setPlacesCache(cacheKey, body.location, body.query, rawPlaces, rawPlaces[0]?.source ?? "unknown")
    }

    const places = scorePlaces(rawPlaces, {
      accommodationLat: body.lat,
      accommodationLng: body.lng,
      weatherCondition: body.weatherCondition,
      currentTime: body.currentTime,
      filters: body.filters,
    })

    structuredLog({
      requestId,
      route,
      duration: Date.now() - start,
      status: 200,
      meta: {
        cacheHit: Boolean(cached),
        provider: places[0]?.source ?? "none",
        resultCount: places.length,
      },
    })

    return successResponse({ places }, 200, requestId)
  } catch (error) {
    structuredLog({
      requestId,
      route,
      duration: Date.now() - start,
      status: 500,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return normalizeRouteError(error, "Failed to search places", {
      requestId,
      route,
      details: { endpoint: "places-search" },
    })
  }
}
