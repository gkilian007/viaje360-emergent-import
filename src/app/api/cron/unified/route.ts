/**
 * GET /api/cron/unified
 *
 * Unified daily cron that handles ALL notification tasks:
 * 1. Process pending scheduled_notifications (trip reminders, diary prompts)
 * 2. Dispatch proactive insights for active trips
 *
 * Runs daily at 08:00 UTC via Vercel Cron.
 * Also callable manually with ?context=morning|evening|postday|process
 *
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import { evaluateProactiveInsights } from "@/lib/services/proactive-engine"

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

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("Authorization")

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!ensureVapid()) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 500 })
  }

  const context = req.nextUrl.searchParams.get("context") ?? "auto"
  const results: Record<string, unknown> = { context }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    // ── Step 1: Process pending scheduled notifications ──
    const processResult = await processScheduledNotifications(supabase)
    results.scheduled = processResult

    // ── Step 2: Dispatch proactive insights for active trips ──
    // Determine context based on time of day (UTC) if auto
    let proactiveContext = context
    if (context === "auto") {
      const hour = new Date().getUTCHours()
      if (hour >= 5 && hour < 12) proactiveContext = "morning"
      else if (hour >= 17 && hour < 20) proactiveContext = "evening"
      else if (hour >= 20 && hour < 23) proactiveContext = "postday"
      else proactiveContext = "anytime"
    }

    if (proactiveContext !== "process") {
      const proactiveResult = await dispatchProactiveInsights(
        supabase,
        serviceKey,
        proactiveContext as "morning" | "evening" | "postday" | "anytime"
      )
      results.proactive = proactiveResult
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (error) {
    console.error("[cron/unified] Error:", error)
    return NextResponse.json({ error: "Internal error", ...results }, { status: 500 })
  }
}

// ── Process Scheduled Notifications ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processScheduledNotifications(supabase: any) {
  const now = new Date().toISOString()

  const { data: pending, error } = await supabase
    .from("scheduled_notifications")
    .select("id, user_id, trip_id, activity_name, title, body, url, scheduled_at")
    .eq("sent", false)
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(50)

  if (error || !pending || pending.length === 0) {
    return { processed: 0, sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0
  const processedIds: string[] = []

  for (const notif of pending) {
    try {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", notif.user_id)

      if (!subs || subs.length === 0) {
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

      const results = await Promise.allSettled(
        subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
        )
      )

      // Clean up expired subscriptions
      const expired: string[] = []
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          const err = r.reason as { statusCode?: number }
          if (err?.statusCode === 410 || err?.statusCode === 404) expired.push(subs[i].endpoint)
        }
      })
      if (expired.length > 0) {
        await supabase.from("push_subscriptions").delete().in("endpoint", expired)
      }

      if (results.some((r) => r.status === "fulfilled")) sent++
      else failed++

      processedIds.push(notif.id)
    } catch {
      failed++
      processedIds.push(notif.id)
    }
  }

  if (processedIds.length > 0) {
    await supabase
      .from("scheduled_notifications")
      .update({ sent: true, sent_at: new Date().toISOString() })
      .in("id", processedIds)
  }

  return { processed: processedIds.length, sent, failed }
}

// ── Dispatch Proactive Insights ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dispatchProactiveInsights(
  supabase: any,
  _serviceKey: string,
  context: "morning" | "evening" | "postday" | "anytime"
) {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10)

  const { data: activeTrips } = await supabase
    .from("trips")
    .select("id, user_id, destination, start_date, end_date")
    .lte("start_date", tomorrowStr)
    .gte("end_date", todayStr)
    .limit(100)

  if (!activeTrips || activeTrips.length === 0) {
    return { trips: 0, insights: 0, pushSent: 0 }
  }

  let insightsGenerated = 0
  let pushSent = 0

  for (const trip of activeTrips) {
    try {
      const insights = await evaluateProactiveInsights({
        tripId: trip.id,
        userId: trip.user_id,
        context,
      })

      if (insights.length === 0) continue
      insightsGenerated += insights.length

      // Store insights for in-app display
      for (const insight of insights) {
        await supabase
          .from("proactive_insights")
          .upsert(
            {
              id: insight.id,
              user_id: trip.user_id,
              trip_id: trip.id,
              trigger: insight.trigger,
              severity: insight.severity,
              day_number: insight.dayNumber,
              title: insight.title,
              body: insight.body,
              actions: insight.actions ?? [],
              expires_at: insight.expiresAt ?? null,
              auto_adapt: insight.autoAdapt ?? false,
              created_at: now.toISOString(),
              seen: false,
              acted_on: false,
            },
            { onConflict: "id" }
          )
          .then(() => {})
          .catch(() => {})
      }

      // Send push for the top insight
      const top = insights[0]
      if (top) {
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", trip.user_id)

        if (subs && subs.length > 0) {
          const payload = JSON.stringify({
            title: top.title,
            body: top.body.split("\n")[0],
            icon: "/icon-192x192.png",
            badge: "/icon-192x192.png",
            url: top.actions?.[0]?.payload ?? "/plan",
            tag: `proactive-${top.trigger}`,
          })

          const results = await Promise.allSettled(
            subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
              webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
              )
            )
          )

          if (results.some((r) => r.status === "fulfilled")) pushSent++
        }
      }
    } catch (err) {
      console.warn(`[cron/unified] Trip ${trip.id} error:`, err)
    }
  }

  return { trips: activeTrips.length, insights: insightsGenerated, pushSent }
}
