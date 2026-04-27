import { describe, test } from "node:test"
import assert from "node:assert/strict"
import {
  assessMadridTransportFit,
  getMadridRecommendedMode,
  decideMadridSegmentMode,
  estimateMadridDoorToDoor,
  type MadridTransportKnowledgeItem,
  type MadridTransportProfileContext,
} from "@/lib/services/madrid-transport-knowledge"

function makeItem(overrides: Partial<MadridTransportKnowledgeItem> = {}): MadridTransportKnowledgeItem {
  return {
    name: "Sol Metro",
    category: "metro-station",
    address: "Puerta del Sol, Madrid",
    tags: ["metro", "central"],
    officialUrl: null,
    metadata: {},
    ...overrides,
  }
}

describe("assessMadridTransportFit", () => {
  test("confirmed-accessible station with no profile context is recommended with 0 extra minutes", () => {
    const item = makeItem({ metadata: { accessibility_status: "accessible" } })
    const result = assessMadridTransportFit(item)
    assert.equal(result.fitLabel, "recommended")
    assert.equal(result.extraMinutes, 0)
    assert.ok(result.reasons.includes("confirmed accessibility"))
  })

  test("unknown accessibility adds 4 extra minutes", () => {
    const item = makeItem({ metadata: { accessibility_status: "unknown" } })
    const result = assessMadridTransportFit(item)
    assert.equal(result.extraMinutes, 4)
    assert.ok(result.reasons.includes("accessibility unknown"))
  })

  test("partial accessibility adds 7 extra minutes and caution label", () => {
    const item = makeItem({ metadata: { accessibility_status: "partial" } })
    const result = assessMadridTransportFit(item)
    assert.equal(result.extraMinutes, 7)
    assert.equal(result.fitLabel, "caution")
  })

  test("interchange flag adds 4 extra minutes", () => {
    const item = makeItem({ metadata: { accessibility_status: "accessible", isInterchange: true } })
    const result = assessMadridTransportFit(item)
    assert.equal(result.extraMinutes, 4)
    assert.ok(result.reasons.includes("interchange complexity"))
  })

  test("wheelchair profile + non-accessible station → avoid", () => {
    const item = makeItem({ metadata: { accessibility_status: "unknown" } })
    const context: MadridTransportProfileContext = { mobility: "wheelchair" }
    const result = assessMadridTransportFit(item, context)
    assert.equal(result.fitLabel, "avoid")
    assert.ok(result.reasons.includes("wheelchair profile"))
  })

  test("heavy luggage adds 8 extra minutes", () => {
    const item = makeItem({ metadata: { accessibility_status: "accessible" } })
    const context: MadridTransportProfileContext = { luggageLevel: "heavy" }
    const result = assessMadridTransportFit(item, context)
    assert.equal(result.extraMinutes, 8)
    assert.ok(result.reasons.some((r) => r.includes("heavy luggage")))
  })

  test("family (bebe) context adds 4 extra minutes for stroller friction", () => {
    const item = makeItem({ metadata: { accessibility_status: "accessible" } })
    const context: MadridTransportProfileContext = { kidsPets: ["bebe"] }
    const result = assessMadridTransportFit(item, context)
    assert.equal(result.extraMinutes, 4)
    assert.ok(result.reasons.includes("stroller/family boarding friction"))
  })
})

describe("getMadridRecommendedMode", () => {
  test("wheelchair + accessible station → bus", () => {
    const item = makeItem({ metadata: { accessibility_status: "accessible" } })
    const context: MadridTransportProfileContext = { mobility: "wheelchair" }
    const result = getMadridRecommendedMode(item, context)
    assert.equal(result.recommendedMode, "bus")
  })

  test("wheelchair + unknown accessibility → taxi", () => {
    const item = makeItem({ metadata: { accessibility_status: "unknown" } })
    const context: MadridTransportProfileContext = { mobility: "wheelchair" }
    const result = getMadridRecommendedMode(item, context)
    assert.equal(result.recommendedMode, "taxi")
  })

  test("heavy luggage → taxi regardless of station quality", () => {
    const item = makeItem({ metadata: { accessibility_status: "accessible" } })
    const context: MadridTransportProfileContext = { luggageLevel: "heavy" }
    const result = getMadridRecommendedMode(item, context)
    assert.equal(result.recommendedMode, "taxi")
  })

  test("metro station with no special context → metro mode", () => {
    const item = makeItem({ metadata: { accessibility_status: "accessible", mode: "metro" } })
    const result = getMadridRecommendedMode(item)
    assert.equal(result.recommendedMode, "metro")
  })
})

describe("estimateMadridDoorToDoor", () => {
  test("returns all expected fields", () => {
    const item = makeItem({ metadata: { accessibility_status: "accessible" } })
    const result = estimateMadridDoorToDoor(item, { distanceMeters: 900, timeOfDay: "afternoon" })
    assert.ok(typeof result.walkToStopMinutes === "number")
    assert.ok(typeof result.waitMinutes === "number")
    assert.ok(typeof result.rideMinutes === "number")
    assert.ok(typeof result.stationExtraMinutes === "number")
    assert.ok(typeof result.totalMinutes === "number")
    assert.equal(result.totalMinutes, result.walkToStopMinutes + result.waitMinutes + result.rideMinutes + result.stationExtraMinutes)
  })

  test("night time-of-day uses higher wait (9 min)", () => {
    const item = makeItem({ metadata: { accessibility_status: "accessible" } })
    const night = estimateMadridDoorToDoor(item, { distanceMeters: 900, timeOfDay: "night" })
    const afternoon = estimateMadridDoorToDoor(item, { distanceMeters: 900, timeOfDay: "afternoon" })
    assert.equal(night.waitMinutes, 9)
    assert.equal(afternoon.waitMinutes, 5)
    assert.ok(night.totalMinutes > afternoon.totalMinutes)
  })

  test("wheelchair profile slows walking pace (very-slow)", () => {
    const item = makeItem({ metadata: { accessibility_status: "accessible" } })
    const wheelchair = estimateMadridDoorToDoor(item, {
      distanceMeters: 900,
      profileContext: { mobility: "wheelchair" },
    })
    const normal = estimateMadridDoorToDoor(item, { distanceMeters: 900 })
    assert.equal(wheelchair.paceLabel, "very-slow")
    assert.equal(normal.paceLabel, "normal")
    assert.ok(wheelchair.walkToStopMinutes >= normal.walkToStopMinutes)
  })
})

describe("decideMadridSegmentMode", () => {
  test("short segment (200 m) with low-friction station prefers walking", () => {
    const item = makeItem({ metadata: { accessibility_status: "accessible" } })
    const result = decideMadridSegmentMode(item, { distanceMeters: 200 })
    assert.equal(result.preferredMode, "walk")
  })

  test("wheelchair profile delegates to taxi regardless of distance", () => {
    const item = makeItem({ metadata: { accessibility_status: "unknown" } })
    const result = decideMadridSegmentMode(item, {
      distanceMeters: 1500,
      profileContext: { mobility: "wheelchair" },
    })
    assert.equal(result.preferredMode, "taxi")
  })

  test("result always contains required numeric fields", () => {
    const item = makeItem({ metadata: { accessibility_status: "accessible" } })
    const result = decideMadridSegmentMode(item, { distanceMeters: 900 })
    assert.ok(typeof result.walkMinutes === "number" && result.walkMinutes > 0)
    assert.ok(typeof result.transportMinutes === "number" && result.transportMinutes > 0)
    assert.ok(typeof result.timeSavedMinutes === "number" && result.timeSavedMinutes >= 0)
    assert.ok(typeof result.rationale === "string" && result.rationale.length > 0)
  })
})
