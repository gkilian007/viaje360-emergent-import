#!/usr/bin/env node
/**
 * Viaje360 Data Quality Audit Script
 * Usage: node --import tsx scripts/audit-data-quality.ts
 * Output: JSON report to stdout
 */

import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

function loadEnv(path = ".env.local") {
  const raw = fs.readFileSync(path, "utf8")
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => {
        const idx = line.indexOf("=")
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
      })
  )
}

async function main() {
  const env = loadEnv()
  const url = env["NEXT_PUBLIC_SUPABASE_URL"]
  const key = env["SUPABASE_SERVICE_ROLE_KEY"]

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  const supabase = createClient(url, key)

  // ── 1. Counts ────────────────────────────────────────────────────────────────
  const tables = [
    "trips",
    "onboarding_profiles",
    "itinerary_days",
    "activities",
    "activity_knowledge",
    "itinerary_versions",
    "trip_activity_events",
    "adaptation_events",
  ]

  const counts: Record<string, number> = {}
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
    if (error) {
      console.error(`Error counting ${table}:`, error.message)
    }
    counts[table] = count ?? 0
  }

  // ── 2. Activities coverage ────────────────────────────────────────────────────
  const { data: activities, error: actError } = await supabase
    .from("activities")
    .select(
      "id, trip_id, name, address, latitude, longitude, booked, is_locked, description, url, image_query, price_per_person, recommendation_reason"
    )
  if (actError) {
    console.error("Error fetching activities:", actError.message)
    process.exit(1)
  }

  const total = activities?.length ?? 0

  function missingRate(arr: Record<string, unknown>[], field: string) {
    const missing = arr.filter(
      (r) => r[field] === null || r[field] === undefined || r[field] === ""
    ).length
    return {
      missing,
      total,
      pct: total > 0 ? Math.round((missing / total) * 100) : 0,
    }
  }

  // ── 3. activity_knowledge coverage ───────────────────────────────────────────
  const { data: knowledge, error: knError } = await supabase
    .from("activity_knowledge")
    .select("id, canonical_name, official_url, booking_url, menu_url, image_query, metadata")
  if (knError) {
    console.error("Error fetching activity_knowledge:", knError.message)
    process.exit(1)
  }

  const knTotal = knowledge?.length ?? 0

  function missingKnField(field: string) {
    const missing =
      knowledge?.filter(
        (r) => (r as Record<string, unknown>)[field] === null || (r as Record<string, unknown>)[field] === undefined || (r as Record<string, unknown>)[field] === ""
      ).length ?? 0
    return {
      missing,
      total: knTotal,
      pct: knTotal > 0 ? Math.round((missing / knTotal) * 100) : 0,
    }
  }

  function presentMetaField(metaKey: string) {
    const present =
      knowledge?.filter((r) => {
        const meta = r.metadata as Record<string, unknown> | null
        return meta && meta[metaKey] !== null && meta[metaKey] !== undefined
      }).length ?? 0
    return {
      present,
      total: knTotal,
      pct: knTotal > 0 ? Math.round((present / knTotal) * 100) : 0,
    }
  }

  // ── 4. Samples of problematic rows ──────────────────────────────────────────
  const activitiesMissingCoords = (activities ?? [])
    .filter((a) => a.latitude === null || a.longitude === null)
    .slice(0, 5)
    .map((a) => ({ id: a.id, trip_id: a.trip_id, name: a.name }))

  const activitiesMissingDescription = (activities ?? [])
    .filter((a) => !a.description)
    .slice(0, 5)
    .map((a) => ({ id: a.id, name: a.name }))

  const activitiesMissingUrl = (activities ?? [])
    .filter((a) => !a.url)
    .slice(0, 5)
    .map((a) => ({ id: a.id, name: a.name }))

  const activitiesMissingImageQuery = (activities ?? [])
    .filter((a) => !a.image_query)
    .slice(0, 5)
    .map((a) => ({ id: a.id, name: a.name }))

  const knowledgeMissingUrls = (knowledge ?? [])
    .filter((k) => !k.official_url && !k.booking_url)
    .slice(0, 5)
    .map((k) => ({ id: k.id, canonical_name: k.canonical_name }))

  // ── 5. Asset cache coverage ──────────────────────────────────────────────────
  const knWithImageUrl = knowledge?.filter((r) => {
    const meta = r.metadata as Record<string, unknown> | null
    return meta?.image_url !== null && meta?.image_url !== undefined
  }).length ?? 0
  const knWithResolvedUrl = knowledge?.filter((r) => {
    const meta = r.metadata as Record<string, unknown> | null
    return meta?.resolved_url !== null && meta?.resolved_url !== undefined
  }).length ?? 0

  const assetCacheHitRate = {
    image_url_cached: { count: knWithImageUrl, total: knTotal, pct: knTotal > 0 ? Math.round((knWithImageUrl / knTotal) * 100) : 0 },
    resolved_url_cached: { count: knWithResolvedUrl, total: knTotal, pct: knTotal > 0 ? Math.round((knWithResolvedUrl / knTotal) * 100) : 0 },
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  const report = {
    generatedAt: new Date().toISOString(),
    counts,
    coverage: {
      "activities.address": missingRate(activities ?? [], "address"),
      "activities.latitude": missingRate(activities ?? [], "latitude"),
      "activities.longitude": missingRate(activities ?? [], "longitude"),
      "activities.booked": missingRate(activities ?? [], "booked"),
      "activities.is_locked": missingRate(activities ?? [], "is_locked"),
      "activities.description": missingRate(activities ?? [], "description"),
      "activities.url": missingRate(activities ?? [], "url"),
      "activities.image_query": missingRate(activities ?? [], "image_query"),
      "activities.price_per_person": missingRate(activities ?? [], "price_per_person"),
      "activities.recommendation_reason": missingRate(activities ?? [], "recommendation_reason"),
      "activity_knowledge.official_url": missingKnField("official_url"),
      "activity_knowledge.booking_url": missingKnField("booking_url"),
      "activity_knowledge.menu_url": missingKnField("menu_url"),
      "activity_knowledge.image_query": missingKnField("image_query"),
      "activity_knowledge.metadata.image_url": presentMetaField("image_url"),
      "activity_knowledge.metadata.resolved_url": presentMetaField("resolved_url"),
      "activity_knowledge.metadata.description": presentMetaField("description"),
    },
    assetCache: assetCacheHitRate,
    samples: {
      activities_missing_coordinates: activitiesMissingCoords,
      activities_missing_description: activitiesMissingDescription,
      activities_missing_url: activitiesMissingUrl,
      activities_missing_image_query: activitiesMissingImageQuery,
      knowledge_missing_urls: knowledgeMissingUrls,
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
