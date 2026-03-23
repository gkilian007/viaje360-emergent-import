"use client"

import { useState, useEffect } from "react"
import { useAppStore } from "@/store/useAppStore"
import { BottomNav } from "@/components/layout/BottomNav"
import { ItineraryMap } from "@/components/features/map"
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
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
        <button
          key={day}
          onClick={() => onSelect(day)}
          className={`shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
            selectedDay === day
              ? "bg-[#0A84FF] text-white shadow-[0_0_12px_rgba(10,132,255,0.4)]"
              : "bg-[#2a2a2c]/80 text-[#c0c6d6] hover:bg-[#3a3a3c]"
          }`}
          data-testid={`day-selector-${day}`}
        >
          Día {day}
        </button>
      ))}
    </div>
  )
}

function ActivityList({
  activities,
  onActivityClick,
}: {
  activities: TimelineActivity[]
  onActivityClick: (activity: TimelineActivity) => void
}) {
  return (
    <div className="space-y-2">
      {activities.map((activity, index) => (
        <button
          key={activity.id}
          onClick={() => onActivityClick(activity)}
          className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/5"
          style={{
            background: "rgba(42,42,44,0.5)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[13px]"
            style={{ background: "rgba(10,132,255,0.3)" }}
          >
            {index + 1}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[13px] font-medium text-white truncate">{activity.name}</p>
            <p className="text-[11px] text-[#c0c6d6]">{activity.time} · {activity.location}</p>
          </div>
          <span className="material-symbols-outlined text-[18px] text-[#c0c6d6]">
            chevron_right
          </span>
        </button>
      ))}
    </div>
  )
}

export default function MapaPage() {
  const { currentTrip, generatedItinerary } = useAppStore()
  const [selectedDay, setSelectedDay] = useState(1)
  const [selectedActivity, setSelectedActivity] = useState<TimelineActivity | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [showList, setShowList] = useState(false)

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

  useEffect(() => {
    setHydrated(true)
  }, [])

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-[#c0c6d6] text-sm">Cargando mapa...</div>
      </div>
    )
  }

  const itinerary = generatedItinerary ?? []
  const totalDays = itinerary.length
  const dayData = itinerary[selectedDay - 1]
  const activities = dayData?.activities ?? []

  if (!currentTrip || totalDays === 0) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center px-6 text-center">
        <span className="material-symbols-outlined text-[56px] text-[#0A84FF] mb-4">map</span>
        <h1 className="text-[22px] font-bold text-white mb-2">Sin itinerario</h1>
        <p className="text-[#c0c6d6] max-w-sm mb-6">
          Genera un viaje desde el onboarding para ver tu ruta en el mapa.
        </p>
        <a
          href="/onboarding"
          className="px-5 py-3 rounded-2xl font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
        >
          Crear itinerario
        </a>
        <BottomNav />
      </div>
    )
  }

  if (!mapboxToken) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center px-6 text-center">
        <span className="material-symbols-outlined text-[56px] text-[#FF453A] mb-4">error</span>
        <h1 className="text-[22px] font-bold text-white mb-2">Mapa no disponible</h1>
        <p className="text-[#c0c6d6] max-w-sm mb-6">
          Falta configurar el token de Mapbox para mostrar el mapa interactivo.
        </p>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f1117]">
      {/* Map takes full height */}
      <div className="flex-1 relative">
        <ItineraryMap
          itinerary={itinerary}
          selectedDay={selectedDay}
          onActivityClick={setSelectedActivity}
          accessToken={mapboxToken}
        />

        {/* Floating header */}
        <div
          className="absolute top-0 left-0 right-0 p-4 z-10"
          style={{
            background: "linear-gradient(to bottom, rgba(15,17,23,0.95), transparent)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-[18px] font-bold text-white">{currentTrip.name}</h1>
              <p className="text-[12px] text-[#c0c6d6]">
                {currentTrip.destination}, {currentTrip.country}
              </p>
            </div>
            <button
              onClick={() => setShowList(!showList)}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: showList ? "#0A84FF" : "rgba(42,42,44,0.8)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              data-testid="toggle-list-btn"
            >
              <span className="material-symbols-outlined text-[20px] text-white">
                {showList ? "map" : "list"}
              </span>
            </button>
          </div>

          {/* Day selector */}
          <DaySelector
            days={totalDays}
            selectedDay={selectedDay}
            onSelect={setSelectedDay}
          />
        </div>

        {/* Activity list panel (toggleable) */}
        {showList && (
          <div
            className="absolute bottom-20 left-4 right-4 max-h-[40vh] overflow-y-auto rounded-2xl p-4 z-10"
            style={{
              background: "rgba(19, 19, 21, 0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] uppercase tracking-widest text-[#c0c6d6] font-medium">
                Actividades del Día {selectedDay}
              </p>
              <span className="text-[11px] text-[#0A84FF] font-medium">
                {activities.length} lugares
              </span>
            </div>
            <ActivityList
              activities={activities}
              onActivityClick={setSelectedActivity}
            />
          </div>
        )}

        {/* Quick stats */}
        <div
          className="absolute bottom-20 right-4 p-3 rounded-xl z-10"
          style={{
            background: "rgba(19, 19, 21, 0.9)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#0A84FF]">
              pin_drop
            </span>
            <span className="text-[13px] font-semibold text-white">
              {activities.length}
            </span>
            <span className="text-[11px] text-[#c0c6d6]">paradas</span>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <BottomNav />

      {/* Activity detail modal */}
      <ActivityDetailModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
    </div>
  )
}
