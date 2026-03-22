import test from "node:test"
import assert from "node:assert/strict"

import { scorePlaces } from "./scoring"
import type { NormalizedPlace } from "./types"

const basePlace: NormalizedPlace = {
  id: "1",
  name: "Test Place",
  type: "restaurant",
  address: "Address",
  neighborhood: "Center",
  notes: "",
  kidFriendly: false,
  petFriendly: false,
  accessible: false,
  dietaryOptions: [],
  source: "gemini",
}

test("scorePlaces prioritizes closer and better matched candidates", () => {
  const places: NormalizedPlace[] = [
    {
      ...basePlace,
      id: "far-low-fit",
      name: "Far Low Fit",
      lat: 41.0,
      lng: -3.0,
      rating: 3.8,
      kidFriendly: false,
      accessible: false,
      dietaryOptions: [],
      indoor: false,
    },
    {
      ...basePlace,
      id: "near-high-fit",
      name: "Near High Fit",
      lat: 40.4169,
      lng: -3.7037,
      rating: 4.8,
      kidFriendly: true,
      accessible: true,
      dietaryOptions: ["vegetariano", "vegano"],
      indoor: true,
    },
  ]

  const ranked = scorePlaces(places, {
    accommodationLat: 40.4168,
    accommodationLng: -3.7038,
    weatherCondition: "Lluvia intensa",
    filters: {
      kidFriendly: true,
      accessible: true,
      dietary: ["vegetariano"],
    },
    currentTime: "13:00",
  })

  assert.equal(ranked[0]?.id, "near-high-fit")
  assert.equal(ranked[1]?.id, "far-low-fit")
})

test("scorePlaces returns empty array when no candidates exist", () => {
  assert.deepEqual(scorePlaces([], {}), [])
})
