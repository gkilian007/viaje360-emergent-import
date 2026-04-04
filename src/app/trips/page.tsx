"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import type { TripSummary } from "@/app/api/trips/route"
import { BottomNav } from "@/components/layout/BottomNav"
import { SideNav } from "@/components/layout/SideNav"
import { TopAppBar } from "@/components/layout/TopAppBar"
import { getDestinationHeroThumb } from "@/lib/services/destination-photos"

const ITEMS_PER_PAGE = 16 // 4x4

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
  return `${s.toLocaleDateString("es-ES", opts)} – ${e.toLocaleDateString("es-ES", opts)}`
}

function TripCard({
  trip,
  onActivate,
  activating,
  onShare,
}: {
  trip: TripSummary
  onActivate: (id: string) => void
  activating: string | null
  onShare: (trip: TripSummary) => void
}) {
  const router = useRouter()
  const isActive = trip.status === "active"
  const isCompleted = trip.status === "completed"
  const heroUrl = getDestinationHeroThumb(trip.destination, 600) ?? trip.imageUrl

  function handleClick() {
    if (isActive) {
      router.push("/plan")
    } else {
      router.push(`/recap/${trip.id}`)
    }
  }

  return (
    <div
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl"
      style={{
        background: "rgba(30,30,32,0.95)",
        border: isActive
          ? "1px solid rgba(10,132,255,0.35)"
          : isCompleted
          ? "1px solid rgba(120,200,140,0.15)"
          : "1px solid rgba(255,255,255,0.07)",
      }}
      onClick={handleClick}
    >
      {/* Hero image */}
      <div className="relative h-36 w-full overflow-hidden">
        {heroUrl ? (
          <Image
            src={heroUrl}
            alt={trip.destination}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
            <span className="text-[36px]">🗺️</span>
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(15,17,23,0.95) 0%, transparent 60%)" }}
        />

        {/* Status badge */}
        <div className="absolute top-2.5 left-2.5">
          {isActive && (
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md"
              style={{ background: "rgba(10,132,255,0.3)", color: "#4da6ff", border: "1px solid rgba(10,132,255,0.3)" }}
            >
              ACTIVO
            </span>
          )}
          {isCompleted && (
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md"
              style={{ background: "rgba(80,80,90,0.6)", color: "#a8e6b8", border: "1px solid rgba(120,200,140,0.2)" }}
            >
              COMPLETADO
            </span>
          )}
        </div>

        {/* Share button */}
        <button
          onClick={(e) => { e.stopPropagation(); onShare(trip) }}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center backdrop-blur-md transition-opacity opacity-0 group-hover:opacity-100"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
          title="Compartir"
        >
          <span className="material-symbols-outlined text-[14px] text-white/70">share</span>
        </button>

        {/* Destination name over image */}
        <div className="absolute bottom-2 left-3 right-3">
          <h3 className="text-[14px] font-bold text-white leading-tight line-clamp-2">{trip.name}</h3>
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-3">
        <p className="text-[12px] text-[#c0c6d6] font-medium mb-2">
          {trip.destination}{trip.country ? `, ${trip.country}` : ""}
        </p>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#9ca3af] mb-3">
          <span>📅 {formatDateRange(trip.startDate, trip.endDate)}</span>
          <span>🗓 {trip.totalDays}d</span>
          <span>📍 {trip.totalActivities}</span>
        </div>

        {/* Action button */}
        <div className="flex gap-2">
          {isActive ? (
            <button
              onClick={(e) => { e.stopPropagation(); router.push("/plan") }}
              className="w-full py-2 rounded-xl text-[12px] font-semibold text-white transition-all active:scale-95"
              style={{ background: "rgba(10,132,255,0.2)", border: "1px solid rgba(10,132,255,0.3)" }}
            >
              Ver plan →
            </button>
          ) : isCompleted ? (
            <div className="flex gap-2 w-full">
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/recap/${trip.id}`) }}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
                style={{ background: "rgba(80,80,90,0.4)", border: "1px solid rgba(120,200,140,0.2)", color: "#a8e6b8" }}
              >
                Recap
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onActivate(trip.id) }}
                disabled={activating === trip.id}
                className="flex-1 py-2 rounded-xl text-[12px] font-medium transition-all active:scale-95 disabled:opacity-60"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "#9ca3af" }}
              >
                {activating === trip.id ? "…" : "Reactivar"}
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onActivate(trip.id) }}
              disabled={activating === trip.id}
              className="w-full py-2 rounded-xl text-[12px] font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
            >
              {activating === trip.id ? "Activando…" : "Continuar"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TripsPage() {
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)
  const [shareToast, setShareToast] = useState("")
  const [page, setPage] = useState(1)
  const router = useRouter()

  const fetchTrips = useCallback(async () => {
    try {
      const res = await fetch("/api/trips")
      const json = await res.json()
      setTrips(json?.data?.trips ?? [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrips()
  }, [fetchTrips])

  const totalPages = Math.ceil(trips.length / ITEMS_PER_PAGE)
  const paginatedTrips = useMemo(
    () => trips.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [trips, page]
  )

  async function handleActivate(tripId: string) {
    setActivating(tripId)
    try {
      await fetch(`/api/trips/${tripId}/activate`, { method: "POST" })
      await fetchTrips()
      router.push("/plan")
    } catch {
      // silently fail
    } finally {
      setActivating(null)
    }
  }

  async function handleShare(trip: TripSummary) {
    const shareUrl = `${window.location.origin}/share/${trip.id}`
    const shareText = `Mira mi itinerario de ${trip.destination} en Viaje360!`
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url: shareUrl })
        return
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareToast("¡Enlace copiado!")
      setTimeout(() => setShareToast(""), 2500)
    } catch {}
  }

  return (
    <div className="min-h-screen pb-28 lg:pb-0 lg:flex lg:h-screen lg:overflow-hidden" style={{ background: "#131315" }}>
      {/* Desktop side nav */}
      <div className="hidden lg:block">
        <SideNav />
      </div>

      {/* Mobile top bar */}
      <div className="lg:hidden">
        <TopAppBar title="Mis viajes" />
      </div>
      {/* Share toast */}
      {shareToast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-[13px] font-semibold text-white"
          style={{ background: "rgba(48,209,88,0.9)", backdropFilter: "blur(12px)" }}
        >
          {shareToast}
        </div>
      )}

      <div className="flex-1 lg:overflow-y-auto">
      <div className="px-4 lg:px-8 pb-4 pt-4 lg:pt-8">
        <h1 className="text-[24px] font-bold text-white mb-1">Mis viajes</h1>
        <p className="text-[14px] text-[#9ca3af]">
          {trips.length > 0
            ? `${trips.length} viaje${trips.length > 1 ? "s" : ""} guardado${trips.length > 1 ? "s" : ""}`
            : ""}
        </p>
      </div>

      <div className="px-4 lg:px-8">
        {/* Loading skeleton grid */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-2xl animate-pulse"
                style={{ background: "rgba(255,255,255,0.05)" }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && trips.length === 0 && (
          <div className="text-center pt-16">
            <span className="text-[48px] block mb-4">🗺️</span>
            <p className="text-[16px] font-semibold text-white mb-2">Aún no tienes viajes</p>
            <p className="text-[14px] text-[#9ca3af] mb-6">Crea tu primer itinerario con IA</p>
            <button
              onClick={() => router.push("/onboarding")}
              className="px-6 py-3 rounded-2xl text-white font-semibold"
              style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
            >
              Planear un viaje
            </button>
          </div>
        )}

        {/* Trip grid */}
        {!loading && trips.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onActivate={handleActivate}
                  activating={activating}
                  onShare={handleShare}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8 mb-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium transition-all disabled:opacity-30"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e4e2e4",
                  }}
                >
                  ← Anterior
                </button>

                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="w-8 h-8 rounded-lg text-[13px] font-semibold transition-all"
                      style={{
                        background: p === page ? "rgba(10,132,255,0.25)" : "transparent",
                        color: p === page ? "#4da6ff" : "#9ca3af",
                        border: p === page ? "1px solid rgba(10,132,255,0.3)" : "1px solid transparent",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium transition-all disabled:opacity-30"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e4e2e4",
                  }}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      </div>
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
