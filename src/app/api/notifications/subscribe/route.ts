/**
 * POST /api/notifications/subscribe
 * Saves a Web Push subscription for the authenticated user.
 *
 * Body: { endpoint, keys: { p256dh, auth }, userAgent? }
 */

import { NextRequest, NextResponse } from "next/server"
import { createRouteSupabaseClient } from "@/lib/auth/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient()

    if (!supabase) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { endpoint, keys, userAgent } = body as {
      endpoint: string
      keys: { p256dh: string; auth: string }
      userAgent?: string
    }

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Missing required fields: endpoint, keys.p256dh, keys.auth" },
        { status: 400 }
      )
    }

    // Upsert: replace existing subscription for same endpoint
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: userAgent ?? req.headers.get("user-agent") ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      )

    if (error) {
      console.error("[push/subscribe] DB error:", error)
      return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[push/subscribe] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/notifications/subscribe
 * Removes a push subscription (unsubscribe).
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient()

    if (!supabase) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { endpoint } = await req.json()

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })
    }

    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[push/unsubscribe] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
