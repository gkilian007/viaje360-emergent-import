/**
 * Rate limiting via Upstash Redis.
 * Falls back to in-memory rate limiter if Redis is not configured.
 *
 * In-memory limits (per process, resets on restart):
 *   - "generate": 5 requests/day per IP
 *   - "adapt":    20 requests/day per IP
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

// ──────────────────────────────────────────────
// In-memory fallback rate limiter
// ──────────────────────────────────────────────

interface MemoryEntry {
  count: number
  resetAt: number // Unix ms
}

const memoryStore = new Map<string, MemoryEntry>()

// Default in-memory limits per action (fallback when Redis is unavailable)
const IN_MEMORY_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  generate: { limit: 5, windowMs: 86400000 },   // 5/day
  adapt:    { limit: 20, windowMs: 86400000 },   // 20/day
}

function inMemoryRateLimit(
  id: string,
  action: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const key = `${action}:${id}`
  const now = Date.now()

  // Use action-specific limits from defaults if available, else use provided values
  const defaults = IN_MEMORY_LIMITS[action]
  const effectiveLimit = defaults?.limit ?? limit
  const effectiveWindow = defaults?.windowMs ?? windowMs

  const entry = memoryStore.get(key)

  if (!entry || now >= entry.resetAt) {
    // First request or window expired → fresh window
    memoryStore.set(key, { count: 1, resetAt: now + effectiveWindow })
    return { success: true, remaining: effectiveLimit - 1 }
  }

  if (entry.count >= effectiveLimit) {
    return { success: false, remaining: 0 }
  }

  entry.count++
  memoryStore.set(key, entry)
  return { success: true, remaining: effectiveLimit - entry.count }
}

// Periodically clean up expired entries to avoid memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryStore.entries()) {
    if (now >= entry.resetAt) memoryStore.delete(key)
  }
}, 3600000) // every hour

// ──────────────────────────────────────────────
// Upstash Redis limiter (primary)
// ──────────────────────────────────────────────

async function getUpstashLimiter(action: string, limit: number, windowMs: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return null

  try {
    const { Ratelimit } = await import("@upstash/ratelimit")
    const { Redis } = await import("@upstash/redis")
    const redis = new Redis({ url, token })

    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: `viaje360:rl:${action}`,
    })
  } catch {
    return null
  }
}

function getClientId(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown"
  return ip
}

function parseWindow(window: string): number {
  const [amount, unit] = window.split(" ")
  const ms: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
  return parseInt(amount) * (ms[unit] ?? 60000)
}

export async function rateLimit(
  req: NextRequest,
  action: string,
  limit: number,
  window: string
): Promise<RateLimitResult> {
  const id = getClientId(req)
  const windowMs = parseWindow(window)

  try {
    const upstashLimiter = await getUpstashLimiter(action, limit, windowMs)

    let success: boolean
    let remaining: number

    if (upstashLimiter) {
      // Primary: Upstash Redis
      const result = await (upstashLimiter as {
        limit: (id: string) => Promise<{ success: boolean; remaining: number }>
      }).limit(id)
      success = result.success
      remaining = result.remaining
    } else {
      // Fallback: in-memory rate limiter
      const result = inMemoryRateLimit(id, action, limit, windowMs)
      success = result.success
      remaining = result.remaining
    }

    if (!success) {
      return {
        ok: false,
        remaining: 0,
        response: NextResponse.json(
          {
            ok: false,
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests. Please wait before trying again.",
            },
          },
          {
            status: 429,
            headers: {
              "Retry-After": "3600",
              "X-RateLimit-Limit": String(limit),
              "X-RateLimit-Remaining": "0",
            },
          }
        ),
      }
    }

    return { ok: true, remaining }
  } catch {
    // On any unexpected error, fail open
    return { ok: true, remaining: limit }
  }
}
