"use client"

import { motion, AnimatePresence } from "framer-motion"
import type { TripIssue } from "@/lib/proactive-adaptation"

interface ProactiveAdaptationBannerProps {
  issue: TripIssue
  isAdapting: boolean
  onAdapt: (issue: TripIssue) => void
  onDismiss: (issue: TripIssue) => void
}

const SEVERITY_STYLES = {
  critical: {
    bg: "rgba(255,69,58,0.09)",
    border: "rgba(255,69,58,0.22)",
    button: "rgba(255,69,58,0.85)",
    badge: { bg: "rgba(255,69,58,0.15)", color: "#FF453A", label: "Urgente" },
  },
  warning: {
    bg: "rgba(255,159,10,0.08)",
    border: "rgba(255,159,10,0.20)",
    button: "rgba(255,159,10,0.85)",
    badge: { bg: "rgba(255,159,10,0.15)", color: "#FF9F0A", label: "Recomendado" },
  },
  info: {
    bg: "rgba(10,132,255,0.08)",
    border: "rgba(10,132,255,0.18)",
    button: "rgba(10,132,255,0.85)",
    badge: { bg: "rgba(10,132,255,0.15)", color: "#0A84FF", label: "Sugerencia" },
  },
}

export function ProactiveAdaptationBanner({
  issue,
  isAdapting,
  onAdapt,
  onDismiss,
}: ProactiveAdaptationBannerProps) {
  const style = SEVERITY_STYLES[issue.severity]

  return (
    <AnimatePresence>
      <motion.div
        key={`${issue.kind}-${issue.dayNumber}`}
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.25 }}
        className="mx-5 mb-3 rounded-2xl overflow-hidden"
        style={{
          background: style.bg,
          border: `1px solid ${style.border}`,
        }}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <span className="text-[28px] shrink-0 leading-none mt-0.5">{issue.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="text-[14px] font-bold text-white">{issue.title}</p>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: style.badge.bg, color: style.badge.color }}
                >
                  {style.badge.label}
                </span>
                <span className="text-[10px] text-[#666] ml-auto shrink-0">
                  Día {issue.dayNumber}
                </span>
              </div>
              <p className="text-[12px] text-[#aaa] leading-relaxed">{issue.description}</p>
            </div>
            <button
              onClick={() => onDismiss(issue)}
              className="text-[#444] hover:text-[#888] transition-colors shrink-0 -mt-0.5"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Action area */}
          <div className="flex items-center gap-2 mt-3 ml-10">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onAdapt(issue)}
              disabled={isAdapting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all"
              style={{ background: style.button, opacity: isAdapting ? 0.6 : 1 }}
            >
              {isAdapting ? (
                <>
                  <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                  Adaptando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                  Adaptar itinerario
                </>
              )}
            </motion.button>
            <button
              onClick={() => onDismiss(issue)}
              className="px-3 py-2 rounded-xl text-[11px] text-[#777] hover:text-[#aaa] transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              No, gracias
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
