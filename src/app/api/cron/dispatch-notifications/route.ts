/**
 * POST /api/cron/dispatch-notifications
 *
 * Cron endpoint that:
 * 1. Finds active trips (started or starting within 24h)
 * 2. Evaluates proactive insights for each
 * 3. Schedules push notifications + stores in-app insights
 *
 * Should be called by Vercel Cron or external scheduler:
 * - 08:00 local time → context: "morning"
 * - 21:00 local time → context: "evening" + "postday"
 *
 * Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { evaluateProactiveInsights } from "@/lib/services/proactive-engine"

// Vercel Cron calls GET
export async function GET(req: NextRequest) {
  return handleCronDispatch(req)
}

// Manual trigger uses POST
export async function POST(req: NextRequest) {
  return handleCronDispatch(req)
}

async function handleCronDispatch(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("Authorization")

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Read context from query param (Vercel Cron) or body (manual POST)
    const queryContext = req.nextUrl.searchParams.get("context")
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {}
    const context = queryContext ?? (body as { context?: string }).context ?? "anytime"

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Find active trips: started and not yet ended, or starting within 24h
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 86400000)
    const todayStr = now.toISOString().slice(0, 10)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)

    const { data: activeTrips } = await supabase
      .from("trips")
      .select("id, user_id, destination, start_date, end_date, onboarding_id")
      .lte("start_date", tomorrowStr)
      .gte("end_date", todayStr)
      .limit(100)

    if (!activeTrips || activeTrips.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: "No active trips" })
    }

    let insightsGenerated = 0
    let notificationsSent = 0

    for (const trip of activeTrips) {
      try {
        const insights = await evaluateProactiveInsights({
          tripId: trip.id,
          userId: trip.user_id,
          context: context as "evening" | "morning" | "postday" | "anytime",
        })

        if (insights.length === 0) continue
        insightsGenerated += insights.length

        // Store insights for in-app display
        for (const insight of insights) {
          try {
            await supabase
              .from("proactive_insights")
              .upsert({
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
              }, { onConflict: "id" })
          } catch (storeErr) {
            console.warn(`[cron/proactive] Failed to store insight ${insight.id}:`, storeErr)
          }
        }

        // Send push for the most important insight
        const topInsight = insights[0]
        if (topInsight) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://viaje360.app"
            const pushRes = await fetch(`${baseUrl}/api/notifications/send`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                userId: trip.user_id,
                title: topInsight.title,
                body: topInsight.body.split("\n")[0], // First line only for push
                url: topInsight.actions?.[0]?.payload ?? "/plan",
                tag: `proactive-${topInsight.trigger}`,
              }),
            })
            if (pushRes.ok) {
              const result = await pushRes.json()
              notificationsSent += result.sent ?? 0
            }
          } catch (pushErr) {
            console.warn(`[cron/proactive] Push failed for trip ${trip.id}:`, pushErr)
          }
        }
      } catch (tripErr) {
        console.warn(`[cron/proactive] Failed for trip ${trip.id}:`, tripErr)
      }
    }

    return NextResponse.json({
      ok: true,
      processed: activeTrips.length,
      insightsGenerated,
      notificationsSent,
    })
  } catch (error) {
    console.error("[cron/proactive] Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
