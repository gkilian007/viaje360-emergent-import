/**
 * Fire-and-forget hook for recording activity interaction events.
 * Usage: const track = useActivityEvent(tripId)
 *        track("detail_opened", activityId)
 */

import { useCallback } from "react"

type EventType =
  | "detail_opened"
  | "booking_clicked"
  | "menu_clicked"
  | "url_clicked"
  | "activity_replaced"
  | "activity_removed"
  | "activity_saved"
  | "activity_completed"
  | "activity_skipped"
  | "activity_liked"
  | "activity_disliked"
  | "map_opened"
  | "directions_opened"

export function useActivityEvent(tripId: string | null) {
  return useCallback(
    (eventType: EventType, activityId: string, metadata?: Record<string, unknown>) => {
      if (!tripId || !activityId) return

      fetch("/api/activity-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          activityId,
          eventType,
          metadata: metadata ?? null,
        }),
      }).catch(() => {
        // Fire and forget — don't block UI
      })
    },
    [tripId]
  )
}
