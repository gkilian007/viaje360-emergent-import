import * as Sentry from "@sentry/nextjs"
import { PostHog } from "posthog-node"
import { NextRequest } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { onboardingRequestSchema } from "@/lib/api/contracts"
import {
  errorResponse,
  normalizeRouteError,
  parseJsonBody,
  successResponse,
} from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { geocodeItinerary } from "@/lib/services/geocode.server"
import { generateItinerary, mapToAppTypes } from "@/lib/services/itinerary.service"
import { findReusableItinerary } from "@/lib/services/itinerary-library"
import { getPersonalRecommendationContext } from "@/lib/services/personal-recommendation"
import { ingestItineraryKnowledge } from "@/lib/services/trip-learning.db"
import { createTrip } from "@/lib/services/trip.service"
import { createServiceClient } from "@/lib/supabase/server"
import { requireAccess } from "@/lib/api/access-guard"

// Allow up to 120s for itinerary generation (Gemini API + geocoding + DB writes)
export const maxDuration = 120

export async function POST(req: NextRequest) {
  // Rate limit: allow normal iterative use without blocking legitimate trip planning.
  const rl = await rateLimit(req, "itinerary-generate", 20, "1 d")
  if (!rl.ok) {
    return errorResponse(
      "TOO_MANY_REQUESTS",
      "Has hecho demasiados intentos de generación en poco tiempo. Espera un rato y vuelve a intentarlo.",
      429
    )
  }

  try {
    const body = await parseJsonBody(req, onboardingRequestSchema)
    const identity = await resolveRequestIdentity()

    // Access guard: authenticated users go through the paywall/trial system.
    // Anonymous onboarding users are allowed to generate locally (rate-limited)
    // so the public funnel can be tested and used before login.
    if (identity.userId) {
      const guard = await requireAccess(identity.userId, body.destination, "canGenerate", body.startDate)
      if (!guard.ok) return guard.response
    }

    const personalization = await getPersonalRecommendationContext({
      userId: identity.userId,
      destination: body.destination,
      country: null,
    })

    const reusableItinerary = await findReusableItinerary(body)
    const generatedItinerary = reusableItinerary?.itinerary ?? await generateItinerary(body, { userId: identity.userId, personalization })

    // Quick inline geocoding pass: only validate LLM coords (fast, no Nominatim calls).
    // Full Nominatim geocoding runs in background after the trip is saved to DB.
    // This lets us respond to the user in ~2s instead of ~40s.
    {
      const { geocodeItineraryFast } = await import("@/lib/services/geocode.server")
      await geocodeItineraryFast(generatedItinerary, body.destination)
    }

    const localTripId = `trip-${Date.now()}`
    const { trip, days } = mapToAppTypes(generatedItinerary, localTripId)

    const appTrip = {
      ...trip,
      destination: body.destination,
      country: "",
      startDate: body.startDate,
      endDate: body.endDate,
    }

    let resolvedTripId = localTripId

    if (identity.userId) {
      try {
        const supabase = createServiceClient()
        const { data: onboardingRow } = await supabase
          .from("onboarding_profiles")
          .insert({
            user_id: identity.userId,
            destination: body.destination,
            start_date: body.startDate,
            end_date: body.endDate,
            arrival_time: body.arrivalTime ?? null,
            departure_time: body.departureTime ?? null,
            companion: body.companion ?? "solo",
            group_size: body.groupSize ?? 1,
            kids_pets: body.kidsPets ?? [],
            mobility: body.mobility ?? "full",
            accommodation_zone: body.accommodationZone || null,
            interests: body.interests ?? [],
            traveler_style: body.travelerStyle ?? null,
            famous_local: body.famousLocal < 33 ? "imprescindible" : body.famousLocal > 66 ? "autentico" : "mix",
            pace: Math.round(body.pace / 10),
            rest_days: body.wantsRestDays ?? false,
            rest_frequency: body.restDayFrequency ?? null,
            wake_style: Math.round(body.wakeTime / 10),
            siesta: body.wantsSiesta ?? false,
            budget_level: body.budget ?? "moderado",
            splurge_categories: body.splurge ?? [],
            dietary_restrictions: body.dietary ?? [],
            allergies: body.allergies || null,
            transport: body.transport ?? [],
            weather_adaptation: body.weatherAdaptation ?? true,
            first_time: body.firstTime ?? true,
            must_see: body.mustSee || null,
            must_avoid: body.mustAvoid || null,
            booked_tickets: body.alreadyBooked || null,
            timezone: (body as Record<string, unknown>).timezone as string || "Europe/Madrid",
          })
          .select()
          .single()

        if (onboardingRow) {
          const dbTrip = await createTrip(
            identity.userId,
            onboardingRow.id as string,
            generatedItinerary,
            body.startDate,
            body.endDate,
            body.destination
          )

          if (dbTrip) {
            resolvedTripId = dbTrip.id as string
          }
        }
      } catch (supabaseError) {
        console.warn("Supabase save skipped (fallback mode):", supabaseError)
      }
    }

        // Feed activity_knowledge with every generated activity
        ingestItineraryKnowledge(generatedItinerary, body.destination).catch((err) =>
          console.warn("[generate] activity_knowledge ingestion error:", err)
        )

        // Schedule push notifications if trip starts today or tomorrow
        if (identity.userId && resolvedTripId !== localTripId) {
          const { scheduleNotificationsForTrip } = await import("@/lib/services/notification-scheduler")
          const firstActivity = generatedItinerary.days[0]?.activities[0]
          scheduleNotificationsForTrip({
            userId: identity.userId,
            tripId: resolvedTripId,
            destination: body.destination,
            startDate: body.startDate,
            endDate: body.endDate,
            firstActivityName: firstActivity?.name,
          }).catch((err) => console.warn("[generate] notification scheduling error:", err))
        }

        // Background full geocoding — fills missing coords via Nominatim after saving
        // This runs async and updates the DB directly via /api/trips/backfill-geocode
        const tripIdForGeocode = resolvedTripId
        if (tripIdForGeocode !== localTripId) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://viaje360.app"
          fetch(`${baseUrl}/api/trips/backfill-geocode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripId: tripIdForGeocode }),
          }).catch((err) => console.warn("[generate] background geocode error:", err))
        }

    // Pre-fetch images for the first 10 activities — fire-and-forget, never block the response
    const allActivities = generatedItinerary.days.flatMap((d) => d.activities).slice(0, 10)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://viaje360.app"
    Promise.allSettled(
      allActivities.map((activity) =>
        Promise.race([
          fetch(`${baseUrl}/api/activity-assets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: activity.name,
              location: activity.location ?? "",
              destination: body.destination,
              type: activity.type ?? "tour",
              imageQuery: activity.imageQuery ?? activity.name,
              url: activity.url ?? undefined,
            }),
          }).catch((err) => console.warn("[generate] activity-assets prefetch error:", activity.name, err)),
          new Promise<void>((resolve) => setTimeout(resolve, 5000)),
        ])
      )
    ).catch((err) => console.warn("[generate] activity-assets Promise.allSettled error:", err))

    // PostHog server-side tracking
    try {
      const phKey = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY
      if (phKey && phKey !== "placeholder") {
        const ph = new PostHog(phKey, {
          host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
          flushAt: 1,
          flushInterval: 0,
        })
        const distinctId = identity.userId ?? `anon-${req.headers.get("x-forwarded-for") ?? "unknown"}`
        ph.capture({
          distinctId,
          event: "itinerary_generated",
          properties: {
            destination: body.destination,
            days: generatedItinerary.days.length,
            companion: body.companion ?? "solo",
            budget: body.budget ?? "moderado",
          },
        })
        await ph.shutdown()
      }
    } catch {
      // analytics must never block the response
    }

    return successResponse({
      trip: {
        ...appTrip,
        id: resolvedTripId,
      },
      days,
      itinerary: generatedItinerary,
      tripId: resolvedTripId,
      identity,
      generationSource: reusableItinerary
        ? {
            type: "library",
            sourceTripId: reusableItinerary.sourceTripId,
            sourceVersionId: reusableItinerary.sourceVersionId,
            score: reusableItinerary.score,
            reasons: reusableItinerary.reasons,
          }
        : {
            type: "ai",
          },
    })
  } catch (error) {
    console.error("itinerary/generate error:", error)
    Sentry.captureException(error)

    // Provide user-friendly error messages
    const errMsg = error instanceof Error ? error.message : ""
    if (errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("quota")) {
      const { errorResponse } = await import("@/lib/api/route-helpers")
      return errorResponse(
        "INTERNAL_ERROR",
        "La IA está muy ocupada en este momento. Por favor, inténtalo de nuevo en unos segundos.",
        503
      )
    }
    if (errMsg.includes("timed out") || errMsg.includes("timeout") || errMsg.includes("network")) {
      const { errorResponse } = await import("@/lib/api/route-helpers")
      return errorResponse(
        "INTERNAL_ERROR",
        "La conexión con la IA fue demasiado lenta. Por favor, inténtalo de nuevo.",
        503
      )
    }

    return normalizeRouteError(error, "Failed to generate itinerary")
  }
}
