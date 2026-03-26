import { NextRequest, NextResponse } from "next/server"
import { getWalkingDirections } from "@/lib/services/directions.service"

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const fromLat = parseFloat(sp.get("fromLat") ?? "")
  const fromLng = parseFloat(sp.get("fromLng") ?? "")
  const toLat = parseFloat(sp.get("toLat") ?? "")
  const toLng = parseFloat(sp.get("toLng") ?? "")

  if ([fromLat, fromLng, toLat, toLng].some(isNaN)) {
    return NextResponse.json({ ok: false, error: "Missing coordinates" }, { status: 400 })
  }

  const result = await getWalkingDirections(fromLat, fromLng, toLat, toLng)
  if (!result) {
    return NextResponse.json({ ok: false, error: "Could not calculate route" }, { status: 502 })
  }

  return NextResponse.json({ ok: true, data: result })
}
