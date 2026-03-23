"use client"

import { useState, useEffect } from "react"
import { BottomNav } from "@/components/layout/BottomNav"
import { TopAppBar } from "@/components/layout/TopAppBar"
import { AssistantPill } from "@/components/features/AssistantPill"
import { AchievementOverlay } from "@/components/features/AchievementOverlay"
import { useAppStore } from "@/store/useAppStore"
import { DesktopLayout } from "@/components/layout/DesktopLayout"
import { MapView } from "@/components/features/MapView"
import { TimelineItem } from "@/components/features/TimelineItem"
import { demoItinerary } from "@/lib/demo-data"
import { ActivityDetailModal } from "@/components/features/ActivityDetailModal"
import type { TimelineActivity } from "@/lib/types"

function DaySelector({
  days,
  selectedDay,
  onSelect,
}: {
  days: number
  selectedDay: number
  onSelect: (day: number) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 py-1">
      {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
        <button
          key={day}
          onClick={() => onSelect(day)}
          className={`shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
            selectedDay === day
              ? "bg-[#0A84FF] text-white shadow-[0_0_12px_rgba(10,132,255,0.4)]"
              : "bg-[#2a2a2c] text-[#c0c6d6] hover:bg-[#3a3a3c]"
          }`}
        >
          Día {day}
        </button>
      ))}
    </div>
  )
}

function MobileStats({ trip, totalDays }: { trip: NonNullable<ReturnType<typeof useAppStore>["currentTrip"]>; totalDays: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar">
      {/* Budget */}
      <div
        className="shrink-0 px-4 py-3 rounded-2xl flex items-center gap-2.5"
        style={{ background: "rgba(42,42,44,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="material-symbols-outlined text-[18px] text-[#30D158]">payments</span>
        <div>
          <p className="text-[13px] font-bold text-white">€{trip.budget}</p>
          <p className="text-[10px] text-[#c0c6d6]">Presupuesto</p>
        </div>
      </div>
      {/* Days */}
      <div
        className="shrink-0 px-4 py-3 rounded-2xl flex items-center gap-2.5"
        style={{ background: "rgba(42,42,44,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="material-symbols-outlined text-[18px] text-purple-400">calendar_month</span>
        <div>
          <p className="text-[13px] font-bold text-white">{totalDays} días</p>
          <p className="text-[10px] text-[#c0c6d6]">{trip.destination}</p>
        </div>
      </div>
      {/* Activities count */}
      <div
        className="shrink-0 px-4 py-3 rounded-2xl flex items-center gap-2.5"
        style={{ background: "rgba(42,42,44,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="material-symbols-outlined text-[18px] text-[#0A84FF]">pin_drop</span>
        <div>
          <p className="text-[13px] font-bold text-white">{trip.startDate?.slice(5)}</p>
          <p className="text-[10px] text-[#c0c6d6]">al {trip.endDate?.slice(5)}</p>
        </div>
      </div>
    </div>
  )
}

export default function PlanPage() {
  const { pendingAchievement, currentTrip, generatedItinerary } = useAppStore()
  const itinerary = generatedItinerary ?? demoItinerary
  const [selectedDay, setSelectedDay] = useState(1)
  const [hydrated, setHydrated] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<TimelineActivity | null>(null)

  useEffect(() => {
    setHydrated(true)
  }, [])

  if (!hydrated) {
    return (
      <div className="min-h-screen map-bg flex items-center justify-center">
        <div className="text-[#c0c6d6] text-sm">Cargando itinerario...</div>
      </div>
    )
  }

  const today = itinerary[selectedDay - 1]
  const totalDays = itinerary.length

  return (
    <>
      {/* ── Mobile Layout ── */}
      <div className="lg:hidden flex flex-col h-screen bg-[#0f1117]">
        {/* Top bar */}
        <TopAppBar />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pt-[72px] pb-24">
          {/* Trip header */}
          <div className="px-5 pt-4 pb-3">
            <h1 className="text-[20px] font-bold text-white leading-tight">
              {currentTrip?.name ?? "Tu viaje"}
            </h1>
            <p className="text-[13px] text-[#c0c6d6] mt-0.5">
              {currentTrip?.destination}{currentTrip?.country ? `, ${currentTrip.country}` : ""}
            </p>
          </div>

          {/* Horizontal stats */}
          {currentTrip && (
            <div className="px-5 pb-4">
              <MobileStats trip={currentTrip} totalDays={totalDays} />
            </div>
          )}

          {/* Day selector */}
          <div className="px-5 pb-3">
            <DaySelector days={totalDays} selectedDay={selectedDay} onSelect={setSelectedDay} />
          </div>

          {/* Day theme */}
          {today && (
            <div className="px-5 pb-4">
              <div
                className="p-4 rounded-2xl"
                style={{ background: "rgba(10,132,255,0.08)", border: "1px solid rgba(10,132,255,0.15)" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[16px] text-[#0A84FF]">wb_sunny</span>
                  <span className="text-[11px] uppercase tracking-widest text-[#0A84FF] font-medium">
                    Día {selectedDay}
                  </span>
                </div>
                <p className="text-[14px] font-semibold text-white">
                  {today.activities.length} actividades planificadas
                </p>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="px-5">
            {today?.activities.map((activity, i) => (
              <TimelineItem
                key={activity.id}
                activity={activity}
                isFirst={i === 0}
                isLast={i === today.activities.length - 1}
                isCurrent={i === 0}
                onClick={setSelectedActivity}
              />
            ))}
            {(!today || today.activities.length === 0) && (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-[48px] text-[#c0c6d6]/30">beach_access</span>
                <p className="text-[#c0c6d6] mt-2">Día libre — ¡disfruta!</p>
              </div>
            )}
          </div>

          {/* Assistant pill */}
          <div className="px-5 pt-4 pb-2">
            <AssistantPill />
          </div>
        </div>

        {/* Bottom nav */}
        <BottomNav />
      </div>

      {/* ── Desktop Layout ── */}
      <div className="hidden lg:block h-screen">
        <DesktopLayout
          leftPanel={
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-white/5">
                <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-1">
                  {currentTrip?.destination}{currentTrip?.country ? `, ${currentTrip.country}` : ""}
                </p>
                <h1 className="text-[20px] font-bold text-white">{currentTrip?.name}</h1>
              </div>

              {/* Day selector */}
              <div className="px-6 py-3 border-b border-white/5">
                <DaySelector days={totalDays} selectedDay={selectedDay} onSelect={setSelectedDay} />
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-4">
                  Itinerario — Día {selectedDay}
                </p>
                {today?.activities.map((activity, i) => (
                  <TimelineItem
                    key={activity.id}
                    activity={activity}
                    isFirst={i === 0}
                    isLast={i === today.activities.length - 1}
                    isCurrent={i === 0}
                    onClick={setSelectedActivity}
                  />
                ))}
              </div>

              {/* Chat input */}
              <div className="px-6 pb-6 pt-2 border-t border-white/5">
                <AssistantPill />
              </div>
            </div>
          }
          rightPanel={<MapView />}
        />
      </div>

      {/* Activity detail modal */}
      <ActivityDetailModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />

      {/* Achievement overlay */}
      {pendingAchievement && <AchievementOverlay achievement={pendingAchievement} />}
    </>
  )
}
