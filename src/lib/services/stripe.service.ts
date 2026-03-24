import Stripe from "stripe"

export function normalizeDestination(destination: string): string {
  return destination.toLowerCase().trim()
}

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  })
}

export function buildDestinationCheckoutSessionParams(input: {
  destination: string
  userId: string
  successUrl: string
  cancelUrl: string
}): Stripe.Checkout.SessionCreateParams {
  const destination = normalizeDestination(input.destination)

  return {
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      kind: "trip",
      destination,
      userId: input.userId,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: 499,
          product_data: {
            name: `Viaje360 — ${input.destination}`,
            description: `Acceso permanente al destino ${input.destination}`,
          },
        },
      },
    ],
  }
}

export function buildAnnualCheckoutSessionParams(input: {
  priceId: string
  userId: string
  successUrl: string
  cancelUrl: string
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      kind: "annual",
      userId: input.userId,
    },
    line_items: [
      {
        price: input.priceId,
        quantity: 1,
      },
    ],
  }
}
