#!/usr/bin/env node
/**
 * Populate transit_routes cache for all activity pairs in Supabase.
 * Fetches real transit routes from Google Routes API and caches them.
 *
 * Usage: node scripts/populate-transit-routes.mjs [--dry-run] [--city=Madrid]
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

// Load env
const env = readFileSync(".env.local", "utf8")
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim()

const SUPABASE_URL = get("NEXT_PUBLIC_SUPABASE_URL")
const SUPABASE_KEY = get("SUPABASE_SERVICE_ROLE_KEY")
const GOOGLE_API_KEY = get("GOOGLE_PLACES_API_KEY")

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const GOOGLE_ROUTES_API = "https://routes.googleapis.com/directions/v2:computeRoutes"
const FIELD_MASK = [
  "routes.legs.steps.transitDetails",
  "routes.legs.steps.travelMode",
  "routes.legs.polyline",
  "routes.legs.duration",
  "routes.legs.distanceMeters",
  "routes.legs.steps.polyline",
  "routes.legs.steps.startLocation",
  "routes.legs.steps.endLocation",
  "routes.legs.steps.localizedValues",
].join(",")

// Cities with good metro/transit systems
const TRANSIT_CITIES = new Set([
  "madrid", "barcelona", "paris", "parís", "london", "londres",
  "roma", "rome", "berlin", "berlín", "tokyo", "tokio",
  "new york", "nueva york", "lisboa", "lisbon",
  "amsterdam", "ámsterdam", "milán", "milan", "múnich", "munich",
  "copenhague", "copenhagen", "atenas", "athens",
  "budapest", "bruselas", "brussels", "zúrich", "zurich",
  "san francisco", "vancouver", "osaka", "seúl", "seoul",
  "kioto", "kyoto", "ciudad de méxico", "mexico city",
  "buenos aires", "singapur", "singapore",
  "estambul", "istanbul", "bangkok", "dubái", "dubai",
  "el cairo", "cairo", "sídney", "sydney", "praga", "prague",
  "viena", "vienna", "cracovia",
])

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function cacheKey(lat1, lng1, lat2, lng2) {
  return `${lat1.toFixed(4)},${lng1.toFixed(4)}->${lat2.toFixed(4)},${lng2.toFixed(4)}`
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchTransitRoute(originLat, originLng, destLat, destLng) {
  const response = await fetch(GOOGLE_ROUTES_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
      destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
      travelMode: "TRANSIT",
      languageCode: "es",
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Routes API ${response.status}: ${text.slice(0, 200)}`)
  }

  const data = await response.json()
  const route = data.routes?.[0]
  if (!route?.legs?.[0]) return null

  const leg = route.legs[0]

  const steps = (leg.steps || []).map((step) => {
    const base = {
      travelMode: step.travelMode,
      startLocation: {
        lat: step.startLocation?.latLng?.latitude ?? 0,
        lng: step.startLocation?.latLng?.longitude ?? 0,
      },
      endLocation: {
        lat: step.endLocation?.latLng?.latitude ?? 0,
        lng: step.endLocation?.latLng?.longitude ?? 0,
      },
      polyline: step.polyline?.encodedPolyline ?? "",
      distanceText: step.localizedValues?.distance?.text ?? "",
      durationText: step.localizedValues?.staticDuration?.text ?? "",
    }

    if (step.transitDetails) {
      const td = step.transitDetails
      base.transitDetails = {
        lineName: td.transitLine?.name ?? "",
        lineShort: td.transitLine?.nameShort ?? "",
        vehicle: td.transitLine?.vehicle?.name?.text ?? "",
        color: td.transitLine?.color ?? "#0A84FF",
        textColor: td.transitLine?.textColor ?? "#ffffff",
        agency: td.transitLine?.agencies?.[0]?.name ?? "",
        departureStop: td.stopDetails?.departureStop?.name ?? "",
        arrivalStop: td.stopDetails?.arrivalStop?.name ?? "",
        stopCount: td.stopCount ?? 0,
        headsign: td.headsign ?? "",
      }
    }

    return base
  })

  const transitLines = steps.filter((s) => s.transitDetails).map((s) => s.transitDetails)

  return {
    totalDistanceMeters: leg.distanceMeters ?? 0,
    totalDurationSeconds: parseInt(String(leg.duration)?.replace("s", "") ?? "0"),
    polyline: route.polyline?.encodedPolyline ?? "",
    steps,
    transitLines,
  }
}

// ── Main ──

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const cityFilter = args.find((a) => a.startsWith("--city="))?.split("=")[1]

console.log("🚇 Populate Transit Routes")
console.log(`  Dry run: ${dryRun}`)
if (cityFilter) console.log(`  City filter: ${cityFilter}`)
console.log()

// 1. Get all trips with their destinations
const { data: trips, error: tripsErr } = await supabase
  .from("trips")
  .select("id, destination, name")

if (tripsErr) {
  console.error("Failed to fetch trips:", tripsErr.message)
  process.exit(1)
}

console.log(`Found ${trips.length} trips`)

// Filter to transit cities
const transitTrips = trips.filter((t) => {
  const dest = (t.destination || "").toLowerCase().trim()
  if (cityFilter) return dest.includes(cityFilter.toLowerCase())
  return TRANSIT_CITIES.has(dest) || [...TRANSIT_CITIES].some((c) => dest.includes(c))
})

console.log(`${transitTrips.length} trips in transit-capable cities`)

// 2. Get activities for these trips
let totalPairs = 0
let fetched = 0
let cached = 0
let errors = 0
let noRoute = 0

for (const trip of transitTrips) {
  // Get activities ordered by day and time
  const { data: activities, error: actErr } = await supabase
    .from("activities")
    .select("id, name, latitude, longitude, trip_id, location")
    .eq("trip_id", trip.id)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("created_at", { ascending: true })

  if (actErr || !activities?.length) continue

  // Group by day (we'll process consecutive pairs)
  const withCoords = activities.filter((a) => a.latitude && a.longitude)

  console.log(`\n📍 ${trip.destination} — "${trip.name}" (${withCoords.length} activities)`)

  for (let i = 0; i < withCoords.length - 1; i++) {
    const from = withCoords[i]
    const to = withCoords[i + 1]
    const dist = haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude)

    // Only fetch transit for segments > 800m
    if (dist < 800) continue

    totalPairs++
    const key = cacheKey(from.latitude, from.longitude, to.latitude, to.longitude)

    // Check if already cached
    const { data: existing } = await supabase
      .from("transit_routes")
      .select("id")
      .eq("cache_key", key)
      .single()

    if (existing) {
      cached++
      continue
    }

    if (dryRun) {
      console.log(`  [DRY] ${from.name} → ${to.name} (${(dist / 1000).toFixed(1)}km)`)
      continue
    }

    try {
      const route = await fetchTransitRoute(from.latitude, from.longitude, to.latitude, to.longitude)

      if (!route) {
        noRoute++
        console.log(`  ❌ No route: ${from.name} → ${to.name}`)
        await sleep(200)
        continue
      }

      const lines = route.transitLines.map((l) => `${l.lineShort || l.vehicle}`).join(" → ")

      // Save to DB
      const { error: insertErr } = await supabase.from("transit_routes").upsert(
        {
          cache_key: key,
          origin_lat: from.latitude,
          origin_lng: from.longitude,
          dest_lat: to.latitude,
          dest_lng: to.longitude,
          origin_name: from.name,
          dest_name: to.name,
          city: trip.destination,
          total_distance_meters: route.totalDistanceMeters,
          total_duration_seconds: route.totalDurationSeconds,
          polyline: route.polyline,
          steps: route.steps,
          transit_lines: route.transitLines,
        },
        { onConflict: "cache_key" }
      )

      if (insertErr) {
        errors++
        console.log(`  ⚠️ DB error: ${insertErr.message}`)
      } else {
        fetched++
        console.log(`  ✅ ${from.name} → ${to.name} [${lines}] (${(dist / 1000).toFixed(1)}km, ${route.totalDurationSeconds}s)`)
      }

      await sleep(250) // rate limit
    } catch (err) {
      errors++
      console.log(`  ❌ Error: ${from.name} → ${to.name}: ${err.message?.slice(0, 100)}`)
      await sleep(500)
    }
  }
}

console.log("\n" + "=".repeat(50))
console.log(`📊 Results:`)
console.log(`  Total pairs (>800m): ${totalPairs}`)
console.log(`  Already cached:      ${cached}`)
console.log(`  Fetched new:         ${fetched}`)
console.log(`  No route found:      ${noRoute}`)
console.log(`  Errors:              ${errors}`)
console.log("=".repeat(50))
