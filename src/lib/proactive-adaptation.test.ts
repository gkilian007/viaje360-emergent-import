import test from "node:test"
import assert from "node:assert/strict"
import {
  detectTripIssues,
  type TripIssue,
  type DaySnapshot,
  type ActivitySnapshot,
} from "./proactive-adaptation"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeActivity(overrides: Partial<ActivitySnapshot> = {}): ActivitySnapshot {
  return {
    id: "a1",
    name: "Test Activity",
    type: "cultural",
    time: "10:00",
    endTime: "12:00",
    duration: 120,
    ...overrides,
  }
}

function makeDay(dayNumber: number, overrides: Partial<DaySnapshot> = {}): DaySnapshot {
  return {
    dayNumber,
    date: `2026-04-0${dayNumber}`,
    activities: [makeActivity()],
    weather: null,
    ...overrides,
  }
}

// ─── Rain detection ───────────────────────────────────────────────────────────

test("detectTripIssues: no issues when weather is clear", () => {
  const days: DaySnapshot[] = [
    makeDay(1, { weather: { precipitationProbability: 10, tempMax: 22, tempMin: 14, weatherCode: 0, date: "2026-04-01" } }),
  ]
  const issues = detectTripIssues(days)
  assert.equal(issues.length, 0)
})

test("detectTripIssues: rain issue when precipitation >= 60%", () => {
  const days: DaySnapshot[] = [
    makeDay(1, {
      weather: { precipitationProbability: 75, tempMax: 18, tempMin: 12, weatherCode: 63, date: "2026-04-01" },
      activities: [makeActivity({ type: "outdoor" }), makeActivity({ type: "cultural", id: "a2" })],
    }),
  ]
  const issues = detectTripIssues(days)
  const rain = issues.find(i => i.kind === "rain")
  assert.ok(rain, "should detect rain issue")
  assert.equal(rain?.dayNumber, 1)
  assert.ok(rain?.affectedActivityIds?.length, "should flag outdoor activities")
})

test("detectTripIssues: storm is higher severity than rain", () => {
  const days: DaySnapshot[] = [
    makeDay(1, {
      weather: { precipitationProbability: 90, tempMax: 15, tempMin: 10, weatherCode: 95, date: "2026-04-01" },
      activities: [makeActivity({ type: "outdoor" })],
    }),
  ]
  const issues = detectTripIssues(days)
  const storm = issues.find(i => i.kind === "storm")
  assert.ok(storm, "should detect storm issue separately")
  assert.equal(storm?.severity, "critical")
})

// ─── Extreme temperature detection ───────────────────────────────────────────

test("detectTripIssues: heat advisory above 36°C with outdoor activities", () => {
  const days: DaySnapshot[] = [
    makeDay(1, {
      weather: { precipitationProbability: 5, tempMax: 38, tempMin: 25, weatherCode: 0, date: "2026-04-01" },
      activities: [makeActivity({ type: "outdoor", time: "12:00", endTime: "14:00" })],
    }),
  ]
  const issues = detectTripIssues(days)
  const heat = issues.find(i => i.kind === "heat")
  assert.ok(heat, "should detect heat issue")
  assert.equal(heat?.severity, "warning")
})

test("detectTripIssues: cold advisory below 2°C with beach/outdoor activities", () => {
  const days: DaySnapshot[] = [
    makeDay(1, {
      weather: { precipitationProbability: 20, tempMax: 1, tempMin: -3, weatherCode: 71, date: "2026-04-01" },
      activities: [makeActivity({ type: "playa" })],
    }),
  ]
  const issues = detectTripIssues(days)
  const cold = issues.find(i => i.kind === "cold")
  assert.ok(cold, "should detect cold issue")
})

// ─── Fatigue detection ────────────────────────────────────────────────────────

test("detectTripIssues: fatigue when 4+ activities on same day and last is very physical", () => {
  const activities: ActivitySnapshot[] = [
    makeActivity({ id: "a1", type: "cultural", time: "09:00" }),
    makeActivity({ id: "a2", type: "cultural", time: "11:00" }),
    makeActivity({ id: "a3", type: "aventura", time: "13:00" }),
    makeActivity({ id: "a4", type: "aventura", time: "16:00" }), // heavy at end of day
  ]
  const days: DaySnapshot[] = [makeDay(1, { activities })]
  const issues = detectTripIssues(days)
  const fatigue = issues.find(i => i.kind === "fatigue")
  assert.ok(fatigue, "should detect fatigue issue")
})

test("detectTripIssues: no fatigue with 3 or fewer activities", () => {
  const activities: ActivitySnapshot[] = [
    makeActivity({ id: "a1", type: "cultural", time: "09:00" }),
    makeActivity({ id: "a2", type: "aventura", time: "14:00" }),
  ]
  const days: DaySnapshot[] = [makeDay(1, { activities })]
  const issues = detectTripIssues(days)
  const fatigue = issues.find(i => i.kind === "fatigue")
  assert.equal(fatigue, undefined)
})

// ─── Priority ordering ────────────────────────────────────────────────────────

test("detectTripIssues: returns issues sorted by severity desc (critical first)", () => {
  const days: DaySnapshot[] = [
    makeDay(1, {
      weather: { precipitationProbability: 90, tempMax: 38, tempMin: 25, weatherCode: 95, date: "2026-04-01" },
      activities: [
        makeActivity({ type: "outdoor" }),
        makeActivity({ id: "a2", type: "playa" }),
        makeActivity({ id: "a3", type: "aventura", time: "16:00" }),
        makeActivity({ id: "a4", type: "aventura", time: "18:00" }),
      ],
    }),
  ]
  const issues = detectTripIssues(days)
  assert.ok(issues.length >= 2)
  const severities = issues.map(i => i.severity)
  // critical should come before warning
  const firstCritical = severities.indexOf("critical")
  const firstWarning = severities.indexOf("warning")
  if (firstCritical >= 0 && firstWarning >= 0) {
    assert.ok(firstCritical < firstWarning, "critical issues should come first")
  }
})

// ─── Multi-day detection ──────────────────────────────────────────────────────

test("detectTripIssues: detects issues across multiple days", () => {
  const days: DaySnapshot[] = [
    makeDay(1, { weather: { precipitationProbability: 10, tempMax: 20, tempMin: 14, weatherCode: 0, date: "2026-04-01" } }),
    makeDay(2, {
      weather: { precipitationProbability: 80, tempMax: 17, tempMin: 12, weatherCode: 63, date: "2026-04-02" },
      activities: [makeActivity({ type: "outdoor", id: "b1" })],
    }),
    makeDay(3, { weather: { precipitationProbability: 5, tempMax: 23, tempMin: 15, weatherCode: 0, date: "2026-04-03" } }),
  ]
  const issues = detectTripIssues(days)
  const rain = issues.find(i => i.kind === "rain")
  assert.ok(rain)
  assert.equal(rain?.dayNumber, 2)
})
