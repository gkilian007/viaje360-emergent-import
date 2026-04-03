"use client"

import { useState, useEffect, useRef, Suspense, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "next/navigation"
import { BottomNav } from "@/components/layout/BottomNav"
import { TopAppBar } from "@/components/layout/TopAppBar"
import { AdaptInput } from "@/components/features/AdaptInput"
import { AchievementOverlay } from "@/components/features/AchievementOverlay"
import { useAppStore } from "@/store/useAppStore"
import { DesktopLayout } from "@/components/layout/DesktopLayout"
import { DynamicMapView } from "@/components/features/DynamicMapView"
import { TimelineItem } from "@/components/features/TimelineItem"
import { SortableTimeline } from "@/components/features/SortableTimeline"
import { ActivityDetailModal } from "@/components/features/ActivityDetailModal"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { DiaryPromptCard } from "@/components/features/diary"
import { PaywallModal } from "@/components/features/PaywallModal"
import { TrialBanner } from "@/components/features/TrialBanner"
import { useActivityEventTracker } from "@/lib/hooks/useActivityEventTracker"
import { useAnalytics } from "@/lib/analytics/useAnalytics"
import { useExistingDiary } from "@/lib/hooks/useExistingDiary"
import { useAccess } from "@/lib/hooks/useAccess"
import { useWalkingTimes } from "@/lib/hooks/useWalkingTimes"
import { useCurrentActivity } from "@/lib/hooks/useCurrentActivity"
import { WalkingChip } from "@/components/features/WalkingChip"
import { TransitChoiceCard } from "@/components/features/TransitChoiceCard"
import { shouldOfferTransitChoice, getTransitFare } from "@/lib/transit"
import { resolveMobilityProfile } from "@/lib/mobility"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { CurrentActivityBanner } from "@/components/features/CurrentActivityBanner"
import { WeatherBadge } from "@/components/features/WeatherBadge"
import { useWeather } from "@/lib/hooks/useWeather"
import { ProactiveAdaptationBanner } from "@/components/features/ProactiveAdaptationBanner"
import { AutoAdaptedBanner } from "@/components/features/AutoAdaptedBanner"
import { ProactiveInsightCard } from "@/components/features/ProactiveInsightCard"
import { BudgetTracker } from "@/components/features/BudgetTracker"
import { PackingList } from "@/components/features/PackingList"
import { LocalTipsCard } from "@/components/features/LocalTipsCard"
import { useProactiveAdaptation } from "@/lib/hooks/useProactiveAdaptation"
import { useProactiveInsights } from "@/lib/hooks/useProactiveInsights"
import { MagicMomentCard } from "@/components/features/MagicMomentCard"
import { useMagicMoment } from "@/lib/hooks/useMagicMoment"
import { NotificationBanner } from "@/components/features/NotificationBanner"
import Link from "next/link"
import type { TimelineActivity, Trip } from "@/lib/types"

function DaySelector({
  days,
  selectedDay,
  onSelect,
  tripStartDate,
}: {
  days: number
  selectedDay: number
  onSelect: (day: number) => void
  tripStartDate?: string | null
}) {
  const todayDayNumber = tripStartDate
    ? Math.floor((Date.now() - new Date(tripStartDate).getTime()) / 86400000) + 1
    : null

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 py-1">
      {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
        const isToday = todayDayNumber !== null && todayDayNumber === day
        return (
          <button
            key={day}
            onClick={() => onSelect(day)}
            className={`relative shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
              selectedDay === day
                ? "bg-[#0A84FF] text-white shadow-[0_0_12px_rgba(10,132,255,0.4)]"
                : "bg-[#2a2a2c] text-[#c0c6d6] hover:bg-[#3a3a3c]"
            }`}
          >
            Día {day}
            {isToday && (
              <span className="absolute -top-1 -right-1 text-[8px] bg-[#0A84FF] text-white px-1 rounded-full font-bold leading-tight">
                HOY
              </span>
            )}
          </button>
        )
      })}
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

function MiniMapStrip({ activities, destination }: { activities: TimelineActivity[], destination: string }) {
  const withCoords = activities.filter(a => a.lat && a.lng && !isNaN(a.lat!) && !isNaN(a.lng!))
  if (withCoords.length === 0) return null

  const centerLat = withCoords.reduce((s, a) => s + a.lat!, 0) / withCoords.length
  const centerLng = withCoords.reduce((s, a) => s + a.lng!, 0) / withCoords.length

  const zoom = withCoords.length <= 3 ? 15 : withCoords.length <= 6 ? 14 : 13

  const markers = withCoords.slice(0, 8)
    .map(a => `${a.lat},${a.lng},ol-marker`)
    .join('|')

  const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=800x160&maptype=mapnik&markers=${markers}`

  return (
    <Link href="/mapa" className="block mx-5 mb-3 rounded-2xl overflow-hidden relative" style={{ height: 140 }}>
      <img
        src={url}
        alt={`Mapa de ${destination}`}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30"/>
      <div className="absolute bottom-2 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] text-white font-medium"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
        <span className="material-symbols-outlined text-[14px]">open_in_full</span>
        Ver mapa completo
      </div>
    </Link>
  )
}

function PlanSkeleton() {
  return (
    <div className="min-h-screen bg-[#0f1117] lg:hidden">
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-5 h-[72px]"
        style={{ background: "rgba(19,19,21,0.92)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
        <div className="flex-1 h-4 rounded-full bg-white/10 animate-pulse max-w-[140px]" />
      </div>
      <div className="pt-[72px] pb-24 px-5 space-y-4">
        <div className="flex gap-3 pt-4">
          {[1,2,3].map(i => (
            <div key={i} className="shrink-0 w-28 h-16 rounded-2xl bg-white/[0.05] animate-pulse" />
          ))}
        </div>
        <div className="flex gap-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="w-16 h-9 rounded-xl bg-white/[0.05] animate-pulse" />
          ))}
        </div>
        <div className="h-16 rounded-2xl bg-white/[0.04] animate-pulse" />
        {[1,2,3,4].map(i => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center w-14 shrink-0">
              <div className="w-10 h-3 rounded-full bg-white/[0.07] animate-pulse mb-2" />
              <div className="w-7 h-7 rounded-full bg-white/[0.07] animate-pulse" />
              {i < 4 && <div className="w-px bg-white/[0.05] mt-1" style={{ minHeight: 72 }} />}
            </div>
            <div className="flex-1 h-[88px] rounded-xl bg-white/[0.04] animate-pulse mb-3"
              style={{ animationDelay: `${i * 80}ms` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PlanPageContent() {
  const { pendingAchievement, currentTrip, generatedItinerary, setGeneratedItinerary, setCurrentTrip, replaceChatMessages, updateActivity, reorderDayActivities } = useAppStore()
  const searchParams = useSearchParams()
  const itinerary = generatedItinerary ?? []
  const [selectedDay, setSelectedDay] = useState(1)
  const [hydrated, setHydrated] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [showDiarySaved, setShowDiarySaved] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [showTourBanner, setShowTourBanner] = useState(false)
  const [showShareToast, setShowShareToast] = useState(false)
  const [showGuestBanner, setShowGuestBanner] = useState(false)
  const { trackEvent } = useActivityEventTracker()
  const { track } = useAnalytics()
  const { hasExistingDiary } = useExistingDiary(currentTrip?.id ?? null, selectedDay)
  const access = useAccess(currentTrip?.destination, currentTrip?.startDate)
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

  const handleActivityEdit = useCallback(async (
    activityId: string,
    patch: { name: string; time: string; duration: number }
  ) => {
    const res = await fetch(`/api/activities/${activityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: patch.name, time: patch.time, duration: patch.duration }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message ?? "Error al guardar")
    }
    // Update local store so map markers and walking times refresh
    updateActivity(activityId, { name: patch.name, time: patch.time, duration: patch.duration })
  }, [updateActivity])

  useEffect(() => {
    setHydrated(true)
  }, [])

  // First-visit tour banner
  useEffect(() => {
    if (!hydrated) return
    const key = "viaje360_plan_toured_v1"
    if (!localStorage.getItem(key)) {
      setShowTourBanner(true)
      const timer = setTimeout(() => {
        setShowTourBanner(false)
        localStorage.setItem(key, "1")
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [hydrated])

  const dismissTourBanner = useCallback(() => {
    setShowTourBanner(false)
    localStorage.setItem("viaje360_plan_toured_v1", "1")
  }, [])

  const handleCalendarExport = useCallback(() => {
    if (!currentTrip?.id) return
    window.open(`/api/trips/${currentTrip.id}/calendar`, "_blank")
  }, [currentTrip?.id])

  const handleShare = useCallback(async () => {
    if (!currentTrip?.id) return
    const shareUrl = `${window.location.origin}/share/${currentTrip.id}`
    const shareText = `Mira mi itinerario de ${currentTrip.destination} en Viaje360!`
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url: shareUrl })
        track("trip_shared", { destination: currentTrip.destination, method: "native" })
        return
      } catch {}
    }
    navigator.clipboard.writeText(shareUrl).then(() => {
      track("trip_shared", { destination: currentTrip.destination, method: "clipboard" })
      setShareCopied(true)
      setShowShareToast(true)
      setTimeout(() => {
        setShareCopied(false)
        setShowShareToast(false)
      }, 2500)
    }).catch(() => {})
  }, [currentTrip?.id, currentTrip?.destination, track])

  // Always rehydrate from server to get rich activity fields and ensure trip is loaded
  useEffect(() => {
    async function rehydrate() {
      try {
        const res = await fetch("/api/trips/active", { cache: "no-store" })
        if (!res.ok) {
          // Unauthenticated or server error — show guest banner if store has data from onboarding
          if (useAppStore.getState().currentTrip) setShowGuestBanner(true)
          setServerLoaded(true)
          return
        }
        const payload = await res.json()
        if (payload?.data?.trip) {
          setCurrentTrip(payload.data.trip)
          setGeneratedItinerary(payload.data.days ?? null)
          if (payload.data.chatMessages) {
            replaceChatMessages(payload.data.chatMessages)
          }
          track("plan_viewed", {
            destination: payload.data.trip.destination,
            tripId: payload.data.trip.id,
          })
        } else if (useAppStore.getState().currentTrip) {
          // Server has no trip but we have one in localStorage → guest mode
          setShowGuestBanner(true)
        }

        // Backfill geocoding for legacy trips that have no lat/lng
        const days: Array<{ activities: Array<{ lat?: number; lng?: number }> }> = payload?.data?.days ?? []
        const missingCoords = days.some(d =>
          d.activities.some(a => !a.lat || !a.lng)
        )
        if (missingCoords && payload?.data?.trip) {
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
      } catch {} finally {
        setServerLoaded(true)
      }
    }
    if (hydrated) void rehydrate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  // Preload images for visible activities (background, rate-limited to 1/s)
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

  // Proactive adaptation: scan all trip days for issues
  const { topIssue, adapt: adaptIssue, dismiss: dismissIssue, isAdapting: isAdaptingIssue, autoAdaptedDays, clearAutoAdapted } =
    useProactiveAdaptation({
      itinerary,
      getWeatherForDate: getForDate,
      tripId: currentTrip?.id ?? "",
      onAdapted: (days) => setGeneratedItinerary(days),
    })

  // Proactive Companion insights (briefings, budget, tips)
  const isTripActive = !!(currentTrip?.startDate && currentTrip?.endDate &&
    new Date(currentTrip.startDate) <= new Date(Date.now() + 86400000) &&
    new Date(currentTrip.endDate) >= new Date())
  const {
    topInsight: proactiveInsight,
    dismiss: dismissInsight,
    handleAction: handleInsightAction,
    isAdapting: isAdaptingInsight,
  } = useProactiveInsights({
    tripId: currentTrip?.id ?? null,
    isActive: isTripActive,
  })

  // Magic Moment: nearby hidden gem detection while between activities
  // Only activates once the trip has started and user is physically in destination
  const { suggestion: magicSuggestion, dismiss: dismissMagic, accept: acceptMagic } =
    useMagicMoment({
      today,
      currentIndex: liveStatus.currentIndex,
      minutesToNext: liveStatus.minutesToNext,
      dayProgress: liveStatus.progress,
      destination: currentTrip?.destination ?? "",
      tripStartDate: currentTrip?.startDate ?? null,
    })

  // Show Magic Moment as popup when an activity completes (currentIndex advances)
  const [showMagicPopup, setShowMagicPopup] = useState(false)
  const prevActivityIndexRef = useRef<number>(-99)
  useEffect(() => {
    const prev = prevActivityIndexRef.current
    const curr = liveStatus.currentIndex
    // Activity just changed (advanced) and we have a magic suggestion → show popup
    if (prev !== -99 && curr !== prev && magicSuggestion) {
      setShowMagicPopup(true)
    }
    prevActivityIndexRef.current = curr
  }, [liveStatus.currentIndex, magicSuggestion])
  const totalDays = itinerary.length

  // Preload images for visible activities (background, rate-limited to 1/s)
  useEffect(() => {
    if (!today || !hydrated) return
    const activitiesWithoutImage = today.activities.filter((a) => !a.imageUrl)
    if (activitiesWithoutImage.length === 0) return
    let cancelled = false
    let index = 0
    const fetchNext = () => {
      if (cancelled || index >= activitiesWithoutImage.length) return
      const activity = activitiesWithoutImage[index++]
      fetch("/api/activity-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: activity.name,
          location: activity.location ?? "",
          destination: currentTrip?.destination ?? "",
          type: activity.type ?? "tour",
          imageQuery: activity.imageQuery ?? activity.name,
          url: activity.url ?? undefined,
        }),
      }).catch(() => {}).finally(() => {
        if (!cancelled) setTimeout(fetchNext, 1000)
      })
    }
    const timer = setTimeout(fetchNext, 2000)
    return () => { cancelled = true; clearTimeout(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today?.activities, hydrated])
  const onboardingData = useOnboardingStore((s) => s.data)
  const mobilityProfile = resolveMobilityProfile({
    companion: onboardingData.companion,
    kidsPets: onboardingData.kidsPets,
    mobility: onboardingData.mobility,
    transport: onboardingData.transport,
  })

  if (!hydrated || !serverLoaded) {
    return <PlanSkeleton />
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
        <TopAppBar onShare={currentTrip?.id ? handleShare : undefined} onCalendarExport={currentTrip?.id ? handleCalendarExport : undefined} />

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
            <DaySelector days={totalDays} selectedDay={selectedDay} onSelect={setSelectedDay} tripStartDate={currentTrip?.startDate} />
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

          {/* Mini map strip — mobile only */}
          {today && (
            <MiniMapStrip
              activities={today.activities}
              destination={currentTrip?.destination ?? ""}
            />
          )}

          {/* Guest save banner — shown when itinerary is only in localStorage */}
          <AnimatePresence>
            {showGuestBanner && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="mx-5 mb-3 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl"
                style={{
                  background: "rgba(88,86,214,0.14)",
                  border: "1px solid rgba(88,86,214,0.35)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <p className="text-[13px] text-[#c0c6d6] flex-1">
                  💾 ¿Quieres guardar este itinerario? Inicia sesión para no perderlo.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href="/login"
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                    style={{ background: "rgba(88,86,214,0.3)", color: "#c4b5fd" }}
                  >
                    Guardar
                  </a>
                  <button
                    onClick={() => setShowGuestBanner(false)}
                    className="text-[11px] text-[#666] hover:text-white transition-colors"
                    aria-label="Cerrar"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* First-visit tour banner */}
          <AnimatePresence>
            {showTourBanner && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="mx-5 mb-3 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl"
                style={{
                  background: "rgba(10,132,255,0.12)",
                  border: "1px solid rgba(10,132,255,0.35)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <p className="text-[13px] text-[#c0c6d6] flex-1">
                  💡 Pulsa cualquier actividad para ver más detalles, reservar y adaptar
                </p>
                <button
                  onClick={dismissTourBanner}
                  className="shrink-0 text-[11px] font-semibold text-[#0A84FF] hover:text-white transition-colors"
                >
                  Entendido
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Auto-adapted notification — shown after automatic weather adaptation */}
          <AutoAdaptedBanner days={autoAdaptedDays} onDismiss={clearAutoAdapted} />

          {/* Proactive adaptation banner — shows top trip issue (weather, heat, fatigue, ...) */}
          {topIssue && currentTrip?.id && (
            <ProactiveAdaptationBanner
              issue={topIssue}
              isAdapting={isAdaptingIssue}
              onAdapt={adaptIssue}
              onDismiss={dismissIssue}
            />
          )}

          {/* Proactive Companion insight — briefings, tips, budget */}
          {proactiveInsight && (
            <ProactiveInsightCard
              insight={proactiveInsight}
              isAdapting={isAdaptingInsight}
              onAction={(action) => handleInsightAction(action, proactiveInsight)}
              onDismiss={() => dismissInsight(proactiveInsight.id)}
            />
          )}

          {/* Budget tracker */}
          {currentTrip?.id && <BudgetTracker tripId={currentTrip.id} />}

          {/* Smart packing list */}
          {currentTrip?.id && <PackingList tripId={currentTrip.id} />}

          {/* Local tips */}
          {currentTrip?.destination && <LocalTipsCard destination={String(currentTrip.destination)} />}

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

          {/* Timeline — sortable via drag & drop */}
          <div className="px-5">
            <SortableTimeline
              activities={today?.activities ?? []}
              dayNumber={selectedDay}
              tripId={currentTrip?.id}
              isCurrent={(id) => id === liveStatus.current?.id}
              onClick={handleActivityClick}
              onEdit={currentTrip?.id ? handleActivityEdit : undefined}
              getSegment={(fromId, toId) => getSegment(fromId, toId)}
              shouldOfferTransit={(distanceMeters) =>
                shouldOfferTransitChoice(distanceMeters, mobilityProfile.key)
              }
              destination={currentTrip?.destination ?? ""}
              onReorder={reorderDayActivities}
            />
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

          {/* Notification banner */}
          <div className="px-5 pb-2">
            <NotificationBanner />
          </div>

          {/* Recap link — visible when trip has diary entries or is completed */}
          {currentTrip?.id && (
            <div className="px-5 pb-2">
              <a
                href={`/recap/${currentTrip.id}`}
                className="flex items-center gap-2 w-full py-3 px-4 rounded-2xl text-[12px] text-[#888] hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="material-symbols-outlined text-[16px] text-[#BF5AF2]">auto_stories</span>
                <span>Ver recap del viaje</span>
                <span className="material-symbols-outlined text-[14px] ml-auto">chevron_right</span>
              </a>
            </div>
          )}

          {/* Share plan button — prominent CTA */}
          {currentTrip?.id && (
            <div className="px-5 pb-2">
              <button
                onClick={handleShare}
                className="flex items-center gap-3 w-full py-3.5 px-4 rounded-2xl transition-all active:scale-95"
                style={{
                  background: shareCopied
                    ? "rgba(48,209,88,0.15)"
                    : "rgba(10,132,255,0.12)",
                  border: shareCopied
                    ? "1px solid rgba(48,209,88,0.35)"
                    : "1px solid rgba(10,132,255,0.35)",
                }}
              >
                <span className="material-symbols-outlined text-[18px] text-[#0A84FF]">
                  {shareCopied ? "check_circle" : "share"}
                </span>
                <span className="text-[13px] font-medium text-white flex-1 text-left">
                  {shareCopied ? "¡Enlace copiado!" : "Compartir plan"}
                </span>
                {!shareCopied && (
                  <span className="material-symbols-outlined text-[14px] text-[#0A84FF]">link</span>
                )}
              </button>
            </div>
          )}

          {/* Adapt input */}
          <div className="px-5 pt-4 pb-2">
            {access.canAdapt ? (
              <AdaptInput
                tripId={currentTrip?.id ?? ""}
                onAdapted={(days) => setGeneratedItinerary(days)}
                disabled={!currentTrip?.id}
                currentDayNumber={selectedDay}
                currentActivityName={liveStatus.current?.name}
                currentTime={liveStatus.current ? new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : undefined}
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
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-1 capitalize">
                      {currentTrip?.destination}{currentTrip?.country ? `, ${currentTrip.country}` : ""}
                    </p>
                    <h1 className="text-[20px] font-bold text-white">{currentTrip?.name}</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentTrip?.id && (
                      <button
                        onClick={handleCalendarExport}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors"
                        title="Exportar calendario"
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#c0c6d6]">calendar_month</span>
                      </button>
                    )}
                    {currentTrip?.id && (
                      <button
                        onClick={handleShare}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors"
                        title="Compartir"
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#c0c6d6]">{shareCopied ? "check" : "share"}</span>
                      </button>
                    )}
                  </div>
                </div>
                {/* Desktop stats row */}
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-[#30D158]">payments</span>
                    <span className="text-[12px] text-[#c0c6d6]">€{currentTrip?.budget}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-purple-400">calendar_month</span>
                    <span className="text-[12px] text-[#c0c6d6]">{totalDays} días</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-[#0A84FF]">pin_drop</span>
                    <span className="text-[12px] text-[#c0c6d6]">{currentTrip?.startDate?.slice(5)} → {currentTrip?.endDate?.slice(5)}</span>
                  </div>
                  {todayWeather && <WeatherBadge weather={todayWeather} compact />}
                </div>
              </div>

              {/* Day selector */}
              <div className="px-6 py-3 border-b border-white/5">
                <DaySelector days={totalDays} selectedDay={selectedDay} onSelect={setSelectedDay} tripStartDate={currentTrip?.startDate} />
              </div>

              {/* Alerts & banners */}
              <div className="px-6 pt-3">
                <AutoAdaptedBanner days={autoAdaptedDays} onDismiss={clearAutoAdapted} />
                {topIssue && currentTrip?.id && (
                  <ProactiveAdaptationBanner
                    issue={topIssue}
                    isAdapting={isAdaptingIssue}
                    onAdapt={adaptIssue}
                    onDismiss={dismissIssue}
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
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto px-6 py-2">
                <SortableTimeline
                  activities={today?.activities ?? []}
                  dayNumber={selectedDay}
                  tripId={currentTrip?.id}
                  isCurrent={(id) => id === liveStatus.current?.id}
                  onClick={handleActivityClick}
                  onEdit={currentTrip?.id ? handleActivityEdit : undefined}
                  getSegment={(fromId, toId) => getSegment(fromId, toId)}
                  shouldOfferTransit={(distanceMeters) =>
                    shouldOfferTransitChoice(distanceMeters, mobilityProfile.key)
                  }
                  destination={currentTrip?.destination ?? ""}
                  onReorder={reorderDayActivities}
                />
              </div>

              {/* Adapt input */}
              <div className="px-6 pb-5 pt-2 border-t border-white/5">
                {access.canAdapt ? (
                  <AdaptInput
                    tripId={currentTrip?.id ?? ""}
                    onAdapted={(days) => setGeneratedItinerary(days)}
                    disabled={!currentTrip?.id}
                    currentDayNumber={selectedDay}
                    currentActivityName={liveStatus.current?.name}
                    currentTime={liveStatus.current ? new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : undefined}
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
          companionPanel={
            <div className="flex flex-col h-full">
              {/* Companion header */}
              <div className="px-5 pt-5 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#0A84FF]">assistant</span>
                  <h2 className="text-[14px] font-semibold text-white">Companion</h2>
                </div>
              </div>

              {/* Scrollable companion content */}
              <div className="flex-1 overflow-y-auto">
                {/* Proactive insight */}
                {proactiveInsight && (
                  <div className="px-4 pt-4">
                    <ProactiveInsightCard
                      insight={proactiveInsight}
                      isAdapting={isAdaptingInsight}
                      onAction={(action) => handleInsightAction(action, proactiveInsight)}
                      onDismiss={() => dismissInsight(proactiveInsight.id)}
                    />
                  </div>
                )}

                {/* Budget tracker */}
                {currentTrip?.id && (
                  <div className="px-4 pt-4">
                    <BudgetTracker tripId={currentTrip.id} />
                  </div>
                )}

                {/* Packing list */}
                {currentTrip?.id && (
                  <div className="px-4 pt-4">
                    <PackingList tripId={currentTrip.id} />
                  </div>
                )}

                {/* Local tips */}
                {currentTrip?.destination && (
                  <div className="px-4 pt-4">
                    <LocalTipsCard destination={String(currentTrip.destination)} />
                  </div>
                )}

                {/* Trial banner */}
                {!access.loading && (
                  <div className="px-4 pt-4">
                    <TrialBanner
                      destination={currentTrip?.destination ?? ""}
                      daysRemaining={access.daysRemaining}
                      reason={access.reason}
                    />
                  </div>
                )}

                {/* Diary prompt */}
                {today && access.canDiary && (
                  <div className="px-4 pt-4">
                    <DiaryPromptCard dayNumber={selectedDay} hasExistingDiary={hasExistingDiary} />
                  </div>
                )}

                {/* Notification banner */}
                <div className="px-4 pt-4">
                  <NotificationBanner />
                </div>

                {/* Quick actions */}
                <div className="px-4 pt-4 pb-5 space-y-2">
                  {/* Recap link */}
                  {currentTrip?.id && (
                    <a
                      href={`/recap/${currentTrip.id}`}
                      className="flex items-center gap-2 w-full py-3 px-4 rounded-2xl text-[12px] text-[#888] hover:text-white transition-colors"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#BF5AF2]">auto_stories</span>
                      <span>Ver recap del viaje</span>
                      <span className="material-symbols-outlined text-[14px] ml-auto">chevron_right</span>
                    </a>
                  )}

                  {/* Share button */}
                  {currentTrip?.id && (
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-2 w-full py-3 px-4 rounded-2xl text-[12px] transition-all hover:bg-white/5"
                      style={{
                        background: shareCopied ? "rgba(48,209,88,0.1)" : "rgba(255,255,255,0.03)",
                        border: shareCopied ? "1px solid rgba(48,209,88,0.3)" : "1px solid rgba(255,255,255,0.06)",
                        color: shareCopied ? "#30D158" : "#888",
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#0A84FF]">
                        {shareCopied ? "check_circle" : "share"}
                      </span>
                      <span>{shareCopied ? "¡Enlace copiado!" : "Compartir plan"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
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

      {/* Magic Moment popup — appears as bottom sheet when an activity completes */}
      {showMagicPopup && magicSuggestion && (
        <MagicMomentCard
          suggestion={magicSuggestion}
          asPopup
          onAccept={() => { acceptMagic(); setShowMagicPopup(false) }}
          onDismiss={() => { dismissMagic(); setShowMagicPopup(false) }}
        />
      )}

      {/* Share toast */}
      <AnimatePresence>
        {showShareToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-28 left-4 right-4 lg:left-auto lg:right-8 lg:w-80 p-4 rounded-2xl z-50"
            style={{
              background: "rgba(10,132,255,0.15)",
              border: "1px solid rgba(10,132,255,0.35)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(10,132,255,0.2)" }}
              >
                <span className="material-symbols-outlined text-[20px] text-[#0A84FF]">link</span>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white">¡Enlace copiado!</p>
                <p className="text-[11px] text-[#c0c6d6]">Comparte tu plan con quien quieras</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
    <Suspense fallback={<PlanSkeleton />}>
      <PlanPageContent />
    </Suspense>
  )
}
