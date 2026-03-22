import { NextRequest, NextResponse } from "next/server"
import { adaptItinerary } from "@/lib/services/itinerary.service"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { tripId: string; reason: string }

    if (!body.tripId || !body.reason) {
      return NextResponse.json(
        { error: "tripId and reason are required" },
        { status: 400 }
      )
    }

    const adapted = await adaptItinerary(body.tripId, body.reason)

    if (!adapted) {
      return NextResponse.json(
        { error: "Could not adapt itinerary" },
        { status: 500 }
      )
    }

    return NextResponse.json({ itinerary: adapted })
  } catch (err) {
    console.error("itinerary/adapt error:", err)
    return NextResponse.json(
      { error: "Failed to adapt itinerary" },
      { status: 500 }
    )
  }
}
