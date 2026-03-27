/**
 * Rate limiting via Upstash Redis.
 * Falls back gracefully (allows request) if Redis is not configured.
 *
 * Usage:
 *   const result = await rateLimit(req, "generate", 3, "1 d")
 *   if (!result.ok) return result.response  // 429
 */

import { NextRequest, NextResponse } from "next/server"

interface RateLimitResult {
  ok: boolean
  remaining: number
  response?: NextResponse
}

// Lazy initialization — only load Upstash if configured
let limiterCache: Map<string, { ratelimit: unknown; redis: unknown }> | null = null

async function getLimiter(key: string, limit: number, window: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  // No Redis configured → allow all requests
  if (!url || !token) return null

  try {
    const { Ratelimit } = await import("@upstash/ratelimit")
    const { Redis } = await import("@upstash/redis")
    const redis = new Redis({ url, token })

    // Parse window string: "10 m", "1 d", "30 s"
    const [amount, unit] = window.split(" ")
    const ms: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
    const windowMs = parseInt(amount) * (ms[unit] ?? 60000)

    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: `viaje360:rl:${key}`,
    })
  } catch {
    return null
  }
}

function getClientId(req: NextRequest): string {
  // Use user ID from header if available (set by auth middleware), else IP
  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown"
  return ip
}

export async function rateLimit(
  req: NextRequest,
  action: string,
  limit: number,
  window: string
): Promise<RateLimitResult> {
  try {
    const limiter = await getLimiter(action, limit, window)
    if (!limiter) return { ok: true, remaining: limit }

    const id = getClientId(req)
    const { success, remaining } = await (limiter as { limit: (id: string) => Promise<{ success: boolean; remaining: number }> }).limit(id)

    if (!success) {
      return {
        ok: false,
        remaining: 0,
        response: NextResponse.json(
          { ok: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please wait before trying again." } },
          {
            status: 429,
            headers: {
              "Retry-After": "60",
              "X-RateLimit-Limit": String(limit),
              "X-RateLimit-Remaining": "0",
            },
          }
        ),
      }
    }

    return { ok: true, remaining }
  } catch {
    // On any error, allow the request (fail open)
    return { ok: true, remaining: limit }
  }
}
