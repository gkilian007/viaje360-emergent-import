import { NextRequest, NextResponse } from "next/server"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params

  if (!tripId) {
    return NextResponse.json({ ok: false, message: "Missing tripId" }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, deleted: false, reason: "no-db" })
  }

  const identity = await resolveRequestIdentity()
  if (!identity.userId) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Verify ownership
  const { data: trip } = await supabase
    .from("trips")
    .select("id, user_id")
    .eq("id", tripId)
    .single()

  if (!trip || trip.user_id !== identity.userId) {
    return NextResponse.json({ ok: false, message: "Trip not found or not yours" }, { status: 404 })
  }

  // Delete activities first (FK), then trip
  await supabase.from("activities").delete().eq("trip_id", tripId)
  const { error } = await supabase.from("trips").delete().eq("id", tripId)

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: true })
}
