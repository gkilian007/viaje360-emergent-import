import test from "node:test"
import assert from "node:assert/strict"
import {
  buildAnnualCheckoutSessionParams,
  buildDestinationCheckoutSessionParams,
} from "./stripe.service"

test("buildDestinationCheckoutSessionParams creates one-time payment session for destination", () => {
  const params = buildDestinationCheckoutSessionParams({
    priceId: "price_trip_123",
    destination: "Tokyo",
    userId: "user-123",
    successUrl: "https://app.test/billing/success?session_id={CHECKOUT_SESSION_ID}",
    cancelUrl: "https://app.test/plan",
  })

  assert.equal(params.mode, "payment")
  assert.equal(params.success_url, "https://app.test/billing/success?session_id={CHECKOUT_SESSION_ID}")
  assert.equal(params.cancel_url, "https://app.test/plan")
  assert.equal(params.metadata?.kind, "trip")
  assert.equal(params.metadata?.destination, "tokyo")
  assert.equal(params.metadata?.userId, "user-123")
  assert.equal(params.line_items?.length, 1)
  assert.equal(params.line_items?.[0]?.price, "price_trip_123")
  assert.equal(params.line_items?.[0]?.quantity, 1)
})

test("buildAnnualCheckoutSessionParams creates subscription session for annual plan", () => {
  const params = buildAnnualCheckoutSessionParams({
    priceId: "price_annual_123",
    userId: "user-123",
    successUrl: "https://app.test/billing/success?session_id={CHECKOUT_SESSION_ID}",
    cancelUrl: "https://app.test/plan",
  })

  assert.equal(params.mode, "subscription")
  assert.equal(params.metadata?.kind, "annual")
  assert.equal(params.metadata?.userId, "user-123")
  assert.equal(params.line_items?.length, 1)
  assert.equal(params.line_items?.[0]?.price, "price_annual_123")
  assert.equal(params.line_items?.[0]?.quantity, 1)
})
