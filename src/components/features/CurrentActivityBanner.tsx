"use client"

import type { TimelineActivity } from "@/lib/types"
import { ACTIVITY_ICONS } from "@/lib/constants"

interface CurrentActivityBannerProps {
  current: TimelineActivity | null
  next: TimelineActivity | null
  minutesRemaining: number
  minutesToNext: number
  progress: number
  isDayOver: boolean
  isDayNotStarted: boolean
}

export function CurrentActivityBanner({
  current,
  next,
  minutesRemaining,
  minutesToNext,
  progress,
  isDayOver,
  isDayNotStarted,
}: CurrentActivityBannerProps) {
  if (isDayOver) {
    return (
      <div
        className="mx-5 mb-4 p-3.5 rounded-2xl"
        style={{ background: "rgba(48,209,88,0.08)", border: "1px solid rgba(48,209,88,0.15)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[18px]">🎉</span>
          <div>
            <p className="text-[13px] font-semibold text-[#30D158]">¡Día completado!</p>
            <p className="text-[11px] text-[#888]">Todas las actividades del día terminadas</p>
          </div>
        </div>
      </div>
    )
  }

  if (isDayNotStarted && next) {
    return (
      <div
        className="mx-5 mb-4 p-3.5 rounded-2xl"
        style={{ background: "rgba(10,132,255,0.08)", border: "1px solid rgba(10,132,255,0.15)" }}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#0A84FF]">
            {ACTIVITY_ICONS[next.type] ?? "place"}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[#0A84FF] font-medium">Próxima actividad</p>
            <p className="text-[13px] font-semibold text-white truncate">{next.name}</p>
            <p className="text-[11px] text-[#888]">
              Empieza a las {next.time} · en {minutesToNext} min
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!current) {
    if (next) {
      return (
        <div
          className="mx-5 mb-4 p-3.5 rounded-2xl"
          style={{ background: "rgba(255,159,10,0.08)", border: "1px solid rgba(255,159,10,0.15)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[18px]">🚶</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#FF9F0A] font-medium">En camino</p>
              <p className="text-[13px] font-semibold text-white truncate">{next.name}</p>
              <p className="text-[11px] text-[#888]">en {minutesToNext} min</p>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div
      className="mx-5 mb-4 p-3.5 rounded-2xl"
      style={{ background: "rgba(10,132,255,0.08)", border: "1px solid rgba(10,132,255,0.15)" }}
    >
      {/* Current activity */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="relative">
          <span className="material-symbols-outlined text-[22px] text-[#0A84FF]">
            {ACTIVITY_ICONS[current.type] ?? "place"}
          </span>
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#0A84FF] animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-[#0A84FF] font-medium">Ahora</p>
          <p className="text-[14px] font-semibold text-white truncate">{current.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[14px] font-bold text-white">{minutesRemaining}</p>
          <p className="text-[10px] text-[#888]">min restantes</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/10 mb-2.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#0A84FF] transition-all duration-1000"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Next up */}
      {next && (
        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
          <span className="material-symbols-outlined text-[14px] text-[#888]">
            {ACTIVITY_ICONS[next.type] ?? "place"}
          </span>
          <p className="text-[11px] text-[#888] truncate flex-1">
            Siguiente: <span className="text-[#c0c6d6] font-medium">{next.name}</span>
          </p>
          <p className="text-[11px] text-[#888] shrink-0">en {minutesToNext} min</p>
        </div>
      )}
    </div>
  )
}
