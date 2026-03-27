import test from "node:test"
import assert from "node:assert/strict"

// ─── Stub Stripe ────────────────────────────────────────────────────────────
const validEvent = {
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_123",
      metadata: { userId: "user-abc", kind: "annual" },
      subscription: "sub_123",
    },
  },
}

const deletedEvent = {
  type: "customer.subscription.deleted",
  data: {
    object: { id: "sub_123", customer: "cus_123", metadata: { userId: "user-abc" } },
  },
}

const failedEvent = {
  type: "invoice.payment_failed",
  data: {
    object: {
      id: "in_123",
      customer: "cus_123",
      subscription: "sub_123",
      metadata: { userId: "user-abc" },
    },
  },
}

// ─── Tests for helper functions ──────────────────────────────────────────────

import {
  buildCheckoutCompletedUpsert,
  buildSubscriptionInactiveUpdate,
  extractUserIdFromEvent,
} from "./webhook.helpers"

test("buildCheckoutCompletedUpsert returns correct upsert payload", () => {
  const userId = "user-abc"
  const payload = buildCheckoutCompletedUpsert(userId)

  assert.equal(payload.user_id, userId)
  assert.equal(payload.plan, "annual")
  assert.equal(payload.status, "active")
  assert.ok(payload.expires_at, "should have expires_at")

  const expiresAt = new Date(payload.expires_at)
  const now = new Date()
  const diffMs = expiresAt.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  // Should be approximately 365 days ± 1 day
  assert.ok(diffDays > 364, `expires_at should be ~1 year in future, got ${diffDays} days`)
  assert.ok(diffDays < 366, `expires_at should be ~1 year in future, got ${diffDays} days`)
})

test("buildSubscriptionInactiveUpdate returns inactive status", () => {
  const update = buildSubscriptionInactiveUpdate()
  assert.equal(update.status, "inactive")
})

test("extractUserIdFromEvent from checkout.session.completed metadata", () => {
  const userId = extractUserIdFromEvent(validEvent as any)
  assert.equal(userId, "user-abc")
})

test("extractUserIdFromEvent from customer.subscription.deleted metadata", () => {
  const userId = extractUserIdFromEvent(deletedEvent as any)
  assert.equal(userId, "user-abc")
})

test("extractUserIdFromEvent from invoice.payment_failed metadata", () => {
  const userId = extractUserIdFromEvent(failedEvent as any)
  assert.equal(userId, "user-abc")
})

test("extractUserIdFromEvent returns null for unknown event without metadata userId", () => {
  const event = {
    type: "checkout.session.completed",
    data: { object: { metadata: {} } },
  }
  const userId = extractUserIdFromEvent(event as any)
  assert.equal(userId, null)
})
