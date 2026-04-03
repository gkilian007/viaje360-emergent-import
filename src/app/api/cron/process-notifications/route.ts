/**
 * GET /api/cron/process-notifications
 *
 * Cron worker that processes `scheduled_notifications` table:
 * 1. Finds rows where scheduled_at <= now() AND sent = false
 * 2. Sends push notification via /api/notifications/send
 * 3. Marks as sent (or logs failure)
 *
 * Should run every 5 minutes via Vercel Cron.
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"

let vapidInitialized = false

function ensureVapid() {
  if (vapidInitialized) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL ?? "mailto:admin@viaje360.app"
  if (!pub || !priv) return false
  webpush.setVapidDetails(email, pub, priv)
  vapidInitialized = true
  return true
}

export const maxDuration = 30

export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("Authorization")

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!ensureVapid()) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 500 })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    const now = new Date().toISOString()

    // Fetch pending notifications (max 50 per run to stay within timeout)
    const { data: pending, error: fetchErr } = await supabase
      .from("scheduled_notifications")
      .select("id, user_id, trip_id, activity_name, title, body, url, scheduled_at")
      .eq("sent", false)
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(50)

    if (fetchErr) {
      console.error("[cron/process-notifications] Fetch error:", fetchErr)
      return NextResponse.json({ error: "DB fetch failed" }, { status: 500 })
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, sent: 0, message: "No pending notifications" })
    }

    let sent = 0
    let failed = 0
    const processedIds: string[] = []

    for (const notif of pending) {
      try {
        // Fetch user's push subscriptions
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", notif.user_id)

        if (!subs || subs.length === 0) {
          // No subscriptions — mark as sent to avoid retrying forever
          processedIds.push(notif.id)
          continue
        }

        const payload = JSON.stringify({
          title: notif.title,
          body: notif.body,
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png",
          url: notif.url || "/plan",
          tag: `scheduled-${notif.trip_id}-${notif.id}`,
        })

        // Send to all user subscriptions
        const results = await Promise.allSettled(
          subs.map((sub) =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
          )
        )

        // Clean up expired subscriptions (410/404)
        const expiredEndpoints: string[] = []
        results.forEach((result, i) => {
          if (result.status === "rejected") {
            const err = result.reason as { statusCode?: number }
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              expiredEndpoints.push(subs[i].endpoint)
            }
          }
        })

        if (expiredEndpoints.length > 0) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .in("endpoint", expiredEndpoints)
        }

        const successCount = results.filter((r) => r.status === "fulfilled").length
        if (successCount > 0) sent++
        else failed++

        processedIds.push(notif.id)
      } catch (err) {
        console.warn(`[cron/process-notifications] Failed for ${notif.id}:`, err)
        failed++
        processedIds.push(notif.id) // Mark as processed to avoid infinite retry
      }
    }

    // Mark all processed as sent
    if (processedIds.length > 0) {
      await supabase
        .from("scheduled_notifications")
        .update({ sent: true, sent_at: new Date().toISOString() })
        .in("id", processedIds)
    }

    return NextResponse.json({
      ok: true,
      processed: processedIds.length,
      sent,
      failed,
    })
  } catch (error) {
    console.error("[cron/process-notifications] Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
