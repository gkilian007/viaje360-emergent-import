"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { useAppStore } from "@/store/useAppStore"
import { BottomNav } from "@/components/layout/BottomNav"
import { DynamicMapView } from "@/components/features/DynamicMapView"
import { ActivityDetailModal } from "@/components/features/ActivityDetailModal"
import type { TimelineActivity } from "@/lib/types"

// Day selector
function DaySelector({
  days,
  selectedDay,
  onSelect,
}: {
  days: number
  selectedDay: number
  onSelect: (d: number) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
        <motion.button
          key={day}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(day)}
          className={`shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold ${
            selectedDay === day ? "text-white" : "text-[#c0c6d6]"
          }`}
          style={{
            background:
              selectedDay === day
                ? "linear-gradient(135deg, #0A84FF, #5856D6)"
                : "rgba(42,42,44,0.8)",
            boxShadow:
              selectedDay === day ? "0 4px 15px rgba(10,132,255,0.3)" : "none",
          }}
        >
          Día {day}
        </motion.button>
      ))}
    </div>
  )
}

// Activity list overlay
function ActivityList({
  activities,
  onSelect,
}: {
  activities: TimelineActivity[]
  onSelect: (a: TimelineActivity) => void
}) {
  return (
    <div
      className="absolute bottom-20 left-4 right-4 max-h-[40vh] overflow-y-auto rounded-2xl z-[1001]"
      style={{
        background: "rgba(19,19,21,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(20px)",
      }}
    >
      {activities.map((activity, i) => (
        <button
          key={activity.id}
          onClick={() => onSelect(activity)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
          style={{
            borderBottom:
              i < activities.length - 1
                ? "1px solid rgba(255,255,255,0.05)"
                : "none",
          }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
            style={{
              background:
                i === 0
                  ? "#30D158"
                  : i === activities.length - 1
                  ? "#FF453A"
                  : "#5856D6",
            }}
          >
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate">
              {activity.name}
            </p>
            <p className="text-[11px] text-[#888] truncate">
              {activity.time} · {activity.duration}min
              {activity.location ? ` · ${activity.location}` : ""}
            </p>
          </div>
          {activity.cost > 0 && (
            <span className="text-[11px] text-[#0A84FF] font-medium shrink-0">
              €{activity.cost}
            </span>
          )}
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

  useEffect(() => {
    setHydrated(true)
  }, [])

  const handleActivityClick = useCallback((activity: TimelineActivity) => {
    setSelectedActivity(activity)
    setShowList(false)
  }, [])

  const handleMarkerClick = useCallback(
    (activityId: string) => {
      const activity = today?.activities.find((a) => a.id === activityId)
      if (activity) setSelectedActivity(activity)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generatedItinerary, selectedDay]
  )

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0A84FF] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const itinerary = generatedItinerary ?? []
  const totalDays = itinerary.length
  const today = itinerary[selectedDay - 1]

  if (!currentTrip || totalDays === 0) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
            style={{
              background:
                "linear-gradient(135deg, rgba(10,132,255,0.2), rgba(88,86,214,0.2))",
            }}
          >
            <span className="material-symbols-outlined text-[40px] text-[#0A84FF]">
              map
            </span>
          </div>
          <h1 className="text-[24px] font-bold text-white mb-3">Sin itinerario</h1>
          <p className="text-[#c0c6d6] max-w-sm mb-8">
            Genera un viaje para ver tu ruta en el mapa.
          </p>
          <a
            href="/onboarding"
            className="px-6 py-3.5 rounded-2xl font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
          >
            Crear itinerario
          </a>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f1117]">
      {/* Full-screen map */}
      <div className="flex-1 relative">
        <DynamicMapView
          activities={today?.activities ?? []}
          destination={currentTrip.destination}
          selectedActivityId={selectedActivity?.id}
          onMarkerClick={handleMarkerClick}
        />

        {/* Header overlay */}
        <div
          className="absolute top-0 left-0 right-0 p-4 z-[1000] pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(15,17,23,0.98), rgba(15,17,23,0.7), transparent)",
          }}
        >
          <div className="flex items-center justify-between mb-4 pointer-events-auto">
            <div>
              <h1 className="text-[18px] font-bold text-white">
                {currentTrip.name}
              </h1>
              <p className="text-[12px] text-[#c0c6d6] capitalize">
                {currentTrip.destination}
                {currentTrip.country ? `, ${currentTrip.country}` : ""}
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowList(!showList)}
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{
                background: showList
                  ? "linear-gradient(135deg, #0A84FF, #5856D6)"
                  : "rgba(42,42,44,0.9)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <span className="material-symbols-outlined text-[22px] text-white">
                {showList ? "map" : "list"}
              </span>
            </motion.button>
          </div>
          <div className="pointer-events-auto">
            <DaySelector
              days={totalDays}
              selectedDay={selectedDay}
              onSelect={setSelectedDay}
            />
          </div>
        </div>

        {/* Activity list overlay */}
        {showList && today && (
          <ActivityList
            activities={today.activities}
            onSelect={handleActivityClick}
          />
        )}
      </div>

      <BottomNav />

      <ActivityDetailModal
        activity={selectedActivity}
        tripId={currentTrip?.id}
        currentDayNumber={selectedDay}
        onClose={() => setSelectedActivity(null)}
      />
    </div>
  )
}
