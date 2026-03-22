import { NextRequest, NextResponse } from "next/server"
import type { OnboardingData } from "@/lib/onboarding-types"
import { generateItinerary, mapToAppTypes } from "@/lib/services/itinerary.service"
import { createTrip } from "@/lib/services/trip.service"
import { createServiceClient } from "@/lib/supabase/server"

// Demo user ID used when no auth is present
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as OnboardingData

    if (!body.destination || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: "destination, startDate, and endDate are required" },
        { status: 400 }
      )
    }

    // 1. Generate itinerary via Gemini
    const generatedItinerary = await generateItinerary(body)

    // 2. Generate a local trip ID (used for mapping even if Supabase save fails)
    const localTripId = `trip-${Date.now()}`

    // 3. Map to app types (works without Supabase)
    const { trip, days } = mapToAppTypes(generatedItinerary, localTripId)

    // Populate destination info from onboarding data
    const appTrip = {
      ...trip,
      destination: body.destination,
      country: "",
      startDate: body.startDate,
      endDate: body.endDate,
    }

    // 4. Try to save to Supabase (non-blocking, demo mode if it fails)
    let supabaseTripId: string | null = null
    try {
      const supabase = createServiceClient()

      // Save onboarding profile
      const { data: onboardingRow } = await supabase
        .from("onboarding_profiles")
        .insert({
          user_id: DEMO_USER_ID,
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
          DEMO_USER_ID,
          onboardingRow.id as string,
          generatedItinerary,
          body.startDate,
          body.endDate,
          body.destination
        )
        if (dbTrip) {
          supabaseTripId = dbTrip.id as string
        }
      }
    } catch (supabaseErr) {
      // Supabase save failed — continue with local data
      console.warn("Supabase save skipped (demo mode):", supabaseErr)
    }

    return NextResponse.json({
      trip: {
        ...appTrip,
        id: supabaseTripId ?? localTripId,
      },
      days,
      itinerary: generatedItinerary,
      tripId: supabaseTripId ?? localTripId,
    })
  } catch (err) {
    console.error("itinerary/generate error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate itinerary" },
      { status: 500 }
    )
  }
}
