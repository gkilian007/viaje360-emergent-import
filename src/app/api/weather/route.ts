import { NextRequest } from "next/server"
import { weatherQuerySchema } from "@/lib/api/contracts"
import {
  normalizeRouteError,
  parseSearchParams,
  successResponse,
} from "@/lib/api/route-helpers"
import { getCurrentWeather, getForecast } from "@/lib/services/weather.service"
import { getWeatherFromCache, setWeatherCache, weatherCacheKey } from "@/lib/services/cache"
import { withRateLimit } from "@/lib/middleware/rate-limit"
import { structuredLog } from "@/lib/ops/logger"

export async function GET(req: NextRequest) {
  const start = Date.now()
  const requestId = crypto.randomUUID()
  const route = "GET /api/weather"

  try {
    const rateLimitResult = await withRateLimit(req, "weather")
    if (rateLimitResult) return rateLimitResult

    const { searchParams } = new URL(req.url)
    const query = parseSearchParams(searchParams, weatherQuerySchema)
    const cacheKey = weatherCacheKey(query.lat, query.lng, query.days)
    const cached = await getWeatherFromCache(cacheKey)

    let current
    let forecast

    if (cached) {
      current = cached.result
      forecast = cached.forecast
    } else {
      ;[current, forecast] = await Promise.all([
        getCurrentWeather(query.lat, query.lng),
        getForecast(query.lat, query.lng, query.days),
      ])
      await setWeatherCache(cacheKey, query.lat, query.lng, current, forecast)
    }

    structuredLog({
      requestId,
      route,
      duration: Date.now() - start,
      status: 200,
      meta: { cacheHit: Boolean(cached), lat: query.lat, lng: query.lng, days: query.days },
    })

    return successResponse({ current, forecast }, 200, requestId)
  } catch (error) {
    structuredLog({
      requestId,
      route,
      duration: Date.now() - start,
      status: 500,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return normalizeRouteError(error, "Failed to fetch weather", {
      requestId,
      route,
      details: { endpoint: "weather" },
    })
  }
}
