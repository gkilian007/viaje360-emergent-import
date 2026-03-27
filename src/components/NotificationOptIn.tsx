"use client"

import { useState, useEffect } from "react"
import {
  isPushSupported,
  getNotificationPermission,
  requestAndSubscribe,
  isSubscribed,
  unsubscribeFromPush,
} from "@/lib/notifications"

interface NotificationOptInProps {
  /** Show as compact icon button (for toolbar) vs full button */
  compact?: boolean
  className?: string
}

export function NotificationOptIn({ compact = false, className = "" }: NotificationOptInProps) {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [permission, setPermission] = useState<"granted" | "denied" | "default">("default")

  useEffect(() => {
    setSupported(isPushSupported())
    setPermission(getNotificationPermission())
    isSubscribed().then(setSubscribed)
  }, [])

  if (!supported) return null
  if (permission === "denied") return null

  async function handleToggle() {
    setLoading(true)
    try {
      if (subscribed) {
        await unsubscribeFromPush()
        setSubscribed(false)
        setPermission(getNotificationPermission())
      } else {
        const sub = await requestAndSubscribe()
        setSubscribed(sub !== null)
        setPermission(getNotificationPermission())
      }
    } catch (err) {
      console.error("[NotificationOptIn] Error:", err)
    } finally {
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        title={subscribed ? "Desactivar recordatorios" : "Activar recordatorios"}
        className={`p-2 rounded-xl transition-colors ${
          subscribed
            ? "text-blue-400 bg-blue-400/10"
            : "text-gray-400 hover:text-white"
        } ${className}`}
      >
        <span className="material-symbols-outlined text-[20px]">
          {loading ? "hourglass_empty" : subscribed ? "notifications_active" : "notifications"}
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
        subscribed
          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
          : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
      } ${loading ? "opacity-60 cursor-wait" : "cursor-pointer"} ${className}`}
    >
      <span className="material-symbols-outlined text-[18px]">
        {loading ? "hourglass_empty" : subscribed ? "notifications_active" : "notifications"}
      </span>
      <span>
        {loading
          ? "Procesando..."
          : subscribed
          ? "Recordatorios activados"
          : "Activar recordatorios"}
      </span>
    </button>
  )
}
