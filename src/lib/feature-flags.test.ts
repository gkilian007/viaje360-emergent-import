import test from "node:test"
import assert from "node:assert/strict"

import { getAllFeatureFlags, getFeatureFlag } from "./feature-flags"

test("getFeatureFlag reads explicit true/false env values", () => {
  process.env.FEATURE_GOOGLE_PLACES = "true"
  process.env.FEATURE_PLACES_CACHE = "0"

  assert.equal(getFeatureFlag("GOOGLE_PLACES"), true)
  assert.equal(getFeatureFlag("PLACES_CACHE"), false)

  delete process.env.FEATURE_GOOGLE_PLACES
  delete process.env.FEATURE_PLACES_CACHE
})

test("getAllFeatureFlags returns known flags with defaults", () => {
  const flags = getAllFeatureFlags()

  assert.equal(typeof flags.GOOGLE_PLACES, "boolean")
  assert.equal(typeof flags.RATE_LIMITING, "boolean")
})
