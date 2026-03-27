"use client"

import { useMemo } from "react"
import { getSegmentMobilityAdvice, resolveMobilityProfile } from "@/lib/mobility"
import { useOnboardingStore } from "@/store/useOnboardingStore"

interface WalkingChipProps {
  walkingMinutes: number
  distanceMeters: number
  mapsUrl: string
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)}km`
}

export function WalkingChip({ walkingMinutes, distanceMeters, mapsUrl }: WalkingChipProps) {
  const onboarding = useOnboardingStore((s) => s.data)

  const profile = useMemo(
    () => resolveMobilityProfile({
      companion: onboarding.companion,
      kidsPets: onboarding.kidsPets,
      mobility: onboarding.mobility,
      transport: onboarding.transport,
    }),
    [onboarding.companion, onboarding.kidsPets, onboarding.mobility, onboarding.transport]
  )

  const advice = useMemo(
    () => getSegmentMobilityAdvice(distanceMeters, profile),
    [distanceMeters, profile]
  )

  const effectiveMapsUrl = advice.mode === "public-transport"
    ? mapsUrl.replace("travelmode=walking", "travelmode=transit")
    : mapsUrl

  const visual = advice.mode === "public-transport"
    ? {
        emoji: "🚇",
        label: "Transporte recomendado",
        icon: "directions_transit",
        background: "rgba(10,132,255,0.10)",
        border: "1px solid rgba(10,132,255,0.25)",
        color: "#9dd0ff",
      }
    : advice.mode === "walk-with-rest"
    ? {
        emoji: "🪑",
        label: "Paseo + descanso",
        icon: "airline_seat_recline_normal",
        background: "rgba(255,159,10,0.10)",
        border: "1px solid rgba(255,159,10,0.22)",
        color: "#ffd38d",
      }
    : {
        emoji: "🚶",
        label: `${walkingMinutes} min`,
        icon: "directions_walk",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        color: "#888",
      }

  return (
    <a
      href={effectiveMapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={advice.reason}
      className="flex items-center gap-1.5 py-1.5 px-3 mx-auto my-1 rounded-full text-[11px] transition-colors hover:bg-white/[0.06] w-fit"
      style={{
        background: visual.background,
        border: visual.border,
        color: visual.color,
      }}
    >
      <span className="text-[13px]">{visual.emoji}</span>
      <span className="font-medium">{visual.label}</span>
      <span className="text-[#555]">·</span>
      <span>{formatDistance(distanceMeters)}</span>
      <span className="material-symbols-outlined text-[12px] text-[#555] ml-0.5">{visual.icon}</span>
    </a>
  )
}
