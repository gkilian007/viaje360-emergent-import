import test from "node:test"
import assert from "node:assert/strict"
import {
  findNearbyPOIs,
  scorePOI,
  buildMagicMomentSuggestion,
  type NearbyPOI,
  type MagicMomentContext,
} from "./magic-moment"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePOI(overrides: Partial<NearbyPOI> = {}): NearbyPOI {
  return {
    name: "Mercado de la Boqueria",
    type: "gastronomia",
    distanceMeters: 150,
    lat: 41.381,
    lng: 2.174,
    openNow: true,
    durationMinutes: 30,
    mapsUrl: "https://maps.google.com/?q=boqueria",
    ...overrides,
  }
}

function makeCtx(overrides: Partial<MagicMomentContext> = {}): MagicMomentContext {
  return {
    currentLat: 41.382,
    currentLng: 2.173,
    nextActivity: { name: "Sagrada Família", lat: 41.4036, lng: 2.1744, time: "14:00" },
    minutesToNext: 45,
    userInterests: ["gastronomia", "arte"],
    dayProgress: 0.4,
    destination: "barcelona",
    ...overrides,
  }
}

// ─── scorePOI ─────────────────────────────────────────────────────────────────

test("scorePOI: higher score when POI matches user interests", () => {
  const poi = makePOI({ type: "gastronomia" })
  const ctx = makeCtx({ userInterests: ["gastronomia"] })
  const score = scorePOI(poi, ctx)
  assert.ok(score > 0)
})

test("scorePOI: lower score for POI not matching interests", () => {
  const matched = scorePOI(makePOI({ type: "gastronomia" }), makeCtx({ userInterests: ["gastronomia"] }))
  const notMatched = scorePOI(makePOI({ type: "deportes" }), makeCtx({ userInterests: ["gastronomia"] }))
  assert.ok(matched > notMatched)
})

test("scorePOI: closed POI scores 0", () => {
  const poi = makePOI({ openNow: false })
  const score = scorePOI(poi, makeCtx())
  assert.equal(score, 0)
})

test("scorePOI: score drops for POIs closer to next activity start", () => {
  // With only 10 min to next and 30 min needed for POI → penalized
  const tight = scorePOI(makePOI({ durationMinutes: 30 }), makeCtx({ minutesToNext: 10 }))
  const loose = scorePOI(makePOI({ durationMinutes: 30 }), makeCtx({ minutesToNext: 60 }))
  assert.ok(loose > tight)
})

test("scorePOI: very close POIs score higher (distance bonus)", () => {
  const near = scorePOI(makePOI({ distanceMeters: 80, openNow: true }), makeCtx())
  const far = scorePOI(makePOI({ distanceMeters: 400, openNow: true }), makeCtx())
  assert.ok(near > far)
})

// ─── findNearbyPOIs ───────────────────────────────────────────────────────────

test("findNearbyPOIs: returns only POIs within radius", () => {
  const ctx = makeCtx()
  const pois = findNearbyPOIs(ctx)
  // All returned POIs should be within 600m (default radius)
  for (const poi of pois) {
    assert.ok(poi.distanceMeters <= 600)
  }
})

test("findNearbyPOIs: returns empty array when no POIs available", () => {
  // Middle of the ocean — no static POIs nearby
  const ctx = makeCtx({ currentLat: 0, currentLng: 0 })
  const pois = findNearbyPOIs(ctx)
  assert.equal(pois.length, 0)
})

// ─── buildMagicMomentSuggestion ───────────────────────────────────────────────

test("buildMagicMomentSuggestion: returns null when no time available", () => {
  const ctx = makeCtx({ minutesToNext: 5 }) // only 5 min gap
  const suggestion = buildMagicMomentSuggestion([], ctx)
  assert.equal(suggestion, null)
})

test("buildMagicMomentSuggestion: returns null when no eligible POIs", () => {
  const suggestion = buildMagicMomentSuggestion([], makeCtx())
  assert.equal(suggestion, null)
})

test("buildMagicMomentSuggestion: returns best POI when conditions met", () => {
  const pois: NearbyPOI[] = [
    makePOI({ name: "Bar de tapas", type: "gastronomia", distanceMeters: 100, openNow: true, durationMinutes: 20 }),
    makePOI({ name: "Galería de arte", type: "arte", distanceMeters: 80, openNow: true, durationMinutes: 25 }),
  ]
  const ctx = makeCtx({ minutesToNext: 50, userInterests: ["arte"] })
  const suggestion = buildMagicMomentSuggestion(pois, ctx)
  assert.ok(suggestion !== null)
  assert.equal(suggestion!.poi.name, "Galería de arte") // arte matches interest
})

test("buildMagicMomentSuggestion: includes a human-readable reason", () => {
  const pois: NearbyPOI[] = [
    makePOI({ name: "Heladería Artesanal", type: "gastronomia", distanceMeters: 60, openNow: true, durationMinutes: 15 }),
  ]
  const ctx = makeCtx({ minutesToNext: 45 })
  const suggestion = buildMagicMomentSuggestion(pois, ctx)
  assert.ok(suggestion?.reason)
  assert.ok(suggestion!.reason.length > 10)
})
