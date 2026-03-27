import test from "node:test"
import assert from "node:assert/strict"

import {
  buildMobilityPlanningBrief,
  getSegmentMobilityAdvice,
  resolveMobilityProfile,
} from "./mobility"

test("resolveMobilityProfile uses adult tourist defaults", () => {
  const profile = resolveMobilityProfile({
    companion: "solo",
    kidsPets: [],
    mobility: "full",
  })

  assert.equal(profile.key, "adult")
  assert.equal(profile.maxComfortableWalkMeters, 1500)
  assert.equal(profile.restAfterMeters, 1200)
  assert.equal(profile.walkingSpeedKmh, 4.8)
})

test("resolveMobilityProfile lowers thresholds for families with small children", () => {
  const profile = resolveMobilityProfile({
    companion: "familia",
    kidsPets: ["ninos"],
    mobility: "full",
  })

  assert.equal(profile.key, "family-kids")
  assert.equal(profile.maxComfortableWalkMeters, 900)
  assert.equal(profile.restAfterMeters, 700)
  assert.equal(profile.walkingSpeedKmh, 4)
})

test("resolveMobilityProfile uses strictest rule for wheelchair users", () => {
  const profile = resolveMobilityProfile({
    companion: "pareja",
    kidsPets: [],
    mobility: "wheelchair",
  })

  assert.equal(profile.key, "wheelchair")
  assert.equal(profile.maxComfortableWalkMeters, 200)
  assert.equal(profile.restAfterMeters, 150)
  assert.equal(profile.walkingSpeedKmh, 2.7)
})

test("getSegmentMobilityAdvice recommends public transport beyond profile threshold", () => {
  const advice = getSegmentMobilityAdvice(
    1700,
    resolveMobilityProfile({ companion: "solo", kidsPets: [], mobility: "full" })
  )

  assert.equal(advice.mode, "public-transport")
  assert.match(advice.reason, /1\.5 km/i)
})

test("getSegmentMobilityAdvice flags family rest stop before transport threshold", () => {
  const advice = getSegmentMobilityAdvice(
    750,
    resolveMobilityProfile({ companion: "familia", kidsPets: ["ninos"], mobility: "full" })
  )

  assert.equal(advice.mode, "walk-with-rest")
  assert.equal(advice.needsRestStop, true)
})

test("buildMobilityPlanningBrief includes transport and rest rules", () => {
  const brief = buildMobilityPlanningBrief({
    companion: "familia",
    kidsPets: ["bebe"],
    mobility: "full",
    transport: ["pie", "publico"],
  })

  assert.match(brief, /public transport/i)
  assert.match(brief, /600m/i)
  assert.match(brief, /rest/i)
  assert.match(brief, /baby|beb[eé]/i)
})
