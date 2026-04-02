/**
 * Notification scheduler — stores upcoming push notifications in Supabase.
 *
 * A cron/edge worker (TODO) reads `scheduled_notifications` where
 * `scheduled_at <= now() AND sent = false` and calls /api/notifications/send
 * for each, then marks them as sent.
 *
 * This module only handles WRITING scheduled rows. Dispatching is a TODO.
 */

import { createServiceClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface ScheduleActivityNotificationOptions {
  userId: string
  tripId: string
  destination: string
  startDate: string   // ISO date, e.g. "2026-04-05"
  endDate: string     // ISO date, e.g. "2026-04-08"
  /** First-activity name for the first-day reminder (optional) */
  firstActivityName?: string
}

interface NotificationRow {
  user_id: string
  trip_id: string
  activity_name: string
  title: string
  body: string
  url: string
  scheduled_at: string
}

/**
 * Schedules push notifications for a trip:
 * 1. A "trip starts soon" reminder if the trip starts today or tomorrow.
 * 2. A diary reminder at 21:00 local time for each day of the trip.
 *
 * Uses UTC as a proxy for local time. A proper implementation would store
 * the user's timezone during onboarding and shift accordingly.
 */
export async function scheduleNotificationsForTrip(
  opts: ScheduleActivityNotificationOptions
): Promise<void> {
  const supabase = createServiceClient()

  const rows: NotificationRow[] = []
  const now = new Date()

  const start = new Date(`${opts.startDate}T00:00:00Z`)
  const end = new Date(`${opts.endDate}T23:59:59Z`)

  // Clamp start to at least now + 30 min
  const earliest = new Date(now.getTime() + 30 * 60 * 1000)

  // 1. "Trip starts soon" notification (if trip starts today or tomorrow)
  const msToStart = start.getTime() - now.getTime()
  const daysToStart = msToStart / 86400000
  if (daysToStart >= 0 && daysToStart <= 2) {
    const reminderTime = new Date(start)
    reminderTime.setUTCHours(8, 0, 0, 0) // 08:00 on start day
    if (reminderTime > earliest) {
      rows.push({
        user_id: opts.userId,
        trip_id: opts.tripId,
        activity_name: opts.firstActivityName ?? "",
        title: `✈️ ¡Tu viaje a ${opts.destination} empieza hoy!`,
        body: opts.firstActivityName
          ? `Primera actividad: ${opts.firstActivityName}. ¡Que lo disfrutes!`
          : "Abre Viaje360 para ver tu itinerario.",
        url: "/plan",
        scheduled_at: reminderTime.toISOString(),
      })
    }
  }

  // 2. Diary reminder at 21:00 for each day of the trip
  const tripDay = new Date(start)
  while (tripDay <= end) {
    const diaryReminder = new Date(tripDay)
    diaryReminder.setUTCHours(21, 0, 0, 0) // 21:00 UTC

    if (diaryReminder > earliest) {
      rows.push({
        user_id: opts.userId,
        trip_id: opts.tripId,
        activity_name: "",
        title: `📝 ¿Cómo fue tu día en ${opts.destination}?`,
        body: "Abre Viaje360 para escribir en tu diario",
        url: "/plan/diary",
        scheduled_at: diaryReminder.toISOString(),
      })
    }

    tripDay.setUTCDate(tripDay.getUTCDate() + 1)
  }

  if (rows.length === 0) return

  const { error } = await (supabase as SupabaseClient)
    .from("scheduled_notifications")
    .insert(rows)

  if (error) {
    // Non-fatal: scheduling failures must never break itinerary generation
    console.warn("[notification-scheduler] Failed to schedule notifications:", error.message)
  } else {
    console.log(`[notification-scheduler] Scheduled ${rows.length} notifications for trip ${opts.tripId}`)
  }
}
