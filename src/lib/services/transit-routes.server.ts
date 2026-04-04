/**
 * Server-side transit route service with Supabase caching.
 * Uses Google Routes API (v2) for real transit directions with metro/bus details.
 */

import { createClient } from "@supabase/supabase-js"

const GOOGLE_ROUTES_API = "https://routes.googleapis.com/directions/v2:computeRoutes"
const API_KEY = process.env.GOOGLE_PLACES_API_KEY!
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

// ── Types ──

export interface TransitStepDetails {
  lineName: string
  lineShort: string
  vehicle: string
  color: string
  textColor: string
  agency: string
  departureStop: string
  arrivalStop: string
  stopCount: number
  headsign: string
}

export interface TransitStep {
  travelMode: "WALK" | "TRANSIT"
  startLocation: { lat: number; lng: number }
  endLocation: { lat: number; lng: number }
  polyline: string
  distanceText: string
  durationText: string
  transitDetails?: TransitStepDetails
}

export interface TransitRoute {
  totalDistanceMeters: number
  totalDurationSeconds: number
  polyline: string
  steps: TransitStep[]
  transitLines: TransitStepDetails[]
}

// ── Cache key ──

function cacheKey(lat1: number, lng1: number, lat2: number, lng2: number): string {
  return `${lat1.toFixed(4)},${lng1.toFixed(4)}->${lat2.toFixed(4)},${lng2.toFixed(4)}`
}

// ── Supabase client (singleton per request) ──

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Main function ──

export async function getTransitRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  city: string,
  originName?: string,
  destName?: string
): Promise<TransitRoute | null> {
  const supabase = getSupabase()
  const key = cacheKey(originLat, originLng, destLat, destLng)

  // 1. Check cache
  const { data: cached } = await supabase
    .from("transit_routes")
    .select("*")
    .eq("cache_key", key)
    .gt("expires_at", new Date().toISOString())
    .single()

  if (cached) {
    return {
      totalDistanceMeters: cached.total_distance_meters,
      totalDurationSeconds: cached.total_duration_seconds,
      polyline: cached.polyline,
      steps: cached.steps as TransitStep[],
      transitLines: (cached.transit_lines ?? []) as TransitStepDetails[],
    }
  }

  // 2. Fetch from Google Routes API
  try {
    const response = await fetch(GOOGLE_ROUTES_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: "TRANSIT",
        languageCode: "es",
      }),
    })

    if (!response.ok) return null
    const data = await response.json()
    const route = data.routes?.[0]
    if (!route?.legs?.[0]) return null

    const leg = route.legs[0]

    // Parse steps
    const steps: TransitStep[] = (leg.steps || []).map((step: any) => {
      const base: TransitStep = {
        travelMode: step.travelMode as "WALK" | "TRANSIT",
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

    const transitLines = steps.filter((s) => s.transitDetails).map((s) => s.transitDetails!)

    const result: TransitRoute = {
      totalDistanceMeters: leg.distanceMeters ?? 0,
      totalDurationSeconds: parseInt(String(leg.duration)?.replace("s", "") ?? "0"),
      polyline: route.polyline?.encodedPolyline ?? leg.polyline?.encodedPolyline ?? "",
      steps,
      transitLines,
    }

    // 3. Save to cache (fire-and-forget)
    supabase
      .from("transit_routes")
      .upsert(
        {
          cache_key: key,
          origin_lat: originLat,
          origin_lng: originLng,
          dest_lat: destLat,
          dest_lng: destLng,
          origin_name: originName,
          dest_name: destName,
          city,
          total_distance_meters: result.totalDistanceMeters,
          total_duration_seconds: result.totalDurationSeconds,
          polyline: result.polyline,
          steps: result.steps,
          transit_lines: result.transitLines,
        },
        { onConflict: "cache_key" }
      )
      .then(() => {})

    return result
  } catch (error) {
    console.error("Google Routes API error:", error)
    return null
  }
}
