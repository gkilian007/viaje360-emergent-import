import { createServiceClient } from "@/lib/supabase/server"

export type AccessReason = "subscriber" | "purchased" | "trial" | "expired" | "new_trial"

export interface AccessResult {
  hasAccess: boolean
  reason: AccessReason
  plan: "free" | "annual"
  trialExpiresAt: string | null
  daysRemaining: number | null
  canAdapt: boolean
  canGenerate: boolean
  canDiary: boolean
}

const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

function normalizeDestination(dest: string): string {
  return dest.toLowerCase().trim()
}

/**
 * Check if bypass is enabled (dev/testing)
 */
function isBypassEnabled(): boolean {
  return process.env.VIAJE360_BYPASS_PAYWALL === "true"
}

/**
 * Resolve access for a user + destination.
 * Creates a trial automatically if none exists.
 */
export async function resolveAccess(
  userId: string | null,
  destination: string
): Promise<AccessResult> {
  const noAccess: AccessResult = {
    hasAccess: false,
    reason: "expired",
    plan: "free",
    trialExpiresAt: null,
    daysRemaining: null,
    canAdapt: false,
    canGenerate: false,
    canDiary: false,
  }

  // Bypass for dev/testing
  if (isBypassEnabled()) {
    return {
      hasAccess: true,
      reason: "subscriber",
      plan: "annual",
      trialExpiresAt: null,
      daysRemaining: null,
      canAdapt: true,
      canGenerate: true,
      canDiary: true,
    }
  }

  if (!userId || !destination) return noAccess

  const dest = normalizeDestination(destination)
  const supabase = createServiceClient()
  const now = new Date()

  // 1. Check active annual subscription
  try {
    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("plan", "annual")
      .eq("status", "active")
      .gt("expires_at", now.toISOString())
      .limit(1)
      .maybeSingle()

    if (sub) {
      return {
        hasAccess: true,
        reason: "subscriber",
        plan: "annual",
        trialExpiresAt: null,
        daysRemaining: null,
        canAdapt: true,
        canGenerate: true,
        canDiary: true,
      }
    }
  } catch {
    // Soft fail — continue to next check
  }

  // 2. Check destination purchase
  try {
    const { data: purchase } = await supabase
      .from("destination_purchases")
      .select("id")
      .eq("user_id", userId)
      .ilike("destination", dest)
      .limit(1)
      .maybeSingle()

    if (purchase) {
      return {
        hasAccess: true,
        reason: "purchased",
        plan: "free",
        trialExpiresAt: null,
        daysRemaining: null,
        canAdapt: true,
        canGenerate: true,
        canDiary: true,
      }
    }
  } catch {
    // Soft fail
  }

  // 3. Check / create destination trial
  try {
    const { data: trial } = await supabase
      .from("destination_trials")
      .select("*")
      .eq("user_id", userId)
      .ilike("destination", dest)
      .limit(1)
      .maybeSingle()

    if (trial) {
      const expiresAt = new Date(trial.expires_at as string)
      if (expiresAt > now) {
        const msRemaining = expiresAt.getTime() - now.getTime()
        const daysRemaining = Math.max(0, msRemaining / (24 * 60 * 60 * 1000))
        return {
          hasAccess: true,
          reason: "trial",
          plan: "free",
          trialExpiresAt: trial.expires_at as string,
          daysRemaining: Math.round(daysRemaining * 10) / 10,
          canAdapt: true,
          canGenerate: true,
          canDiary: true,
        }
      } else {
        // Trial expired
        return {
          ...noAccess,
          trialExpiresAt: trial.expires_at as string,
          daysRemaining: 0,
        }
      }
    }

    // No trial exists — create one
    const expiresAt = new Date(now.getTime() + TRIAL_DURATION_MS)
    await supabase.from("destination_trials").insert({
      user_id: userId,
      destination: dest,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })

    return {
      hasAccess: true,
      reason: "new_trial",
      plan: "free",
      trialExpiresAt: expiresAt.toISOString(),
      daysRemaining: 14,
      canAdapt: true,
      canGenerate: true,
      canDiary: true,
    }
  } catch {
    // If trial check fails, grant access to avoid blocking users
    return {
      hasAccess: true,
      reason: "trial",
      plan: "free",
      trialExpiresAt: null,
      daysRemaining: null,
      canAdapt: true,
      canGenerate: true,
      canDiary: true,
    }
  }
}
