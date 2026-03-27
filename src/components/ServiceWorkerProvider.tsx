"use client"

import { useEffect } from "react"

/**
 * ServiceWorkerProvider — registers the Viaje360 service worker.
 * Handles: offline caching (app shell, map tiles, API responses) + push notifications.
 */
export function ServiceWorkerProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (process.env.NODE_ENV === "development") {
          console.log("[SW] Registered:", registration.scope)
        }

        // Check for updates every 30 min
        setInterval(() => registration.update(), 30 * 60 * 1000)
      })
      .catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[SW] Registration failed:", err)
        }
      })
  }, [])

  return null
}
