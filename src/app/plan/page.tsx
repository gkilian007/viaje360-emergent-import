"use client"

import { BottomNav } from "@/components/layout/BottomNav"
import { TopAppBar } from "@/components/layout/TopAppBar"
import { TripCard } from "@/components/features/TripCard"
import { AssistantPill } from "@/components/features/AssistantPill"
import { MapView } from "@/components/features/MapView"
import { AchievementOverlay } from "@/components/features/AchievementOverlay"
import { useAppStore } from "@/store/useAppStore"
import { DesktopLayout } from "@/components/layout/DesktopLayout"
import { TimelineItem } from "@/components/features/TimelineItem"
import { demoItinerary } from "@/lib/demo-data"

export default function PlanPage() {
  const { pendingAchievement, currentTrip, generatedItinerary } = useAppStore()
  const itinerary = generatedItinerary ?? demoItinerary
  const today = itinerary[0]

  return (
    <>
      {/* ── Mobile Layout ── */}
      <div className="lg:hidden relative flex flex-col h-full overflow-hidden">
        {/* Map background */}
        <div className="absolute inset-0">
          <MapView />
        </div>

        {/* Top bar */}
        <TopAppBar />

        {/* Assistant pill – above card */}
        <div className="absolute bottom-[62vh] left-4 right-4 z-10">
          <AssistantPill />
        </div>

        {/* Bottom sheet: TripCard */}
        <div className="absolute bottom-20 left-0 right-0 z-10" style={{ height: "60vh", overflowY: "auto" }}>
          <TripCard />
        </div>

        {/* Bottom nav */}
        <BottomNav />
      </div>

      {/* ── Desktop Layout ── */}
      <DesktopLayout
        leftPanel={
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/5">
              <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-1">
                {currentTrip?.destination}, {currentTrip?.country}
              </p>
              <h1 className="text-[20px] font-bold text-white">{currentTrip?.name}</h1>
            </div>

            {/* Trip stats bento */}
            <div className="px-6 py-4 border-b border-white/5">
              <div className="grid grid-cols-3 gap-3">
                {/* Budget donut */}
                <div
                  className="col-span-1 p-3 rounded-2xl flex flex-col items-center gap-2"
                  style={{ background: "rgba(42,42,44,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <svg width="60" height="60" viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                    <circle
                      cx="30" cy="30" r="22"
                      fill="none"
                      stroke="#30D158"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 22}`}
                      strokeDashoffset={`${2 * Math.PI * 22 * (1 - (currentTrip?.spent ?? 0) / (currentTrip?.budget ?? 1))}`}
                      transform="rotate(-90 30 30)"
                    />
                    <text x="30" y="34" textAnchor="middle" fill="#e4e2e4" fontSize="10" fontWeight="700">
                      {Math.round(((currentTrip?.spent ?? 0) / (currentTrip?.budget ?? 1)) * 100)}%
                    </text>
                  </svg>
                  <p className="text-[10px] text-[#c0c6d6] text-center">Presupuesto</p>
                </div>
                {/* Progress bar + weather */}
                <div className="col-span-2 flex flex-col gap-2">
                  <div
                    className="p-3 rounded-2xl flex-1"
                    style={{ background: "rgba(42,42,44,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <p className="text-[10px] text-[#c0c6d6] uppercase tracking-widest mb-2">Progreso</p>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div className="h-full w-[30%] rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5856D6]" />
                    </div>
                    <p className="text-[11px] text-[#c0c6d6] mt-1">Día 1 de {itinerary.length}</p>
                  </div>
                  <div
                    className="p-3 rounded-2xl"
                    style={{ background: "rgba(42,42,44,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#0A84FF]"
                        style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                        partly_cloudy_day
                      </span>
                      <span className="text-[13px] font-semibold text-white">18°C</span>
                      <span className="text-[11px] text-[#c0c6d6]">Parcialmente nublado</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-4">
                Itinerario del Día
              </p>
              {today?.activities.map((activity, i) => (
                <TimelineItem
                  key={activity.id}
                  activity={activity}
                  isFirst={i === 0}
                  isLast={i === (today.activities.length - 1)}
                  isCurrent={i === 1}
                />
              ))}
            </div>

            {/* Chat input bar */}
            <div className="px-6 pb-6 pt-2 border-t border-white/5">
              <AssistantPill />
            </div>
          </div>
        }
        rightPanel={<MapView />}
      />

      {/* Achievement overlay */}
      {pendingAchievement && <AchievementOverlay achievement={pendingAchievement} />}
    </>
  )
}
