#!/usr/bin/env node
/**
 * Backfill lat/lng for activities missing coordinates using Nominatim geocoding.
 * Deduplicates by location string to minimize API calls.
 * Rate limit: 1.1s between requests (Nominatim policy).
 *
 * Usage:
 *   node --import tsx scripts/backfill-geocoding.ts --dry-run
 *   node --import tsx scripts/backfill-geocoding.ts
 */

import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

function loadEnv(path = ".env.local") {
  const raw = fs.readFileSync(path, "utf8")
  return Object.fromEntries(
    raw.split(/\r?\n/)
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => { const i = line.indexOf("="); return [line.slice(0, i).trim(), line.slice(i + 1).trim()] })
  )
}

const isDryRun = process.argv.includes("--dry-run")
const NOMINATIM_DELAY = 1100 // ms

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

interface GeoResult { lat: number; lng: number }

async function geocode(query: string): Promise<GeoResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Viaje360/1.0 (geocoding backfill)" } })
    if (!res.ok) return null
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}

async function main() {
  const env = loadEnv()
  const supabase = createClient(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])

  console.log(`\n🌍 Viaje360 Geocoding Backfill ${isDryRun ? "(DRY RUN)" : "(WRITE MODE)"}`)
  console.log("─".repeat(60))

  // Fetch activities without coordinates
  const { data: activities, error } = await supabase
    .from("activities")
    .select("id, name, location, address, latitude, longitude, trip_id")
    .is("latitude", null)

  if (error || !activities) {
    console.error("Error fetching activities:", error?.message)
    process.exit(1)
  }

  console.log(`Activities without coordinates: ${activities.length}`)

  // Fetch trip destinations for context
  const tripIds = [...new Set(activities.map(a => a.trip_id))]
  const { data: trips } = await supabase
    .from("trips")
    .select("id, destination")
    .in("id", tripIds)

  const tripDestination = new Map<string, string>()
  for (const t of trips ?? []) tripDestination.set(t.id, t.destination ?? "")

  // Group activities by location string
  const locationGroups = new Map<string, typeof activities>()
  for (const act of activities) {
    const key = act.address || act.location || act.name
    if (!locationGroups.has(key)) locationGroups.set(key, [])
    locationGroups.get(key)!.push(act)
  }

  console.log(`Unique locations to geocode: ${locationGroups.size}`)
  const estimatedMin = Math.ceil(locationGroups.size * NOMINATIM_DELAY / 60000)
  console.log(`Estimated time: ~${estimatedMin} minutes\n`)

  const cache = new Map<string, GeoResult | null>()
  let geocoded = 0, failed = 0, updated = 0, errors = 0

  for (const [locationKey, acts] of locationGroups) {
    // Try with destination context first for better results
    const dest = tripDestination.get(acts[0].trip_id) ?? ""
    const queryWithContext = dest ? `${locationKey}, ${dest}` : locationKey

    await sleep(NOMINATIM_DELAY)
    let result = await geocode(queryWithContext)

    // If context query failed, try without
    if (!result && dest) {
      await sleep(NOMINATIM_DELAY)
      result = await geocode(locationKey)
    }

    // Last resort: try just name + destination
    if (!result && acts[0].name !== locationKey) {
      await sleep(NOMINATIM_DELAY)
      result = await geocode(dest ? `${acts[0].name}, ${dest}` : acts[0].name)
    }

    cache.set(locationKey, result)

    if (result) {
      geocoded++
      if (!isDryRun) {
        const ids = acts.map(a => a.id)
        for (const id of ids) {
          const { error: upErr } = await supabase
            .from("activities")
            .update({ latitude: result.lat, longitude: result.lng })
            .eq("id", id)
          if (upErr) errors++
          else updated++
        }
      }
    } else {
      failed++
    }

    const total = geocoded + failed
    if (total % 20 === 0 || total === locationGroups.size) {
      process.stdout.write(`\r  Progress: ${total}/${locationGroups.size} locations (${geocoded} ok, ${failed} failed)`)
    }
  }

  console.log(`\n\n📊 Results:`)
  console.log(`  Locations geocoded:  ${geocoded}/${locationGroups.size}`)
  console.log(`  Locations failed:    ${failed}/${locationGroups.size}`)
  if (!isDryRun) {
    console.log(`  Activities updated:  ${updated}`)
    console.log(`  Update errors:       ${errors}`)
  }

  // Show sample failures
  const failures = [...cache.entries()].filter(([,v]) => !v).slice(0, 5)
  if (failures.length) {
    console.log(`\n⚠️  Sample failed locations:`)
    for (const [loc] of failures) {
      console.log(`  - ${loc.slice(0, 80)}`)
    }
  }

  console.log(`\n${isDryRun ? "✅ Dry-run complete." : "✅ Backfill complete."}`)
}

main().catch(err => { console.error("Fatal:", err); process.exit(1) })
