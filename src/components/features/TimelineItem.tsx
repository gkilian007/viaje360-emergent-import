"use client"

import type { TimelineActivity } from "@/lib/types"
import { ACTIVITY_ICONS } from "@/lib/constants"

interface TimelineItemProps {
  activity: TimelineActivity
  isFirst?: boolean
  isLast?: boolean
  isCurrent?: boolean
  onClick?: (activity: TimelineActivity) => void
}

export function TimelineItem({ activity, isFirst = false, isLast = false, isCurrent = false, onClick }: TimelineItemProps) {
  const icon = activity.icon ?? ACTIVITY_ICONS[activity.type] ?? "place"

  return (
    <div className="flex gap-3">
      {/* Left: time + line */}
      <div className="flex flex-col items-center w-14 shrink-0">
        <span className="text-[11px] text-[#c0c6d6] font-medium whitespace-nowrap">
          {activity.time}
        </span>
        <div className="relative flex flex-col items-center flex-1 mt-1">
          {/* Icon node */}
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              isCurrent
                ? "bg-[#0A84FF] shadow-[0_0_12px_rgba(10,132,255,0.5)]"
                : activity.booked
                ? "bg-[#30D158]/20"
                : "bg-[#2a2a2c]"
            }`}
            style={{ border: isCurrent ? "none" : "1px solid rgba(255,255,255,0.08)" }}
          >
            <span
              className={`material-symbols-outlined text-[14px] ${
                isCurrent ? "text-white" : activity.booked ? "text-[#30D158]" : "text-[#c0c6d6]"
              }`}
              style={
                isCurrent
                  ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
                  : {}
              }
            >
              {icon}
            </span>
          </div>
          {/* Vertical line */}
          {!isLast && (
            <div
              className="w-px flex-1 mt-1"
              style={{
                background: isCurrent
                  ? "linear-gradient(180deg, #0A84FF, rgba(10,132,255,0.1))"
                  : "rgba(255,255,255,0.06)",
                minHeight: "32px",
              }}
            />
          )}
        </div>
      </div>

      {/* Right: content */}
      <button
        type="button"
        onClick={() => onClick?.(activity)}
        className={`flex-1 p-3 rounded-xl mb-3 text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${isCurrent ? "bg-[#0A84FF]/10 border border-[#0A84FF]/20" : "bg-[#1f1f21]/60 border border-white/[0.04] hover:bg-[#1f1f21]"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] font-semibold ${isCurrent ? "text-white" : "text-[#e4e2e4]"}`}>
              {activity.name}
            </p>
            <p className="text-[11px] text-[#c0c6d6] mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">location_on</span>
              {activity.location}
            </p>
            {(activity.description || activity.notes) && (
              <p className="text-[11px] text-[#d7d9df] mt-2 leading-relaxed line-clamp-3">
                {activity.description ?? activity.notes}
              </p>
            )}
            {activity.recommendationReason && (
              <div
                className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1"
                style={{ background: "rgba(10,132,255,0.12)", border: "1px solid rgba(10,132,255,0.16)" }}
              >
                <span className="material-symbols-outlined text-[11px] text-[#0A84FF]">auto_awesome</span>
                <span className="text-[10px] text-[#8fc2ff] font-medium line-clamp-1">
                  {activity.recommendationReason}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
            {(activity.pricePerPerson ?? activity.cost) > 0 && (
              <span className="text-[11px] text-[#c0c6d6] whitespace-nowrap">
                €{activity.pricePerPerson ?? activity.cost}
                {activity.pricePerPerson ? "/p" : ""}
              </span>
            )}
            {activity.booked && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(48, 209, 88, 0.15)", color: "#30D158" }}
              >
                Reservado
              </span>
            )}
            {activity.isLocked && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(255,159,10,0.15)", color: "#FF9F0A" }}
              >
                Fijo
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          {activity.duration > 0 && (
            <p className="text-[10px] text-[#c0c6d6] flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">schedule</span>
              {activity.duration} min
            </p>
          )}
          <span className="text-[10px] text-[#0A84FF] font-medium">
            Ver detalle
          </span>
        </div>
      </button>
    </div>
  )
}
