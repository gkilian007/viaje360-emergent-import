import test from "node:test"
import assert from "node:assert/strict"

import {
  estimateTransitOption,
  getTransitFare,
  shouldOfferTransitChoice,
  buildTransferContext,
  type TransferContext,
} from "./transit"

// ─── getTransitFare ───────────────────────────────────────────────────────────

test("getTransitFare returns known fare for Barcelona", () => {
  const fare = getTransitFare("barcelona")
  assert.equal(fare.currency, "€")
  assert.ok(fare.singleTicket > 0)
})

test("getTransitFare returns known fare for Madrid", () => {
  const fare = getTransitFare("madrid")
  assert.ok(fare.singleTicket > 0)
  assert.ok((fare.tenJourney ?? 0) > 0)
})

test("getTransitFare falls back to generic Europe fare for unknown city", () => {
  const fare = getTransitFare("timbuktu")
  assert.ok(fare.singleTicket > 0)
  assert.equal(fare.isFallback, true)
})

// ─── estimateTransitOption ────────────────────────────────────────────────────

test("estimateTransitOption gives faster arrival than walking for 2km segment", () => {
  const walking = { walkingMinutes: 24, distanceMeters: 2000 }
  const transit = estimateTransitOption(walking, "barcelona")
  assert.ok(transit.totalMinutes < walking.walkingMinutes)
})

test("estimateTransitOption includes walk to stop, wait and travel time", () => {
  const transit = estimateTransitOption({ walkingMinutes: 24, distanceMeters: 2000 }, "barcelona")
  assert.ok(transit.walkToStopMinutes >= 1)
  assert.ok(transit.waitMinutes >= 2)
  assert.ok(transit.rideMinutes >= 1)
  assert.equal(transit.totalMinutes, transit.walkToStopMinutes + transit.waitMinutes + transit.rideMinutes)
})

test("estimateTransitOption fare reflects destination pricing", () => {
  const t1 = estimateTransitOption({ walkingMinutes: 24, distanceMeters: 2000 }, "barcelona")
  const t2 = estimateTransitOption({ walkingMinutes: 24, distanceMeters: 2000 }, "london")
  assert.notEqual(t1.fareAmount, t2.fareAmount)
})

// ─── shouldOfferTransitChoice ─────────────────────────────────────────────────

test("shouldOfferTransitChoice returns true when segment exceeds mobility threshold", () => {
  const offer = shouldOfferTransitChoice(1800, "adult")
  assert.equal(offer, true)
})

test("shouldOfferTransitChoice returns false for short comfortable walks", () => {
  const offer = shouldOfferTransitChoice(400, "adult")
  assert.equal(offer, false)
})

test("shouldOfferTransitChoice is triggered earlier for family-kids profile", () => {
  const offerFamily = shouldOfferTransitChoice(800, "family-kids")
  const offerAdult = shouldOfferTransitChoice(800, "adult")
  // family is triggered at lower distance
  assert.equal(offerFamily, true)
  assert.equal(offerAdult, false)
})

// ─── buildTransferContext ─────────────────────────────────────────────────────

test("buildTransferContext includes what-to-see hint for walking option", () => {
  const ctx: TransferContext = {
    fromActivity: "Park Güell",
    toActivity: "La Sagrada Família",
    distanceMeters: 1800,
    walkingMinutes: 22,
    destination: "barcelona",
    mobilityProfileKey: "adult",
    dayProgress: 0.7,
  }
  const transfer = buildTransferContext(ctx)
  assert.ok(transfer.walkingOption)
  assert.ok(transfer.transitOption)
  assert.match(transfer.walkingOption.hint, /Gràcia|walk|street|Eixample|around/i)
})

test("buildTransferContext marks transit as recommended when user is tired (dayProgress > 0.6)", () => {
  const ctx: TransferContext = {
    fromActivity: "Park Güell",
    toActivity: "La Sagrada Família",
    distanceMeters: 1800,
    walkingMinutes: 22,
    destination: "barcelona",
    mobilityProfileKey: "adult",
    dayProgress: 0.75,
  }
  const transfer = buildTransferContext(ctx)
  assert.equal(transfer.recommendTransit, true)
})

test("buildTransferContext recommends walking in the morning (dayProgress < 0.3)", () => {
  const ctx: TransferContext = {
    fromActivity: "Hotel Arts",
    toActivity: "Barceloneta Beach",
    distanceMeters: 900,
    walkingMinutes: 12,
    destination: "barcelona",
    mobilityProfileKey: "adult",
    dayProgress: 0.15,
  }
  const transfer = buildTransferContext(ctx)
  assert.equal(transfer.recommendTransit, false)
})
