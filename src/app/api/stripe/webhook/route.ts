import { NextRequest, NextResponse } from "next/server"
import { getStripeClient } from "@/lib/services/stripe.service"
import { createServiceClient } from "@/lib/supabase/server"
import {
  buildCheckoutCompletedUpsert,
  buildSubscriptionInactiveUpdate,
  extractUserIdFromEvent,
} from "./webhook.helpers"

// Disable Next.js default body parser — we need the raw body for Stripe signature verification
export const config = {
  api: { bodyParser: false },
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    console.warn("[stripe/webhook] Missing signature or webhook secret")
    return NextResponse.json({ error: "Missing stripe-signature or STRIPE_WEBHOOK_SECRET" }, { status: 400 })
  }

  // Read raw body (Next.js App Router)
  const rawBody = await req.text()

  let event
  try {
    const stripe = getStripeClient()
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook signature verification failed"
    console.error("[stripe/webhook] Signature verification failed:", message)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  console.info(`[stripe/webhook] Received event: ${event.type}`)

  try {
    const supabase = createServiceClient()

    switch (event.type) {
      case "checkout.session.completed": {
        const userId = extractUserIdFromEvent(event)
        if (!userId) {
          console.warn("[stripe/webhook] checkout.session.completed: no userId in metadata")
          break
        }

        const upsertPayload = buildCheckoutCompletedUpsert(userId)
        const { error } = await supabase
          .from("user_subscriptions")
          .upsert(upsertPayload, { onConflict: "user_id" })

        if (error) {
          console.error("[stripe/webhook] Failed to upsert user_subscriptions:", error)
          return NextResponse.json({ error: "Database upsert failed" }, { status: 500 })
        }

        console.info(`[stripe/webhook] Activated subscription for user ${userId}`)
        break
      }

      case "customer.subscription.deleted":
      case "invoice.payment_failed": {
        const userId = extractUserIdFromEvent(event)
        if (!userId) {
          console.warn(`[stripe/webhook] ${event.type}: no userId in metadata`)
          break
        }

        const updatePayload = buildSubscriptionInactiveUpdate()
        const { error } = await supabase
          .from("user_subscriptions")
          .update(updatePayload)
          .eq("user_id", userId)

        if (error) {
          console.error("[stripe/webhook] Failed to update user_subscriptions:", error)
          return NextResponse.json({ error: "Database update failed" }, { status: 500 })
        }

        console.info(`[stripe/webhook] Deactivated subscription for user ${userId}`)
        break
      }

      default:
        // Unhandled event type — acknowledged, ignored
        console.info(`[stripe/webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error("[stripe/webhook] Handler error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
