/**
 * POST /api/notifications/send
 * Sends a Web Push notification to one or all subscriptions of a user.
 *
 * Body:
 *   { userId, title, body, url?, tag?, targetEndpoint? }
 *
 * Requires service role key (internal use only — called by server-side scheduler).
 * Protected by Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */

import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

let vapidInitialized = false

function ensureVapidInitialized() {
  if (vapidInitialized) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL ?? "mailto:admin@viaje360.app"

  if (!publicKey || !privateKey) return false

  webpush.setVapidDetails(email, publicKey, privateKey)
  vapidInitialized = true
  return true
}

export async function POST(req: NextRequest) {
  // Internal endpoint — require service role key
  const authHeader = req.headers.get("Authorization")
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!ensureVapidInitialized()) {
    return NextResponse.json(
      { error: "VAPID keys not configured" },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const {
      userId,
      title,
      body: notifBody,
      url = "/",
      tag,
      targetEndpoint,
    } = body as {
      userId: string
      title: string
      body: string
      url?: string
      tag?: string
      targetEndpoint?: string
    }

    if (!userId || !title || !notifBody) {
      return NextResponse.json(
        { error: "Missing required fields: userId, title, body" },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )

    // Fetch user's subscriptions
    let query = supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId)

    if (targetEndpoint) {
      query = query.eq("endpoint", targetEndpoint)
    }

    const { data: subscriptions, error } = await query

    if (error) {
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: "No subscriptions found" })
    }

    const payload = JSON.stringify({
      title,
      body: notifBody,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      url,
      tag: tag || "viaje360-activity",
    })

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
      })
    )

    // Clean up expired subscriptions (410 Gone)
    const expiredEndpoints: string[] = []
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        const err = result.reason as { statusCode?: number }
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredEndpoints.push(subscriptions[i].endpoint)
        }
      }
    })

    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints)
    }

    const sent = results.filter(r => r.status === "fulfilled").length
    const failed = results.filter(r => r.status === "rejected").length

    return NextResponse.json({ ok: true, sent, failed })
  } catch (err) {
    console.error("[push/send] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
