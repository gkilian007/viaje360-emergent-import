"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { BottomNav } from "@/components/layout/BottomNav"
import { TopAppBar } from "@/components/layout/TopAppBar"
import { AdaptInput } from "@/components/features/AdaptInput"
import { AchievementOverlay } from "@/components/features/AchievementOverlay"
import { useAppStore } from "@/store/useAppStore"
import { DesktopLayout } from "@/components/layout/DesktopLayout"
import { DynamicMapView } from "@/components/features/DynamicMapView"
import { TimelineItem } from "@/components/features/TimelineItem"
import { ActivityDetailModal } from "@/components/features/ActivityDetailModal"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { DiaryPromptCard } from "@/components/features/diary"
import { PaywallModal } from "@/components/features/PaywallModal"
import { TrialBanner } from "@/components/features/TrialBanner"
import { useActivityEventTracker } from "@/lib/hooks/useActivityEventTracker"
import { useExistingDiary } from "@/lib/hooks/useExistingDiary"
import { useAccess } from "@/lib/hooks/useAccess"
import { useWalkingTimes } from "@/lib/hooks/useWalkingTimes"
import { useCurrentActivity } from "@/lib/hooks/useCurrentActivity"
import { WalkingChip } from "@/components/features/WalkingChip"
import { CurrentActivityBanner } from "@/components/features/CurrentActivityBanner"
import { WeatherBadge } from "@/components/features/WeatherBadge"
import { WeatherAlert } from "@/components/features/WeatherAlert"
import { useWeather } from "@/lib/hooks/useWeather"
import type { TimelineActivity, Trip } from "@/lib/types"

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

function MobileStats({ trip, totalDays }: { trip: Trip; totalDays: number }) {
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
          <p className="text-[10px] text-[#c0c6d6] capitalize">{trip.destination}</p>
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

function PlanPageContent() {
  const { pendingAchievement, currentTrip, generatedItinerary, setGeneratedItinerary, setCurrentTrip, replaceChatMessages } = useAppStore()
  const searchParams = useSearchParams()
  const itinerary = generatedItinerary ?? []
  const [selectedDay, setSelectedDay] = useState(1)
  const [hydrated, setHydrated] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [showDiarySaved, setShowDiarySaved] = useState(false)
  const { trackEvent } = useActivityEventTracker()
  const { hasExistingDiary } = useExistingDiary(currentTrip?.id ?? null, selectedDay)
  const access = useAccess(currentTrip?.destination)
  const [showPaywall, setShowPaywall] = useState(false)
  const [serverLoaded, setServerLoaded] = useState(false)

  // Derive selectedActivity from itinerary so it stays in sync after refreshActiveTripState()
  const selectedActivity = selectedActivityId
    ? itinerary.flatMap(d => d.activities).find(a => a.id === selectedActivityId) ?? null
    : null

  const handleActivityClick = (activity: TimelineActivity) => {
    setSelectedActivityId(activity.id)
    trackEvent(activity.id, "detail_opened", { source: "timeline-card", dayNumber: selectedDay })
  }

  useEffect(() => {
    setHydrated(true)
  }, [])

  // Always rehydrate from server to get rich activity fields and ensure trip is loaded
  useEffect(() => {
    async function rehydrate() {
      try {
        const res = await fetch("/api/trips/active", { cache: "no-store" })
        if (!res.ok) { setServerLoaded(true); return }
        const payload = await res.json()
        if (payload?.data?.trip) {
          setCurrentTrip(payload.data.trip)
          setGeneratedItinerary(payload.data.days ?? null)
          if (payload.data.chatMessages) {
            replaceChatMessages(payload.data.chatMessages)
          }

          // Backfill geocoding for legacy trips that have no lat/lng
          const days: Array<{ activities: Array<{ lat?: number; lng?: number }> }> = payload.data.days ?? []
          const missingCoords = days.some(d =>
            d.activities.some(a => !a.lat || !a.lng)
          )
          if (missingCoords) {
            // Backfill geocoding in background — call multiple times until all done
            async function runBackfill() {
              let remaining = Infinity
              let totalUpdated = 0
              while (remaining > 0) {
                try {
                  const r = await fetch("/api/trips/backfill-geocode", { method: "POST" })
                  const result = await r.json()
                  totalUpdated += result?.data?.updated ?? 0
                  remaining = result?.data?.remaining ?? 0
                } catch {
                  break
                }
              }
              if (totalUpdated > 0) {
                // Reload with fresh coords
                try {
                  const freshRes = await fetch("/api/trips/active", { cache: "no-store" })
                  const freshPayload = await freshRes.json()
                  if (freshPayload?.data?.days) {
                    setGeneratedItinerary(freshPayload.data.days)
                  }
                } catch {}
              }
            }
            void runBackfill()
          }
        }
      } catch {} finally {
        setServerLoaded(true)
      }
    }
    if (hydrated) void rehydrate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  // Check if diary was just saved
  useEffect(() => {
    const diarySaved = searchParams.get("diary")
    const savedDay = searchParams.get("day")
    if (diarySaved === "saved" && savedDay) {
      setShowDiarySaved(true)
      setSelectedDay(parseInt(savedDay, 10))
      // Clear the toast after 3 seconds
      setTimeout(() => setShowDiarySaved(false), 3000)
    }
  }, [searchParams])

  // ALL hooks must be before any conditional return
  const today = itinerary[selectedDay - 1]
  const { getSegment } = useWalkingTimes(today?.activities ?? [])
  const liveStatus = useCurrentActivity(today?.activities ?? [], currentTrip?.startDate)
  const firstWithCoords = itinerary.flatMap(d => d.activities).find(a => a.lat && a.lng)
  const { getForDate } = useWeather(firstWithCoords?.lat, firstWithCoords?.lng)
  const todayWeather = today ? getForDate(today.date) : undefined
  const totalDays = itinerary.length

  if (!hydrated || !serverLoaded) {
    return (
      <div className="min-h-screen map-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0A84FF] border-t-transparent rounded-full animate-spin" />
          <div className="text-[#c0c6d6] text-sm">Cargando itinerario...</div>
        </div>
      </div>
    )
  }

  if (!currentTrip || totalDays === 0) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center px-6 text-center">
        <span className="material-symbols-outlined text-[56px] text-[#0A84FF] mb-4">travel_explore</span>
        <h1 className="text-[22px] font-bold text-white mb-2">Aún no hay itinerario</h1>
        <p className="text-[#c0c6d6] max-w-sm mb-6">
          Genera un viaje desde el onboarding y aquí verás tu plan detallado día a día.
        </p>
        <a
          href="/onboarding"
          className="px-5 py-3 rounded-2xl font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
        >
          Crear itinerario
        </a>
      </div>
    )
  }

  return (
    <>
      {/* ── Mobile Layout ── */}
      <div className="lg:hidden flex flex-col h-screen bg-[#0f1117]">
        {/* Top bar */}
        <TopAppBar />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pt-[72px] pb-24">

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
                  {todayWeather && <WeatherBadge weather={todayWeather} compact />}
                </div>
                <p className="text-[14px] font-semibold text-white">
                  {today.activities.length} actividades planificadas
                </p>
              </div>
            </div>
          )}

          {/* Weather alert */}
          {todayWeather && currentTrip?.id && (
            <WeatherAlert
              weather={todayWeather}
              dayNumber={selectedDay}
              tripId={currentTrip.id}
              onAdapted={(days) => setGeneratedItinerary(days as typeof itinerary)}
            />
          )}

          {/* Live activity banner */}
          <CurrentActivityBanner
            current={liveStatus.current}
            next={liveStatus.next}
            minutesRemaining={liveStatus.minutesRemaining}
            minutesToNext={liveStatus.minutesToNext}
            progress={liveStatus.progress}
            isDayOver={liveStatus.isDayOver}
            isDayNotStarted={liveStatus.isDayNotStarted}
          />

          {/* Timeline */}
          <div className="px-5">
            {today?.activities.map((activity, i) => {
              const next = today.activities[i + 1]
              const seg = next ? getSegment(activity.id, next.id) : undefined
              return (
                <div key={activity.id}>
                  <TimelineItem
                    activity={activity}
                    isFirst={i === 0}
                    isLast={i === today.activities.length - 1}
                    isCurrent={activity.id === liveStatus.current?.id}
                    onClick={handleActivityClick}
                  />
                  {seg && (
                    <WalkingChip
                      walkingMinutes={seg.walkingMinutes}
                      distanceMeters={seg.distanceMeters}
                      mapsUrl={seg.mapsUrl}
                    />
                  )}
                </div>
              )
            })}
            {(!today || today.activities.length === 0) && (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-[48px] text-[#c0c6d6]/30">beach_access</span>
                <p className="text-[#c0c6d6] mt-2">Día libre — ¡disfruta!</p>
              </div>
            )}
          </div>

          {/* Trial banner */}
          {!access.loading && (
            <TrialBanner
              destination={currentTrip?.destination ?? ""}
              daysRemaining={access.daysRemaining}
              reason={access.reason}
            />
          )}

          {/* Diary Prompt */}
          {today && access.canDiary && (
            <DiaryPromptCard dayNumber={selectedDay} hasExistingDiary={hasExistingDiary} />
          )}

          {/* Adapt input */}
          <div className="px-5 pt-4 pb-2">
            {access.canAdapt ? (
              <AdaptInput
                tripId={currentTrip?.id ?? ""}
                onAdapted={(days) => setGeneratedItinerary(days)}
                disabled={!currentTrip?.id}
              />
            ) : (
              <button
                onClick={() => setShowPaywall(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-full"
                style={{
                  background: "rgba(19, 19, 21, 0.9)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span className="text-[20px]">🔒</span>
                <span className="text-[13px] text-[#666]">
                  Desbloquea para adaptar tu itinerario con IA
                </span>
              </button>
            )}
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
                <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-1 capitalize">
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
                  {todayWeather && <WeatherBadge weather={todayWeather} compact />}
                </p>
                {todayWeather && currentTrip?.id && (
                  <WeatherAlert
                    weather={todayWeather}
                    dayNumber={selectedDay}
                    tripId={currentTrip.id}
                    onAdapted={(days) => setGeneratedItinerary(days as typeof itinerary)}
                  />
                )}
                <CurrentActivityBanner
                  current={liveStatus.current}
                  next={liveStatus.next}
                  minutesRemaining={liveStatus.minutesRemaining}
                  minutesToNext={liveStatus.minutesToNext}
                  progress={liveStatus.progress}
                  isDayOver={liveStatus.isDayOver}
                  isDayNotStarted={liveStatus.isDayNotStarted}
                />
                {today?.activities.map((activity, i) => {
                  const next = today.activities[i + 1]
                  const seg = next ? getSegment(activity.id, next.id) : undefined
                  return (
                    <div key={activity.id}>
                      <TimelineItem
                        activity={activity}
                        isFirst={i === 0}
                        isLast={i === today.activities.length - 1}
                        isCurrent={activity.id === liveStatus.current?.id}
                        onClick={handleActivityClick}
                      />
                      {seg && (
                        <WalkingChip
                          walkingMinutes={seg.walkingMinutes}
                          distanceMeters={seg.distanceMeters}
                          mapsUrl={seg.mapsUrl}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Adapt input */}
              <div className="px-6 pb-6 pt-2 border-t border-white/5">
                {access.canAdapt ? (
                  <AdaptInput
                    tripId={currentTrip?.id ?? ""}
                    onAdapted={(days) => setGeneratedItinerary(days)}
                    disabled={!currentTrip?.id}
                  />
                ) : (
                  <button
                    onClick={() => setShowPaywall(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-full"
                    style={{
                      background: "rgba(19, 19, 21, 0.9)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <span className="text-[20px]">🔒</span>
                    <span className="text-[13px] text-[#666]">
                      Desbloquea para adaptar tu itinerario
                    </span>
                  </button>
                )}
              </div>
            </div>
          }
          rightPanel={
            <DynamicMapView
              activities={today?.activities ?? []}
              destination={currentTrip?.destination ?? ""}
              selectedActivityId={selectedActivity?.id}
              onMarkerClick={(activityId) => {
                const activity = today?.activities.find((a) => a.id === activityId)
                if (activity) handleActivityClick(activity)
              }}
            />
          }
        />
      </div>

      {/* Activity detail modal */}
      <ErrorBoundary fallback={null}>
        <ActivityDetailModal
          activity={selectedActivity}
          tripId={currentTrip?.id ?? null}
          currentDayNumber={selectedDay}
          onClose={() => setSelectedActivityId(null)}
        />
      </ErrorBoundary>

      {/* Achievement overlay */}
      {pendingAchievement && <AchievementOverlay achievement={pendingAchievement} />}

      {/* Diary saved toast */}
      {showDiarySaved && (
        <div
          className="fixed bottom-24 left-4 right-4 lg:left-auto lg:right-8 lg:w-80 p-4 rounded-2xl z-50 animate-fadeInUp"
          style={{
            background: "rgba(48,209,88,0.15)",
            border: "1px solid rgba(48,209,88,0.3)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(48,209,88,0.2)" }}
            >
              <span className="material-symbols-outlined text-[20px] text-[#30D158]">check_circle</span>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white">¡Diario guardado!</p>
              <p className="text-[11px] text-[#c0c6d6]">Tus impresiones del Día {selectedDay} se han guardado</p>
            </div>
          </div>
        </div>
      )}

      {/* Paywall modal */}
      {showPaywall && currentTrip && (
        <PaywallModal
          destination={currentTrip.destination}
          onClose={() => setShowPaywall(false)}
          onPaymentComplete={() => {
            setShowPaywall(false)
            access.refresh()
          }}
        />
      )}
    </>
  )
}

export default function PlanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen map-bg flex items-center justify-center">
        <div className="text-[#c0c6d6] text-sm">Cargando itinerario...</div>
      </div>
    }>
      <PlanPageContent />
    </Suspense>
  )
}
