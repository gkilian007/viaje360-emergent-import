import { NextRequest, NextResponse } from "next/server"

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")
  if (!q) {
    return NextResponse.json({ error: "Missing q parameter" }, { status: 400 })
  }

  try {
    const params = new URLSearchParams({ q, format: "json", limit: "1" })
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Viaje360/1.0 (https://viaje360.app)",
      },
      next: { revalidate: 86400 }, // cache 24h
    })

    if (!res.ok) {
      return NextResponse.json({ data: null })
    }

    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ data: null })
    }

    return NextResponse.json({
      data: {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      },
    })
  } catch {
    return NextResponse.json({ data: null })
  }
}
