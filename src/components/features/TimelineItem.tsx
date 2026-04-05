"use client"

import { useState } from "react"
import { AnimatePresence } from "framer-motion"
import type { TimelineActivity } from "@/lib/types"
import { ACTIVITY_ICONS, ACTIVITY_EMOJIS } from "@/lib/constants"
import { InlineActivityEditor } from "./InlineActivityEditor"

interface TimelineItemProps {
  activity: TimelineActivity
  /** 1-based index for this activity in the day (matches map marker number) */
  index?: number
  isFirst?: boolean
  isLast?: boolean
  isCurrent?: boolean
  nextActivity?: TimelineActivity | null
  destination?: string
  onClick?: (activity: TimelineActivity) => void
  onEdit?: (activityId: string, patch: { name: string; time: string; duration: number }) => Promise<void>
  onShowRoute?: (from: { lat: number; lng: number; name: string }, to: { lat: number; lng: number; name: string }, mode: "walking" | "transit" | "driving" | "bicycling") => void
}

export function TimelineItem({ activity, index, isFirst = false, isLast = false, isCurrent = false, nextActivity, destination, onClick, onEdit, onShowRoute }: TimelineItemProps) {
  const [showDirections, setShowDirections] = useState(false)
  const emoji = ACTIVITY_EMOJIS[activity.type] ?? ACTIVITY_EMOJIS.default
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async (patch: { name: string; time: string; duration: number }) => {
    if (onEdit) {
      await onEdit(activity.id, patch)
    }
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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
            <span className="text-[13px] leading-none">{emoji}</span>
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

      {/* Right: view card or inline editor */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {editing ? (
            <InlineActivityEditor
              key="editor"
              activity={activity}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <button
              key="view"
              type="button"
              onClick={() => onClick?.(activity)}
              className={`group w-full p-3 rounded-xl mb-3 text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${isCurrent ? "bg-[#0A84FF]/10 border border-[#0A84FF]/20" : "bg-[#1f1f21]/60 border border-white/[0.04] hover:bg-[#1f1f21]"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-semibold ${isCurrent ? "text-white" : "text-[#e4e2e4]"} flex items-center gap-1.5`}>
                    {index != null && (
                      <span
                        className="inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-full text-[10px] font-bold text-white"
                        style={{ background: isCurrent ? "#0A84FF" : "rgba(255,255,255,0.12)", lineHeight: 1 }}
                      >{index}</span>
                    )}
                    <span className="truncate">{activity.name}</span>
                    {saved && (
                      <span className="ml-2 text-[10px] text-[#30D158] font-normal shrink-0">✓ guardado</span>
                    )}
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
                  {/* Edit icon — visible on hover (desktop) or always on mobile */}
                  {onEdit && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditing(true) }}
                      className="p-1 rounded-lg opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity focus:opacity-60"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                      title="Editar actividad"
                      aria-label="Editar actividad"
                    >
                      <span className="material-symbols-outlined text-[14px] text-[#c0c6d6]">edit</span>
                    </button>
                  )}
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
          )}
        </AnimatePresence>

        {/* "Cómo llegar" CTA — only show when there's a next activity */}
        {nextActivity && !isLast && !editing && (
          <div className="mb-3">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowDirections(!showDirections) }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-semibold transition-all"
              style={{
                background: showDirections ? "rgba(10,132,255,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${showDirections ? "rgba(10,132,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                color: showDirections ? "#0A84FF" : "#888",
              }}
            >
              <span className="material-symbols-outlined text-[16px]">directions</span>
              Cómo llegar a la siguiente actividad
              <span className="material-symbols-outlined text-[14px]">{showDirections ? "expand_less" : "expand_more"}</span>
            </button>

            {showDirections && (() => {
              const fromCoords = activity.lat && activity.lng ? `${activity.lat},${activity.lng}` : encodeURIComponent(`${activity.name}, ${destination ?? ""}`)
              const toCoords = nextActivity.lat && nextActivity.lng ? `${nextActivity.lat},${nextActivity.lng}` : encodeURIComponent(`${nextActivity.name}, ${destination ?? ""}`)

              const modes = [
                { icon: "directions_walk", label: "A pie", mode: "walking", color: "#30D158" },
                { icon: "directions_transit", label: "Transporte público", mode: "transit", color: "#0A84FF" },
                { icon: "directions_car", label: "Coche / Taxi", mode: "driving", color: "#FF9F0A" },
                { icon: "directions_bike", label: "Bicicleta", mode: "bicycling", color: "#BF5AF2" },
              ]

              const hasCoords = !!(activity.lat && activity.lng && nextActivity.lat && nextActivity.lng)

              return (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {modes.map((m) => {
                    if (hasCoords && onShowRoute) {
                      return (
                        <button
                          key={m.mode}
                          type="button"
                          onClick={() => onShowRoute(
                            { lat: activity.lat!, lng: activity.lng!, name: activity.name },
                            { lat: nextActivity.lat!, lng: nextActivity.lng!, name: nextActivity.name },
                            m.mode as "walking" | "transit" | "driving" | "bicycling"
                          )}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98] text-left"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: m.color,
                          }}
                        >
                          <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                          {m.label}
                        </button>
                      )
                    }
                    return (
                      <a
                        key={m.mode}
                        href={`https://www.google.com/maps/dir/?api=1&origin=${fromCoords}&destination=${toCoords}&travelmode=${m.mode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: m.color,
                        }}
                      >
                        <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                        {m.label}
                      </a>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
