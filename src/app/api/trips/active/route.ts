import { NextResponse } from "next/server"
import { getActiveTrip } from "@/lib/services/trip.service"
import { getItinerary, mapDbItineraryToAppTypes } from "@/lib/services/itinerary.service"

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

export async function GET() {
  try {
    const trip = await getActiveTrip(DEMO_USER_ID)
    if (!trip) {
      return NextResponse.json({ trip: null, days: [] })
    }

    const itinerary = await getItinerary(trip.id)
    if (!itinerary) {
      return NextResponse.json({ trip: null, days: [] })
    }

    const mapped = mapDbItineraryToAppTypes(itinerary.trip, itinerary.days)
    return NextResponse.json(mapped)
  } catch (err) {
    console.error("trips/active error:", err)
    return NextResponse.json({ trip: null, days: [] }, { status: 200 })
  }
}
