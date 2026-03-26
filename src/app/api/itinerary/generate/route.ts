import { NextRequest } from "next/server"
import { onboardingRequestSchema } from "@/lib/api/contracts"
import {
  normalizeRouteError,
  parseJsonBody,
  successResponse,
} from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { geocodeItinerary } from "@/lib/services/geocode.server"
import { generateItinerary, mapToAppTypes } from "@/lib/services/itinerary.service"
import { getPersonalRecommendationContext } from "@/lib/services/personal-recommendation"
import { ingestItineraryKnowledge } from "@/lib/services/trip-learning.db"
import { createTrip } from "@/lib/services/trip.service"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req, onboardingRequestSchema)
    const identity = await resolveRequestIdentity()
    const personalization = await getPersonalRecommendationContext({
      userId: identity.userId,
      destination: body.destination,
      country: null,
    })

    const generatedItinerary = await generateItinerary(body, { userId: identity.userId, personalization })

    // Server-side geocoding: resolve coordinates for all activities before saving
    await geocodeItinerary(generatedItinerary, body.destination)

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

    return successResponse({
      trip: {
        ...appTrip,
        id: resolvedTripId,
      },
      days,
      itinerary: generatedItinerary,
      tripId: resolvedTripId,
      identity,
    })
  } catch (error) {
    console.error("itinerary/generate error:", error)
    return normalizeRouteError(error, "Failed to generate itinerary")
  }
}
