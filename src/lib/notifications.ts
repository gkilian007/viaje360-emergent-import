/**
 * Push notification utilities for Viaje360.
 * Handles permission requests, SW subscription, and server registration.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

export type NotificationPermission = "granted" | "denied" | "default"

/**
 * Returns whether push notifications are supported in this browser.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  )
}

/**
 * Returns current notification permission status.
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied"
  return Notification.permission as NotificationPermission
}

/**
 * Converts a VAPID public key from base64url to Uint8Array.
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const arr = Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
  return arr.buffer
}

/**
 * Requests notification permission and subscribes to push.
 * Returns the subscription or null if denied/failed.
 */
export async function requestAndSubscribe(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn("[push] Not supported in this browser")
    return null
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error("[push] VAPID public key not configured")
    return null
  }

  // Request permission
  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    return null
  }

  // Get SW registration
  const registration = await navigator.serviceWorker.ready

  // Subscribe to push
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    // Register with server
    await registerSubscriptionWithServer(subscription)

    return subscription
  } catch (err) {
    console.error("[push] Subscription failed:", err)
    return null
  }
}

/**
 * Sends the push subscription to the Viaje360 server for storage.
 */
async function registerSubscriptionWithServer(subscription: PushSubscription): Promise<void> {
  const key = subscription.getKey("p256dh")
  const auth = subscription.getKey("auth")

  if (!key || !auth) throw new Error("Missing subscription keys")

  const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)))
  const authStr = btoa(String.fromCharCode(...new Uint8Array(auth)))

  const res = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: { p256dh, auth: authStr },
      userAgent: navigator.userAgent,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Server registration failed: ${JSON.stringify(err)}`)
  }
}

/**
 * Unsubscribes from push notifications and removes from server.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (!subscription) return

  // Remove from server first
  await fetch("/api/notifications/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })

  // Unsubscribe locally
  await subscription.unsubscribe()
}

/**
 * Checks if user is currently subscribed to push notifications.
 */
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch {
    return false
  }
}
