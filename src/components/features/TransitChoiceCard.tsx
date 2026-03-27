"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { resolveMobilityProfile } from "@/lib/mobility"
import {
  buildTransferContext,
  shouldOfferTransitChoice,
  type TransferSummary,
} from "@/lib/transit"

interface TransitChoiceCardProps {
  fromActivity: string
  toActivity: string
  distanceMeters: number
  walkingMinutes: number
  destination: string
  /** 0-1 representing progress through the day (activity index / total activities) */
  dayProgress: number
  walkingMapsUrl: string
}

function formatDistance(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`
}

export function TransitChoiceCard({
  fromActivity,
  toActivity,
  distanceMeters,
  walkingMinutes,
  destination,
  dayProgress,
  walkingMapsUrl,
}: TransitChoiceCardProps) {
  const onboarding = useOnboardingStore((s) => s.data)
  const [dismissed, setDismissed] = useState(false)
  const [chosen, setChosen] = useState<"walk" | "transit" | null>(null)

  const profile = useMemo(
    () => resolveMobilityProfile({
      companion: onboarding.companion,
      kidsPets: onboarding.kidsPets,
      mobility: onboarding.mobility,
      transport: onboarding.transport,
    }),
    [onboarding.companion, onboarding.kidsPets, onboarding.mobility, onboarding.transport]
  )

  // Only render if this distance warrants a choice
  const shouldOffer = useMemo(
    () => shouldOfferTransitChoice(distanceMeters, profile.key),
    [distanceMeters, profile.key]
  )

  const summary = useMemo<TransferSummary | null>(() => {
    if (!shouldOffer) return null
    return buildTransferContext({
      fromActivity,
      toActivity,
      distanceMeters,
      walkingMinutes,
      destination,
      mobilityProfileKey: profile.key,
      dayProgress,
    })
  }, [shouldOffer, fromActivity, toActivity, distanceMeters, walkingMinutes, destination, profile.key, dayProgress])

  if (!shouldOffer || !summary || dismissed) return null

  // If user already chose, show compact confirmation
  if (chosen) {
    const opt = chosen === "walk" ? summary.walkingOption : summary.transitOption
    const icon = chosen === "walk" ? "🚶" : "🚇"
    return (
      <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-[#888] mx-5">
        <span>{icon}</span>
        <span>{opt.totalMinutes} min · {formatDistance(distanceMeters)}</span>
        <a
          href={opt.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0A84FF] underline underline-offset-2"
        >
          Ver ruta
        </a>
      </div>
    )
  }

  const { walkingOption, transitOption, recommendTransit, rationale } = summary

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="mx-5 my-2 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(22,22,26,0.95)",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#BF5AF2]">route</span>
            <p className="text-[12px] font-semibold text-white">
              ¿Cómo ir a <span className="text-[#BF5AF2]">{toActivity}</span>?
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-[#555] hover:text-[#888] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Rationale */}
        <p className="px-4 pb-3 text-[11px] text-[#888] leading-relaxed">{rationale}</p>

        {/* Options */}
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          {/* Walking option */}
          <button
            onClick={() => setChosen("walk")}
            className="flex flex-col gap-1.5 p-3 rounded-xl text-left transition-all hover:bg-white/5"
            style={{
              background: recommendTransit ? "rgba(255,255,255,0.03)" : "rgba(48,209,88,0.08)",
              border: recommendTransit
                ? "1px solid rgba(255,255,255,0.06)"
                : "1px solid rgba(48,209,88,0.25)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[20px]">🚶</span>
              {!recommendTransit && (
                <span className="text-[9px] font-bold text-[#30D158] bg-[#30D158]/15 px-1.5 py-0.5 rounded-full">
                  Recomendado
                </span>
              )}
            </div>
            <p className="text-[12px] font-bold text-white">{walkingOption.totalMinutes} min</p>
            <p className="text-[10px] text-[#888]">{formatDistance(distanceMeters)} · Gratis</p>
            <p className="text-[10px] text-[#c0c6d6] leading-tight line-clamp-2">{walkingOption.hint}</p>
          </button>

          {/* Transit option */}
          <button
            onClick={() => setChosen("transit")}
            className="flex flex-col gap-1.5 p-3 rounded-xl text-left transition-all hover:bg-white/5"
            style={{
              background: recommendTransit ? "rgba(10,132,255,0.09)" : "rgba(255,255,255,0.03)",
              border: recommendTransit
                ? "1px solid rgba(10,132,255,0.28)"
                : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[20px]">🚇</span>
              {recommendTransit && (
                <span className="text-[9px] font-bold text-[#0A84FF] bg-[#0A84FF]/15 px-1.5 py-0.5 rounded-full">
                  Recomendado
                </span>
              )}
            </div>
            <p className="text-[12px] font-bold text-white">{transitOption.totalMinutes} min</p>
            <p className="text-[10px] text-[#888]">
              {transitOption.fareAmount}{transitOption.fareCurrency} · Metro/Bus
            </p>
            <p className="text-[10px] text-[#c0c6d6] leading-tight line-clamp-2">{transitOption.hint}</p>
          </button>
        </div>

        {/* Footer links */}
        <div className="flex items-center gap-4 px-4 pb-3">
          <a
            href={walkingMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#0A84FF] flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[13px]">map</span>
            Ver en maps
          </a>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
