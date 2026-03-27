import type Stripe from "stripe"

/**
 * Build the upsert payload for user_subscriptions when checkout.session.completed fires.
 */
export function buildCheckoutCompletedUpsert(userId: string) {
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  return {
    user_id: userId,
    plan: "annual" as const,
    status: "active" as const,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Build the update payload to mark a subscription as inactive.
 */
export function buildSubscriptionInactiveUpdate() {
  return {
    status: "inactive" as const,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Extract the userId from a Stripe event object.
 * Looks in metadata of the inner data.object.
 */
export function extractUserIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data?.object as unknown as Record<string, unknown> | undefined
  if (!obj) return null

  // checkout.session.completed → session.metadata.userId
  // customer.subscription.deleted → subscription.metadata.userId
  // invoice.payment_failed → invoice.metadata.userId
  const metadata = obj["metadata"] as Record<string, unknown> | undefined
  if (metadata?.["userId"] && typeof metadata["userId"] === "string") {
    return metadata["userId"]
  }

  return null
}
