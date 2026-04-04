import { NextRequest, NextResponse } from "next/server"
import { getTransitRoute } from "@/lib/services/transit-routes.server"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const originLat = parseFloat(searchParams.get("olat") ?? "")
  const originLng = parseFloat(searchParams.get("olng") ?? "")
  const destLat = parseFloat(searchParams.get("dlat") ?? "")
  const destLng = parseFloat(searchParams.get("dlng") ?? "")
  const city = searchParams.get("city") ?? ""
  const originName = searchParams.get("oname") ?? undefined
  const destName = searchParams.get("dname") ?? undefined

  if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 })
  }

  const route = await getTransitRoute(
    originLat,
    originLng,
    destLat,
    destLng,
    city,
    originName,
    destName
  )

  if (!route) {
    return NextResponse.json({ error: "No transit route found" }, { status: 404 })
  }

  return NextResponse.json({ data: route })
}
