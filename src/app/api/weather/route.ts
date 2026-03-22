import { NextRequest, NextResponse } from "next/server"
import { getCurrentWeather, getForecast } from "@/lib/services/weather.service"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get("lat") ?? "")
    const lng = parseFloat(searchParams.get("lng") ?? "")
    const forecastDays = parseInt(searchParams.get("days") ?? "7", 10)

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: "lat and lng are required" },
        { status: 400 }
      )
    }

    const [current, forecast] = await Promise.all([
      getCurrentWeather(lat, lng),
      getForecast(lat, lng, forecastDays),
    ])

    return NextResponse.json({ current, forecast })
  } catch (err) {
    console.error("weather API error:", err)
    return NextResponse.json(
      { error: "Failed to fetch weather" },
      { status: 500 }
    )
  }
}
