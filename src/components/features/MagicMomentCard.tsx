"use client"

import { motion, AnimatePresence } from "framer-motion"
import type { MagicMomentSuggestion } from "@/lib/magic-moment"

interface MagicMomentCardProps {
  suggestion: MagicMomentSuggestion
  onAccept: () => void
  onDismiss: () => void
}

function formatDistance(m: number): string {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`
}

export function MagicMomentCard({ suggestion, onAccept, onDismiss }: MagicMomentCardProps) {
  const { poi, reason } = suggestion

  return (
    <AnimatePresence>
      <motion.div
        key={`magic-${poi.name}`}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="mx-5 mb-3 rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(191,90,242,0.10) 0%, rgba(88,86,214,0.10) 100%)",
          border: "1px solid rgba(191,90,242,0.25)",
        }}
      >
        <div className="p-4">
          {/* Header badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[14px]">✨</span>
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: "rgba(191,90,242,0.15)", color: "#BF5AF2" }}
            >
              Momento mágico
            </span>
            <span className="text-[10px] text-[#555] ml-auto flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">near_me</span>
              {formatDistance(poi.distanceMeters)}
            </span>
          </div>

          {/* POI info */}
          <div className="flex items-start gap-3 mb-3">
            <span className="text-[32px] shrink-0 leading-none">{poi.emoji ?? "📍"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-white leading-tight">{poi.name}</p>
              <p className="text-[11px] text-[#BF5AF2] mt-0.5">{poi.durationMinutes} min · {formatDistance(poi.distanceMeters)} caminando</p>
            </div>
            <button
              onClick={onDismiss}
              className="text-[#444] hover:text-[#777] transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Reason text */}
          <p className="text-[12px] text-[#c0c6d6] leading-relaxed mb-4">{reason}</p>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onAccept}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[13px] text-white"
              style={{
                background: "linear-gradient(135deg, #BF5AF2, #5856D6)",
              }}
            >
              <span className="material-symbols-outlined text-[16px]">near_me</span>
              Ir ahora
            </motion.button>
            <button
              onClick={onDismiss}
              className="px-4 py-3 rounded-xl text-[12px] text-[#777] hover:text-[#aaa] transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              Seguir el plan
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
