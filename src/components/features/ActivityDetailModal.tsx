"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { TimelineActivity } from "@/lib/types"
import { ACTIVITY_ICONS } from "@/lib/constants"

interface ActivityDetailModalProps {
  activity: TimelineActivity | null
  onClose: () => void
}

function ActivityImage({ query, name }: { query?: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!query) return
    // Use a free image proxy / placeholder based on the query
    const encoded = encodeURIComponent(query)
    setSrc(`https://source.unsplash.com/800x400/?${encoded}`)
  }, [query])

  if (!src || error) {
    // Gradient fallback
    const colors: Record<string, string> = {
      restaurant: "from-orange-600 to-red-600",
      museum: "from-purple-600 to-indigo-600",
      monument: "from-amber-600 to-yellow-600",
      park: "from-green-600 to-emerald-600",
      shopping: "from-pink-600 to-rose-600",
      tour: "from-blue-600 to-cyan-600",
    }
    return (
      <div className={`w-full h-48 bg-gradient-to-br ${colors.tour} flex items-center justify-center`}>
        <span className="text-white/60 text-6xl font-bold">{name.charAt(0)}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name}
      className="w-full h-48 object-cover"
      onError={() => setError(true)}
    />
  )
}

export function ActivityDetailModal({ activity, onClose }: ActivityDetailModalProps) {
  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const icon = activity?.icon ?? ACTIVITY_ICONS[activity?.type ?? "tour"] ?? "place"
  const isRestaurant = activity?.type === "restaurant"

  return (
    <AnimatePresence>
      {activity && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-hidden rounded-t-3xl"
            style={{
              background: "rgba(28, 28, 30, 0.98)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
            }}
          >
            {/* Pull handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Image */}
            <ActivityImage query={activity.imageQuery} name={activity.name} />

            {/* Content */}
            <div className="px-5 py-5 overflow-y-auto max-h-[45vh]">
              {/* Type badge + time */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide"
                  style={{
                    background: isRestaurant ? "rgba(255,159,10,0.15)" : "rgba(10,132,255,0.15)",
                    color: isRestaurant ? "#FF9F0A" : "#0A84FF",
                  }}
                >
                  {activity.type}
                </span>
                <span className="text-[12px] text-[#c0c6d6] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                  {activity.time} · {activity.duration} min
                </span>
              </div>

              {/* Name */}
              <h2 className="text-[22px] font-bold text-white leading-tight mb-1">
                {activity.name}
              </h2>

              {/* Location */}
              <p className="text-[13px] text-[#c0c6d6] flex items-center gap-1 mb-4">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                {activity.location}
              </p>

              {/* Description */}
              {activity.description && (
                <p className="text-[14px] text-[#e4e2e4] leading-relaxed mb-4">
                  {activity.description}
                </p>
              )}

              {/* Notes */}
              {activity.notes && !activity.description && (
                <p className="text-[14px] text-[#e4e2e4] leading-relaxed mb-4">
                  {activity.notes}
                </p>
              )}

              {/* Price section */}
              <div className="flex items-center gap-3 mb-5">
                {isRestaurant && activity.pricePerPerson ? (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-[#FF9F0A]">restaurant</span>
                    <span className="text-[16px] font-bold text-white">
                      ~€{activity.pricePerPerson}
                    </span>
                    <span className="text-[12px] text-[#c0c6d6]">/ persona</span>
                  </div>
                ) : activity.cost > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-[#30D158]">confirmation_number</span>
                    <span className="text-[16px] font-bold text-white">€{activity.cost}</span>
                    <span className="text-[12px] text-[#c0c6d6]">entrada</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-[#30D158]">check_circle</span>
                    <span className="text-[14px] text-[#30D158] font-medium">Gratis</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                {activity.url && (
                  <a
                    href={activity.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl font-semibold text-[14px] text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: isRestaurant
                        ? "linear-gradient(135deg, #FF9F0A, #FF6B00)"
                        : "linear-gradient(135deg, #0A84FF, #5856D6)",
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isRestaurant ? "menu_book" : "confirmation_number"}
                    </span>
                    {isRestaurant ? "Ver carta" : "Comprar entrada"}
                  </a>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-3.5 rounded-2xl font-semibold text-[14px] text-[#c0c6d6] transition-all hover:bg-white/10"
                  style={{
                    background: "rgba(42,42,44,0.8)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
