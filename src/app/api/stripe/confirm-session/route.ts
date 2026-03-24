import { NextRequest } from "next/server"
import { normalizeRouteError, errorResponse, successResponse } from "@/lib/api/route-helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { getStripeClient } from "@/lib/services/stripe.service"

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = (await req.json()) as { sessionId?: string }
    if (!sessionId) {
      return errorResponse("VALIDATION_ERROR", "sessionId is required", 400)
    }

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    })

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return errorResponse("PAYMENT_INCOMPLETE", "Stripe session not completed", 400)
    }

    const userId = session.metadata?.userId
    const kind = session.metadata?.kind

    if (!userId || !kind) {
      return errorResponse("INVALID_SESSION", "Missing Stripe session metadata", 400)
    }

    const supabase = createServiceClient()

    if (kind === "trip") {
      const destination = session.metadata?.destination
      if (!destination) {
        return errorResponse("INVALID_SESSION", "Missing destination metadata", 400)
      }

      await supabase.from("destination_purchases").upsert(
        {
          user_id: userId,
          destination,
          stripe_payment_intent_id: session.payment_intent as string,
          amount: 4.99,
          currency: "EUR",
          purchased_at: new Date().toISOString(),
        },
        { onConflict: "user_id,destination" }
      )
    }

    if (kind === "annual") {
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id

      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)

      await supabase.from("user_subscriptions").insert({
        user_id: userId,
        plan: "annual",
        status: "active",
        stripe_subscription_id: subscriptionId ?? null,
        stripe_customer_id:
          typeof session.customer === "string" ? session.customer : null,
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
    }

    return successResponse({ ok: true, kind })
  } catch (error) {
    console.error("stripe/confirm-session error:", error)
    return normalizeRouteError(error, "Failed to confirm Stripe session")
  }
}
