import test from "node:test"
import assert from "node:assert/strict"

import {
  buildFallbackItinerary,
  runReliableGenerationPipeline,
  validateAndRepairItinerary,
} from "./itinerary-reliability"
import type { OnboardingData } from "@/lib/onboarding-types"

const onboarding: OnboardingData = {
  destination: "Barcelona",
  startDate: "2026-04-10",
  endDate: "2026-04-11",
  arrivalTime: null,
  departureTime: null,
  companion: "familia",
  groupSize: 3,
  kidsPets: ["ninos"],
  mobility: "reduced",
  hasMobilityNeeds: true,
  accommodationZone: "Eixample",
  interests: ["historia", "gastronomia"],
  travelerStyle: "cultural",
  famousLocal: 50,
  pace: 45,
  wantsRestDays: false,
  restDayFrequency: null,
  wakeTime: 30,
  wantsSiesta: true,
  budget: "economico",
  splurge: [],
  dietary: ["vegetariano"],
  allergies: "",
  transport: ["pie", "publico"],
  weatherAdaptation: true,
  firstTime: true,
  mustSee: "Sagrada Familia",
  mustAvoid: "nightclubs",
  alreadyBooked: "Sagrada Familia 2026-04-10 10:00",
}

test("validateAndRepairItinerary repairs malformed times, overlaps and invalid constraints", () => {
  const raw = JSON.stringify({
    tripName: "Barcelona Sprint",
    days: [
      {
        dayNumber: 9,
        date: "April 10",
        theme: "Highlights",
        isRestDay: false,
        activities: [
          {
            name: "Sagrada Familia",
            type: "monument",
            location: "Eixample",
            time: "10am",
            duration: 90,
            cost: 80,
            notes: "Booked ticket",
          },
          {
            name: "Hilltop stair climb viewpoint",
            type: "tour",
            location: "Montjuic",
            time: "14:30",
            endTime: "15:30",
            duration: 60,
            cost: 50,
            notes: "lots of stairs and steep climb",
          },
          {
            name: "Cocktail club",
            type: "tour",
            location: "Center",
            time: "15:00",
            duration: 60,
            cost: 120,
          },
        ],
      },
    ],
  })

  const result = validateAndRepairItinerary(raw, onboarding)
  const firstDay = result.itinerary.days[0]

  assert.equal(firstDay.date, "2026-04-10")
  assert.equal(firstDay.dayNumber, 1)
  assert.equal(firstDay.activities[0]?.time, "10:00")
  assert.ok(firstDay.activities.every((activity) => !activity.name.toLowerCase().includes("cocktail club")))
  assert.ok(firstDay.activities.every((activity) => !activity.name.toLowerCase().includes("stair climb")))
  assert.ok(firstDay.activities.every((activity) => activity.time < "14:00" || activity.time >= "16:00"))
  assert.ok(result.warnings.some((warning) => warning.code === "siesta_repaired"))
  assert.ok(result.warnings.some((warning) => warning.code === "constraint_replaced"))
})

test("runReliableGenerationPipeline retries invalid payloads and succeeds without fallback", async () => {
  const invalid = "not-json"
  const valid = JSON.stringify({
    tripName: "Barcelona Recovery",
    days: [
      {
        dayNumber: 1,
        date: "2026-04-10",
        theme: "Day 1",
        isRestDay: false,
        activities: [
          {
            name: "Sagrada Familia",
            type: "monument",
            location: "Eixample",
            time: "10:00",
            endTime: "11:30",
            duration: 90,
            cost: 25,
            notes: "Booked ticket",
          },
        ],
      },
      {
        dayNumber: 2,
        date: "2026-04-11",
        theme: "Day 2",
        isRestDay: false,
        activities: [],
      },
    ],
  })

  let attempts = 0
  const result = await runReliableGenerationPipeline(invalid, onboarding, {
    mode: "generate",
    maxAttempts: 3,
    onAttempt: async () => {
      attempts += 1
      return valid
    },
  })

  assert.equal(result.usedFallback, false)
  assert.equal(result.attempts, 2)
  assert.equal(attempts, 1)
  assert.equal(result.itinerary.days.length, 2)
})

test("buildFallbackItinerary returns a minimal coherent itinerary", () => {
  const fallback = buildFallbackItinerary(onboarding)

  assert.equal(fallback.itinerary.tripName, "Barcelona Essentials")
  assert.equal(fallback.itinerary.days.length, 2)
  assert.ok(fallback.itinerary.days.every((day) => day.activities.length >= 3))
  assert.ok(fallback.warnings.some((warning) => warning.code === "json_extract_failed"))
})
