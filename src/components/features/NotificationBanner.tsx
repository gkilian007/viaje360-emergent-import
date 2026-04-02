"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { isPushSupported, getNotificationPermission, requestAndSubscribe } from "@/lib/notifications"

const DISMISS_KEY = "viaje360_notif_banner_dismissed_v1"

export function NotificationBanner() {
  const [visible, setVisible] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Only show if push is supported, permission is default (not asked yet), and not dismissed
    if (!isPushSupported()) return
    if (getNotificationPermission() !== "default") return
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY)) return
    setVisible(true)
  }, [])

  const handleActivate = async () => {
    setLoading(true)
    const subscription = await requestAndSubscribe()
    setLoading(false)
    setVisible(false)
    if (subscription) {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1")
    setVisible(false)
  }

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl p-4"
            style={{
              background: "linear-gradient(135deg, rgba(10,132,255,0.08), rgba(88,86,214,0.08))",
              border: "1px solid",
              borderImage: "linear-gradient(135deg, rgba(10,132,255,0.35), rgba(88,86,214,0.35)) 1",
              borderRadius: "16px",
            }}
          >
            <p className="text-[13px] text-[#e4e2e4] mb-3 leading-snug">
              🔔 ¿Quieres recibir avisos de tus actividades?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleActivate}
                disabled={loading}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
              >
                {loading ? "Activando..." : "Activar"}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 rounded-xl text-[12px] font-medium text-[#8e8e93] hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                Ahora no
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-28 left-4 right-4 lg:left-auto lg:right-8 lg:w-80 p-3 rounded-2xl z-50 flex items-center gap-2"
            style={{
              background: "rgba(48,209,88,0.15)",
              border: "1px solid rgba(48,209,88,0.35)",
              backdropFilter: "blur(20px)",
            }}
          >
            <span className="material-symbols-outlined text-[18px] text-[#30D158]">check_circle</span>
            <span className="text-[13px] text-white font-medium">¡Notificaciones activadas!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
