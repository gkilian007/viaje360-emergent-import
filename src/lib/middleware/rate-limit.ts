import { NextRequest, NextResponse } from "next/server"
import { errorResponse } from "@/lib/api/route-helpers"
import { getFeatureFlag } from "@/lib/feature-flags"

interface Bucket {
  tokens: number
  lastRefillMs: number
}

interface RateLimitConfig {
  capacity: number
  refillPerSecond: number
}

const buckets = new Map<string, Bucket>()

const ROUTE_CONFIG: Record<string, RateLimitConfig> = {
  "places-search": { capacity: 12, refillPerSecond: 0.2 },
  weather: { capacity: 30, refillPerSecond: 0.5 },
  default: { capacity: 20, refillPerSecond: 0.3 },
}

function getClientKey(req: NextRequest, routeName: string) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = req.headers.get("x-real-ip")?.trim()
  const fallback = "anonymous"
  return `${routeName}:${forwarded || realIp || fallback}`
}

function takeToken(key: string, config: RateLimitConfig) {
  const now = Date.now()
  const bucket = buckets.get(key) ?? {
    tokens: config.capacity,
    lastRefillMs: now,
  }

  const elapsedSec = Math.max(0, (now - bucket.lastRefillMs) / 1000)
  const refilled = Math.min(config.capacity, bucket.tokens + elapsedSec * config.refillPerSecond)
  const nextBucket: Bucket = {
    tokens: refilled,
    lastRefillMs: now,
  }

  if (nextBucket.tokens < 1) {
    buckets.set(key, nextBucket)
    return false
  }

  nextBucket.tokens -= 1
  buckets.set(key, nextBucket)
  return true
}

export async function withRateLimit(
  req: NextRequest,
  routeName: keyof typeof ROUTE_CONFIG | string
): Promise<NextResponse | null> {
  if (!getFeatureFlag("RATE_LIMITING")) return null

  const config = ROUTE_CONFIG[routeName] ?? ROUTE_CONFIG.default
  const key = getClientKey(req, routeName)
  const allowed = takeToken(key, config)

  if (allowed) return null

  return errorResponse(
    "TOO_MANY_REQUESTS",
    "Rate limit exceeded. Please retry shortly.",
    429,
    { route: routeName }
  )
}

export function __resetRateLimitBucketsForTests() {
  buckets.clear()
}
