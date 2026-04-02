import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rate-limit"

interface Activity {
  name: string
  time: string
  duration_minutes?: number
  location?: string
  description?: string
}

interface DayRow {
  day_number: number
  date: string
  activities: Activity[]
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,\n]/g, (m) => {
    if (m === "\n") return "\\n"
    return `\\${m}`
  })
}

function toICSDate(dateStr: string, time: string): string {
  // dateStr: "2026-04-15", time: "09:00"
  const [y, m, d] = dateStr.split("-")
  const [h, min] = time.split(":")
  return `${y}${m}${d}T${h.padStart(2, "0")}${min.padStart(2, "0")}00`
}

function addMinutes(dateStr: string, time: string, minutes: number): string {
  const dt = new Date(`${dateStr}T${time}:00`)
  dt.setMinutes(dt.getMinutes() + minutes)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const d = String(dt.getDate()).padStart(2, "0")
  const h = String(dt.getHours()).padStart(2, "0")
  const min = String(dt.getMinutes()).padStart(2, "0")
  return `${y}${m}${d}T${h}${min}00`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const rl = await rateLimit(req, "calendar-export", 10, "1 m")
  if (!rl.ok) return rl.response!

  const { tripId } = await params

  try {
    const supabase = createServiceClient()

    const { data: trip } = await supabase
      .from("trips")
      .select("destination, country, start_date, end_date")
      .eq("id", tripId)
      .single()

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 })
    }

    const { data: days } = await supabase
      .from("itinerary_days")
      .select("day_number, date, activities")
      .eq("trip_id", tripId)
      .order("day_number")

    if (!days || days.length === 0) {
      return NextResponse.json({ error: "No itinerary days" }, { status: 404 })
    }

    // Build ICS
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Viaje360//Itinerary//ES",
      "CALSCALE:GREGORIAN",
      `X-WR-CALNAME:Viaje a ${trip.destination}`,
    ]

    for (const day of days as DayRow[]) {
      const activities = Array.isArray(day.activities) ? day.activities : []
      for (const act of activities) {
        if (!act.name || !act.time) continue
        const duration = act.duration_minutes ?? 60
        const dtStart = toICSDate(day.date, act.time)
        const dtEnd = addMinutes(day.date, act.time, duration)

        lines.push("BEGIN:VEVENT")
        lines.push(`DTSTART:${dtStart}`)
        lines.push(`DTEND:${dtEnd}`)
        lines.push(`SUMMARY:${escapeICS(act.name)}`)
        if (act.location) lines.push(`LOCATION:${escapeICS(act.location)}`)
        if (act.description) lines.push(`DESCRIPTION:${escapeICS(act.description)}`)
        lines.push(`UID:${tripId}-d${day.day_number}-${dtStart}@viaje360.app`)
        lines.push("END:VEVENT")
      }
    }

    lines.push("END:VCALENDAR")

    const ics = lines.join("\r\n")
    const filename = `viaje360-${trip.destination.toLowerCase().replace(/\s+/g, "-")}.ics`

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("[calendar] Export error:", err)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
