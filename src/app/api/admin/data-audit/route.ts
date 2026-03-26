/**
 * Admin Data Audit API endpoint
 * GET /api/admin/data-audit
 *
 * Returns a snapshot of data quality metrics for Viaje360.
 * Protected by SUPABASE_SERVICE_ROLE_KEY (internal use only).
 */

import { NextRequest } from "next/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { successResponse, normalizeRouteError } from "@/lib/api/route-helpers"

function missingRate(arr: Record<string, unknown>[], field: string, total: number) {
  const missing = arr.filter(
    (r) => r[field] === null || r[field] === undefined || r[field] === ""
  ).length
  return {
    missing,
    total,
    pct: total > 0 ? Math.round((missing / total) * 100) : 0,
  }
}

function missingKnField(knowledge: Record<string, unknown>[], field: string) {
  const knTotal = knowledge.length
  const missing = knowledge.filter(
    (r) => r[field] === null || r[field] === undefined || r[field] === ""
  ).length
  return {
    missing,
    total: knTotal,
    pct: knTotal > 0 ? Math.round((missing / knTotal) * 100) : 0,
  }
}

function presentMetaField(knowledge: Record<string, unknown>[], metaKey: string) {
  const knTotal = knowledge.length
  const present = knowledge.filter((r) => {
    const meta = r.metadata as Record<string, unknown> | null
    return meta && meta[metaKey] !== null && meta[metaKey] !== undefined
  }).length
  return {
    present,
    total: knTotal,
    pct: knTotal > 0 ? Math.round((present / knTotal) * 100) : 0,
  }
}

export async function GET(req: NextRequest) {
  try {
    // Simple token check via Authorization header
    const authHeader = req.headers.get("Authorization")
    const token = authHeader?.replace("Bearer ", "")
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (token && token !== serviceKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (!isSupabaseConfigured()) {
      return successResponse({ error: "Supabase not configured" })
    }

    const supabase = createServiceClient()

    // Counts
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
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
      counts[table] = count ?? 0
    }

    // Activities coverage
    const { data: activities } = await supabase
      .from("activities")
      .select(
        "id, trip_id, name, address, latitude, longitude, booked, is_locked, description, url, image_query, price_per_person, recommendation_reason"
      )

    const total = activities?.length ?? 0
    const actArr = (activities ?? []) as Record<string, unknown>[]

    // Activity knowledge coverage
    const { data: knowledge } = await supabase
      .from("activity_knowledge")
      .select("id, canonical_name, official_url, booking_url, menu_url, image_query, metadata")
    const knArr = (knowledge ?? []) as Record<string, unknown>[]

    // Samples
    const activitiesMissingCoords = actArr
      .filter((a) => a.latitude === null || a.longitude === null)
      .slice(0, 5)
      .map((a) => ({ id: a.id, trip_id: a.trip_id, name: a.name }))

    const activitiesMissingDescription = actArr
      .filter((a) => !a.description)
      .slice(0, 5)
      .map((a) => ({ id: a.id, name: a.name }))

    const knowledgeMissingUrls = knArr
      .filter((k) => !k.official_url && !k.booking_url)
      .slice(0, 5)
      .map((k) => ({ id: k.id, canonical_name: k.canonical_name }))

    const report = {
      generatedAt: new Date().toISOString(),
      counts,
      coverage: {
        "activities.address": missingRate(actArr, "address", total),
        "activities.latitude": missingRate(actArr, "latitude", total),
        "activities.longitude": missingRate(actArr, "longitude", total),
        "activities.description": missingRate(actArr, "description", total),
        "activities.url": missingRate(actArr, "url", total),
        "activities.image_query": missingRate(actArr, "image_query", total),
        "activities.price_per_person": missingRate(actArr, "price_per_person", total),
        "activities.recommendation_reason": missingRate(actArr, "recommendation_reason", total),
        "activity_knowledge.official_url": missingKnField(knArr, "official_url"),
        "activity_knowledge.booking_url": missingKnField(knArr, "booking_url"),
        "activity_knowledge.image_query": missingKnField(knArr, "image_query"),
        "activity_knowledge.metadata.image_url": presentMetaField(knArr, "image_url"),
        "activity_knowledge.metadata.resolved_url": presentMetaField(knArr, "resolved_url"),
        "activity_knowledge.metadata.description": presentMetaField(knArr, "description"),
      },
      assetCache: {
        image_url_cached: presentMetaField(knArr, "image_url"),
        resolved_url_cached: presentMetaField(knArr, "resolved_url"),
      },
      samples: {
        activities_missing_coordinates: activitiesMissingCoords,
        activities_missing_description: activitiesMissingDescription,
        knowledge_missing_urls: knowledgeMissingUrls,
      },
    }

    return successResponse(report)
  } catch (error) {
    return normalizeRouteError(error, "Data audit failed")
  }
}
