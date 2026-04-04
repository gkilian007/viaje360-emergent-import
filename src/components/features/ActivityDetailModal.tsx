"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { TimelineActivity, DayItinerary, Trip, ChatMessage } from "@/lib/types"
import { ACTIVITY_ICONS } from "@/lib/constants"
import { useActivityEvent } from "@/lib/hooks/useActivityEvent"
import { useActivityAssets } from "@/lib/hooks/useActivityAssets"
import { useAppStore } from "@/store/useAppStore"
import { AffiliateLinks } from "@/components/features/AffiliateLinks"
import { ViatorTours } from "@/components/features/ViatorTours"

interface ActivityDetailModalProps {
  activity: TimelineActivity | null
  tripId?: string | null
  currentDayNumber?: number
  onClose: () => void
}

function ActivityImage({ imageUrl, loading, name, type }: { imageUrl?: string | null; loading?: boolean; name: string; type?: string }) {
  const [imgError, setImgError] = useState(false)

  const gradientsByType: Record<string, string> = {
    restaurant: "from-orange-600 to-red-600",
    museum: "from-purple-600 to-indigo-600",
    monument: "from-amber-600 to-yellow-600",
    park: "from-green-600 to-emerald-600",
    shopping: "from-pink-600 to-rose-600",
    tour: "from-blue-600 to-cyan-600",
    hotel: "from-slate-600 to-zinc-600",
    transport: "from-sky-600 to-blue-600",
  }

  const emojiByType: Record<string, string> = {
    restaurant: "🍴",
    museum: "🏛️",
    monument: "🏰",
    park: "🌳",
    shopping: "🛍️",
    tour: "🚶",
    hotel: "🏨",
    transport: "🚇",
  }

  const gradient = gradientsByType[type ?? "tour"] ?? "from-blue-600 to-cyan-600"
  const emoji = emojiByType[type ?? "tour"] ?? "📍"

  if (imageUrl && !imgError) {
    return (
      <div className="relative w-full h-48 overflow-hidden">
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <span className="text-white text-[15px] font-bold drop-shadow-lg line-clamp-1">{name}</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`w-full h-48 bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 animate-pulse`}>
        <span className="text-5xl opacity-60">{emoji}</span>
        <span className="text-white/50 text-[12px]">Buscando imagen...</span>
      </div>
    )
  }

  return (
    <div className={`w-full h-48 bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 relative overflow-hidden`}>
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.2'%3E%3Cpath d='M0 20L20 0L40 20L20 40Z'/%3E%3C/g%3E%3C/svg%3E\")" }}
      />
      <span className="text-6xl z-10">{emoji}</span>
      <span className="text-white/80 text-[15px] font-bold text-center px-6 line-clamp-2 z-10">{name}</span>
    </div>
  )
}

export function ActivityDetailModal({ activity, tripId, currentDayNumber, onClose }: ActivityDetailModalProps) {
  const track = useActivityEvent(tripId ?? null)
  const trackedRef = useRef<string | null>(null)
  const { currentTrip, setCurrentTrip, setGeneratedItinerary, replaceChatMessages, updateActivity } = useAppStore()
  const { data: assets, loading: assetsLoading } = useActivityAssets({
    name: activity?.name ?? "",
    location: activity?.location ?? "",
    destination: currentTrip?.destination ?? "",
    type: activity?.type ?? "tour",
    imageQuery: activity?.imageQuery,
    url: activity?.url,
  })
  const [feedbackState, setFeedbackState] = useState<null | "liked" | "disliked" | "more_like_this" | "less_like_this">(null)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [isTogglingLock, setIsTogglingLock] = useState(false)
  const [isTogglingBooked, setIsTogglingBooked] = useState(false)
  const [adaptationMessage, setAdaptationMessage] = useState<string | null>(null)

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  // Track detail_opened once per activity open
  useEffect(() => {
    if (activity && activity.id !== trackedRef.current) {
      trackedRef.current = activity.id
      track("detail_opened", activity.id, { name: activity.name, type: activity.type })
    }
    if (!activity) {
      trackedRef.current = null
    }
  }, [activity, track])

  useEffect(() => {
    setFeedbackState(null)
    setIsSubmittingFeedback(false)
    setIsTogglingLock(false)
    setIsTogglingBooked(false)
    setAdaptationMessage(null)
  }, [activity?.id])

  async function refreshActiveTripState() {
    const res = await fetch("/api/trips/active", { cache: "no-store" })
    if (!res.ok) return

    const payload = (await res.json()) as {
      ok: true
      data: {
        trip: Trip | null
        days: DayItinerary[]
        chatMessages: ChatMessage[]
      }
    }

    if (payload.data.trip) {
      setCurrentTrip(payload.data.trip)
      setGeneratedItinerary(payload.data.days)
      replaceChatMessages(payload.data.chatMessages)
    }
  }

  async function toggleLock() {
    if (!activity || isTogglingLock) return

    setIsTogglingLock(true)
    const nextLocked = !activity.isLocked

    try {
      if (tripId) {
        const res = await fetch("/api/activity-lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId,
            activityId: activity.id,
            locked: nextLocked,
          }),
        })

        if (res.ok) {
          await refreshActiveTripState()
        } else {
          updateActivity(activity.id, { isLocked: nextLocked })
        }
      } else {
        updateActivity(activity.id, { isLocked: nextLocked })
      }

      setAdaptationMessage(nextLocked ? "Actividad fijada. No se tocará en próximas adaptaciones." : "Actividad desbloqueada. Ya se podrá reajustar si hace falta.")
    } catch {
      updateActivity(activity.id, { isLocked: nextLocked })
      setAdaptationMessage(nextLocked ? "Actividad fijada (sin conexión)." : "Actividad desbloqueada.")
    } finally {
      setIsTogglingLock(false)
    }
  }

  async function toggleBooked() {
    if (!activity || isTogglingBooked) return

    setIsTogglingBooked(true)
    const nextBooked = !activity.booked

    try {
      if (tripId) {
        // Persist to server
        const res = await fetch("/api/activity-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId,
            activityId: activity.id,
            booked: nextBooked,
          }),
        })

        if (res.ok) {
          await refreshActiveTripState()
        } else {
          // Server failed — still update locally
          updateActivity(activity.id, { booked: nextBooked })
        }
      } else {
        // No tripId (guest user) — update locally only
        updateActivity(activity.id, { booked: nextBooked })
      }

      setAdaptationMessage(nextBooked ? "Actividad marcada como reservada." : "Reserva eliminada de esta actividad.")
    } catch {
      // Network error — update locally anyway
      updateActivity(activity.id, { booked: nextBooked })
      setAdaptationMessage(nextBooked ? "Marcada como reservada (sin conexión)." : "Reserva eliminada.")
    } finally {
      setIsTogglingBooked(false)
    }
  }

  async function submitFeedback(feedback: "liked" | "disliked" | "more_like_this" | "less_like_this") {
    if (!activity || !tripId || isSubmittingFeedback) return

    // Allow toggling off or switching to a different feedback
    const isToggleOff = feedbackState === feedback
    setFeedbackState(isToggleOff ? null : feedback)
    if (isToggleOff) {
      setAdaptationMessage("Feedback eliminado.")
      return
    }

    setIsSubmittingFeedback(true)

    try {
      await fetch("/api/activity-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          activityId: activity.id,
          feedback,
        }),
      })

      track(feedback === "liked" || feedback === "more_like_this" ? "activity_liked" : "activity_disliked", activity.id, {
        feedback,
        source: "activity-detail-modal",
      })

      const shouldAdapt = feedback === "disliked" || feedback === "more_like_this" || feedback === "less_like_this"

      if (shouldAdapt) {
        setAdaptationMessage(
          currentDayNumber && currentDayNumber > 1
            ? `Ajustando el viaje desde el Día ${currentDayNumber} con tu feedback…`
            : "Ajustando el resto del viaje con tu feedback…"
        )

        const reasonByFeedback: Record<"liked" | "disliked" | "more_like_this" | "less_like_this", string> = {
          liked: `The traveler explicitly likes the recommendation \"${activity.name}\". Keep this preference in mind for future recommendations.`,
          disliked: `The traveler explicitly said the recommendation \"${activity.name}\" does not fit. Rework upcoming days to reduce similar activities and replace mismatched suggestions.`,
          more_like_this: `The traveler explicitly wants more activities like \"${activity.name}\". Rework upcoming days to increase similar recommendations.`,
          less_like_this: `The traveler explicitly wants fewer activities like \"${activity.name}\". Rework upcoming days to reduce similar recommendations.`,
        }

        const adaptRes = await fetch("/api/itinerary/adapt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId,
            reason: reasonByFeedback[feedback],
            source: "system",
            startFromDayNumber: currentDayNumber,
          }),
        })

        if (adaptRes.ok) {
          await refreshActiveTripState()
          setAdaptationMessage("Listo. He reajustado el resto del viaje con tu feedback.")
        } else {
          setAdaptationMessage("He guardado tu feedback, pero no pude reajustar el itinerario ahora mismo.")
        }
      } else {
        setAdaptationMessage("Perfecto. Tendré esto en cuenta para las siguientes recomendaciones.")
      }
    } catch {
      setAdaptationMessage("He intentado guardar tu feedback, pero hubo un problema temporal.")
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  const icon = activity?.icon ?? ACTIVITY_ICONS[activity?.type ?? "tour"] ?? "place"
  const isRestaurant = activity?.type === "restaurant"

  return (
    <AnimatePresence>
      {activity && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[55] lg:left-[72px] lg:w-[calc(35%-72px+480px)] lg:max-w-[480px] lg:right-auto lg:top-0"
            onClick={onClose}
          />

          {/* Modal — bottom sheet on mobile, centered card on desktop */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed z-[60] overflow-hidden flex flex-col bottom-0 left-0 right-0 max-h-[90dvh] rounded-t-3xl lg:top-0 lg:bottom-0 lg:left-[72px] lg:w-[min(480px,40vw)] lg:right-auto lg:max-h-none lg:rounded-none"
            style={{
              background: "rgba(28, 28, 30, 0.98)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
            }}
          >
            {/* Pull handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Image */}
            <ActivityImage imageUrl={assets?.imageUrl} loading={assetsLoading} name={activity.name} type={activity.type} />

            {/* Content */}
            <div className="px-5 py-5 overflow-y-auto overflow-x-hidden flex-1 min-h-0 break-words">
              {/* Type badge + time */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide"
                  style={{
                    background: isRestaurant ? "rgba(255,159,10,0.15)" : "rgba(10,132,255,0.15)",
                    color: isRestaurant ? "#FF9F0A" : "#0A84FF",
                  }}
                >
                  {activity.type}
                </span>
                <span className="text-[12px] text-[#c0c6d6] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                  {activity.time} · {activity.duration} min
                </span>
              </div>

              {/* Name */}
              <h2 className="text-[22px] font-bold text-white leading-tight mb-1">
                {activity.name}
              </h2>

              {/* Location */}
              <p className="text-[13px] text-[#c0c6d6] flex items-center gap-1 mb-2">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                {activity.location}
              </p>

              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {activity.booked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/25">
                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                    Reservado
                  </span>
                )}
                {activity.isLocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9F0A]/15 text-[#FF9F0A] border border-[#FF9F0A]/25">
                    <span className="material-symbols-outlined text-[12px]">lock</span>
                    Fijada
                  </span>
                )}
                {isRestaurant && activity.pricePerPerson ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9F0A]/10 text-[#FFD59A] border border-[#FF9F0A]/20">
                    ~€{activity.pricePerPerson}/pers
                  </span>
                ) : activity.cost > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0A84FF]/10 text-[#9FD0FF] border border-[#0A84FF]/20">
                    €{activity.cost} entrada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#30D158]/10 text-[#30D158] border border-[#30D158]/20">
                    Gratis
                  </span>
                )}
              </div>

              {activity.recommendationReason && (
                <div className="mb-4 p-3 rounded-2xl border border-[#0A84FF]/20 bg-[#0A84FF]/10">
                  <p className="text-[11px] uppercase tracking-widest text-[#8fc2ff] font-medium mb-1.5">
                    Por qué te lo recomendamos
                  </p>
                  <p className="text-[13px] text-[#d9ecff] leading-relaxed">
                    {activity.recommendationReason}
                  </p>
                </div>
              )}

              {/* Description */}
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-2">
                  Qué hacer
                </p>
                <p className="text-[14px] text-[#e4e2e4] leading-relaxed">
                  {activity.description || (isRestaurant
                    ? `Parada gastronómica en ${activity.location}. Úsala como referencia rápida para decidir si te encaja dentro del plan de ese día.`
                    : `${activity.name} es una parada recomendada en ${activity.location}. Revísala como punto clave dentro de tu itinerario.`)}
                </p>
              </div>

              {/* Notes */}
              <div className="mb-4 p-3 rounded-2xl border border-white/8 bg-white/[0.03]">
                <p className="text-[11px] uppercase tracking-widest text-[#0A84FF] font-medium mb-1.5">
                  Tip práctico
                </p>
                <p className="text-[13px] text-[#d7d9df] leading-relaxed">
                  {activity.notes || "Abre el mapa o la web asociada para confirmar horario, acceso y tiempos antes de ir."}
                </p>
              </div>

              {/* Viator real tours */}
              {currentTrip?.destination && (
                <div className="mb-4">
                  <ViatorTours
                    activityName={activity.name}
                    destination={currentTrip.destination}
                  />
                </div>
              )}

              {/* Affiliate booking links */}
              <div className="mb-4">
                <AffiliateLinks
                  activityName={activity.name}
                  activityType={activity.type ?? "cultural"}
                  destination={currentTrip?.destination ?? ""}
                  cost={activity.cost}
                />
              </div>

              <div className="mb-4">
                <button
                  type="button"
                  disabled={isTogglingLock}
                  onClick={toggleLock}
                  className="w-full px-3 py-3 rounded-2xl text-[12px] font-semibold text-left transition-all"
                  style={{
                    background: activity.isLocked ? "rgba(255,159,10,0.16)" : "rgba(255,255,255,0.04)",
                    border: activity.isLocked ? "1px solid rgba(255,159,10,0.35)" : "1px solid rgba(255,255,255,0.08)",
                    color: activity.isLocked ? "#ffd59a" : "#e4e2e4",
                  }}
                >
                  {activity.isLocked ? "Actividad fijada · no tocar en adaptaciones" : "Mantener esta actividad fija"}
                </button>
              </div>

              <div className="mb-4">
                <button
                  type="button"
                  disabled={isTogglingBooked}
                  onClick={toggleBooked}
                  className="w-full px-3 py-3 rounded-2xl text-[12px] font-semibold text-left transition-all"
                  style={{
                    background: activity.booked ? "rgba(48,209,88,0.16)" : "rgba(255,255,255,0.04)",
                    border: activity.booked ? "1px solid rgba(48,209,88,0.35)" : "1px solid rgba(255,255,255,0.08)",
                    color: activity.booked ? "#8ff0b0" : "#e4e2e4",
                  }}
                >
                  {activity.booked ? "Entradas/reserva confirmadas" : "Marcar como reservado"}
                </button>
              </div>

              {/* Explicit feedback */}
              <div className="mb-5">
                <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-2">
                  Ajustar recomendaciones
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSubmittingFeedback}
                    onClick={() => submitFeedback("liked")}
                    className="px-3 py-2.5 rounded-2xl text-[12px] font-semibold text-left transition-all"
                    style={{
                      background: feedbackState === "liked" ? "rgba(48,209,88,0.16)" : "rgba(255,255,255,0.04)",
                      border: feedbackState === "liked" ? "1px solid rgba(48,209,88,0.35)" : "1px solid rgba(255,255,255,0.08)",
                      color: feedbackState === "liked" ? "#8ff0b0" : "#e4e2e4",
                    }}
                  >
                    Sí me interesa
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingFeedback}
                    onClick={() => submitFeedback("disliked")}
                    className="px-3 py-2.5 rounded-2xl text-[12px] font-semibold text-left transition-all"
                    style={{
                      background: feedbackState === "disliked" ? "rgba(255,69,58,0.16)" : "rgba(255,255,255,0.04)",
                      border: feedbackState === "disliked" ? "1px solid rgba(255,69,58,0.35)" : "1px solid rgba(255,255,255,0.08)",
                      color: feedbackState === "disliked" ? "#ffb3ae" : "#e4e2e4",
                    }}
                  >
                    No me encaja
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingFeedback}
                    onClick={() => submitFeedback("more_like_this")}
                    className="px-3 py-2.5 rounded-2xl text-[12px] font-semibold text-left transition-all"
                    style={{
                      background: feedbackState === "more_like_this" ? "rgba(10,132,255,0.16)" : "rgba(255,255,255,0.04)",
                      border: feedbackState === "more_like_this" ? "1px solid rgba(10,132,255,0.35)" : "1px solid rgba(255,255,255,0.08)",
                      color: feedbackState === "more_like_this" ? "#9fd0ff" : "#e4e2e4",
                    }}
                  >
                    Más como esto
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingFeedback}
                    onClick={() => submitFeedback("less_like_this")}
                    className="px-3 py-2.5 rounded-2xl text-[12px] font-semibold text-left transition-all"
                    style={{
                      background: feedbackState === "less_like_this" ? "rgba(191,90,242,0.16)" : "rgba(255,255,255,0.04)",
                      border: feedbackState === "less_like_this" ? "1px solid rgba(191,90,242,0.35)" : "1px solid rgba(255,255,255,0.08)",
                      color: feedbackState === "less_like_this" ? "#ddb4ff" : "#e4e2e4",
                    }}
                  >
                    Menos como esto
                  </button>
                </div>
              </div>

              {adaptationMessage && (
                <div className="mb-4 p-3 rounded-2xl border border-white/8 bg-white/[0.04]">
                  <p className="text-[12px] text-[#d7d9df] leading-relaxed">
                    {adaptationMessage}
                  </p>
                </div>
              )}

              {/* Map link */}
              {activity.lat && activity.lng && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${activity.lat},${activity.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-5 flex items-center gap-3 p-3.5 rounded-2xl border border-white/8 bg-[#0A84FF]/5 hover:bg-[#0A84FF]/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#0A84FF]/15 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px] text-[#0A84FF]">map</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white font-medium">Ver ubicación en el mapa</p>
                    <p className="text-[11px] text-[#888] truncate">{activity.location}</p>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-[#0A84FF] shrink-0">open_in_new</span>
                </a>
              )}

            </div>

            {/* Sticky footer actions */}
            <div
              className="px-5 pt-3 pb-5 safe-area-bottom shrink-0"
              style={{
                background: "linear-gradient(to top, rgba(28,28,30,0.98) 75%, rgba(28,28,30,0.82) 100%)",
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex gap-3">
                {(() => {
                  const fallbackMaps = activity.lat && activity.lng
                    ? `https://www.google.com/maps/search/?api=1&query=${activity.lat},${activity.lng}`
                    : `https://www.google.com/maps/search/${encodeURIComponent(`${activity.name} ${activity.location}`)}`
                  const primaryUrl = assets?.primaryUrl ?? fallbackMaps
                  const mapsUrl = assets?.mapsUrl ?? fallbackMaps
                  const primaryKind = assets?.primaryKind ?? "maps"
                  const hasDirectUrl = primaryKind !== "maps"

                  return (
                    <>
                      <a
                        href={primaryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          const eventType = isRestaurant ? "menu_clicked" : "booking_clicked"
                          track(eventType, activity.id, { url: primaryUrl, kind: primaryKind })
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl font-semibold text-[14px] text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          background: isRestaurant
                            ? "linear-gradient(135deg, #FF9F0A, #FF6B00)"
                            : "linear-gradient(135deg, #0A84FF, #5856D6)",
                        }}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {primaryKind === "maps" ? "map" : isRestaurant ? "menu_book" : "confirmation_number"}
                        </span>
                        {primaryKind === "maps"
                          ? "Ver en Maps"
                          : isRestaurant
                          ? "Ver carta"
                          : "Comprar entrada"}
                      </a>

                      {hasDirectUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 hover:bg-white/10 transition-colors"
                          style={{
                            background: "rgba(42,42,44,0.8)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                          title="Ver en Google Maps"
                        >
                          <span className="material-symbols-outlined text-[20px] text-[#c0c6d6]">map</span>
                        </a>
                      )}
                    </>
                  )
                })()}
                <button
                  onClick={onClose}
                  className="px-4 py-3.5 rounded-2xl font-semibold text-[14px] text-[#c0c6d6] transition-all hover:bg-white/10"
                  style={{
                    background: "rgba(42,42,44,0.8)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
