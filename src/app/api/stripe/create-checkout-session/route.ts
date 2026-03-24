import { NextRequest } from "next/server"
import { successResponse, normalizeRouteError, errorResponse } from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import {
  buildAnnualCheckoutSessionParams,
  buildDestinationCheckoutSessionParams,
  getStripeClient,
} from "@/lib/services/stripe.service"

function getBaseUrl(req: NextRequest): string {
  const origin = req.headers.get("origin")
  if (origin) return origin
  return new URL(req.url).origin
}

export async function POST(req: NextRequest) {
  try {
    const identity = await resolveRequestIdentity()
    if (!identity.userId) {
      return errorResponse("UNAUTHORIZED", "User identity required", 401)
    }

    const body = await req.json()
    const { kind, destination } = body as { kind?: "trip" | "annual"; destination?: string }

    if (!kind) {
      return errorResponse("VALIDATION_ERROR", "kind is required", 400)
    }

    const stripe = getStripeClient()
    const baseUrl = getBaseUrl(req)
    const successUrl = `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseUrl}/plan`

    const params =
      kind === "trip"
        ? buildDestinationCheckoutSessionParams({
            destination: destination ?? "Trip",
            userId: identity.userId,
            successUrl,
            cancelUrl,
          })
        : buildAnnualCheckoutSessionParams({
            priceId: process.env.STRIPE_ANNUAL_PRICE_ID ?? "",
            userId: identity.userId,
            successUrl,
            cancelUrl,
          })

    if (kind === "annual" && !process.env.STRIPE_ANNUAL_PRICE_ID) {
      return errorResponse("CONFIG_ERROR", "STRIPE_ANNUAL_PRICE_ID is not configured", 500)
    }

    const session = await stripe.checkout.sessions.create(params)

    return successResponse({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error("stripe/create-checkout-session error:", error)
    return normalizeRouteError(error, "Failed to create Stripe checkout session")
  }
}
