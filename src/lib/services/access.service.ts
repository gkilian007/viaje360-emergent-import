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

const TRIAL_DURATION_DAYS = 2
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000

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
 *
 * @param tripStartDate ISO date string of when the trip starts.
 *   The 2-day trial is measured from the trip start date, not from
 *   when the itinerary was generated. This lets users plan ahead freely
 *   and only consumes trial days while they are actually traveling.
 *   If null/undefined, falls back to the stored trial expiry or now+2d.
 */
export async function resolveAccess(
  userId: string | null,
  destination: string,
  tripStartDate?: string | null
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
      // Recalculate expiry based on tripStartDate if provided and more recent than stored
      // This allows updating the expiry if the user changes trip dates
      let expiresAt = new Date(trial.expires_at as string)

      if (tripStartDate) {
        const startDate = new Date(tripStartDate)
        const startBasedExpiry = new Date(startDate.getTime() + TRIAL_DURATION_MS)
        // If the trip hasn't started yet, grant unlimited access to planning
        // The trial clock only starts ticking on the trip start date
        if (now < startDate) {
          return {
            hasAccess: true,
            reason: "trial",
            plan: "free",
            trialExpiresAt: startBasedExpiry.toISOString(),
            daysRemaining: TRIAL_DURATION_DAYS,
            canAdapt: true,
            canGenerate: true,
            canDiary: true,
          }
        }
        // Trip has started — use start-based expiry
        expiresAt = startBasedExpiry
        // Update stored expiry if different (lazy migration)
        if (Math.abs(expiresAt.getTime() - new Date(trial.expires_at as string).getTime()) > 60000) {
          await supabase
            .from("destination_trials")
            .update({ expires_at: expiresAt.toISOString() })
            .eq("id", trial.id)
        }
      }

      if (expiresAt > now) {
        const msRemaining = expiresAt.getTime() - now.getTime()
        const daysRemaining = Math.max(0, msRemaining / (24 * 60 * 60 * 1000))
        return {
          hasAccess: true,
          reason: "trial",
          plan: "free",
          trialExpiresAt: expiresAt.toISOString(),
          daysRemaining: Math.round(daysRemaining * 10) / 10,
          canAdapt: true,
          canGenerate: true,
          canDiary: true,
        }
      } else {
        // Trial expired
        return {
          ...noAccess,
          trialExpiresAt: expiresAt.toISOString(),
          daysRemaining: 0,
        }
      }
    }

    // No trial exists — create one.
    // If we know the trip start date, anchor the expiry to it.
    // If not, anchor to now (fallback for edge cases).
    const trialAnchor = tripStartDate ? new Date(tripStartDate) : now
    const expiresAt = new Date(trialAnchor.getTime() + TRIAL_DURATION_MS)

    await supabase.from("destination_trials").insert({
      user_id: userId,
      destination: dest,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })

    // If trip hasn't started yet, user has full access to plan freely
    const tripNotStarted = tripStartDate && now < new Date(tripStartDate)
    return {
      hasAccess: true,
      reason: "new_trial",
      plan: "free",
      trialExpiresAt: expiresAt.toISOString(),
      daysRemaining: tripNotStarted ? TRIAL_DURATION_DAYS : TRIAL_DURATION_DAYS,
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
