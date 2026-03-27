"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { TripSummary } from "@/app/api/trips/route"

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
  return `${s.toLocaleDateString("es-ES", opts)} – ${e.toLocaleDateString("es-ES", opts)}`
}

function TripRow({
  trip,
  onActivate,
  activating,
}: {
  trip: TripSummary
  onActivate: (id: string) => void
  activating: string | null
}) {
  const router = useRouter()
  const isActive = trip.status === "active"

  return (
    <div
      className="rounded-2xl p-4 mb-3 transition-all"
      style={{
        background: isActive
          ? "linear-gradient(135deg, rgba(10,132,255,0.1), rgba(88,86,214,0.08))"
          : "rgba(30,30,32,0.9)",
        border: isActive ? "1px solid rgba(10,132,255,0.3)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {isActive && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: "rgba(10,132,255,0.2)", color: "#0A84FF" }}
              >
                ACTIVO
              </span>
            )}
            <h3 className="text-[15px] font-semibold text-white truncate">{trip.name}</h3>
          </div>
          <p className="text-[12px] text-[#9ca3af]">{trip.destination}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[12px] text-[#9ca3af] mb-3">
        <span>📅 {formatDateRange(trip.startDate, trip.endDate)}</span>
        <span>🗓 {trip.totalDays} días</span>
        <span>📍 {trip.totalActivities} actividades</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => router.push(`/recap/${trip.id}`)}
          className="flex-1 py-2 rounded-xl text-[13px] font-medium transition-all active:scale-95"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#e4e2e4",
          }}
        >
          Ver recap
        </button>

        {!isActive && (
          <button
            onClick={() => onActivate(trip.id)}
            disabled={activating === trip.id}
            className="flex-1 py-2 rounded-xl text-[13px] font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
          >
            {activating === trip.id ? "Activando…" : "Continuar"}
          </button>
        )}

        {isActive && (
          <button
            onClick={() => router.push("/plan")}
            className="flex-1 py-2 rounded-xl text-[13px] font-semibold text-white transition-all active:scale-95"
            style={{ background: "rgba(10,132,255,0.2)", border: "1px solid rgba(10,132,255,0.3)" }}
          >
            Ver plan →
          </button>
        )}
      </div>
    </div>
  )
}

export default function TripsPage() {
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)
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

  return (
    <div className="min-h-screen pb-28" style={{ background: "#131315" }}>
      <div className="px-4 pt-16 pb-4">
        <h1 className="text-[24px] font-bold text-white mb-1">Mis viajes</h1>
        <p className="text-[14px] text-[#9ca3af]">
          {trips.length > 0 ? `${trips.length} viaje${trips.length > 1 ? "s" : ""} guardado${trips.length > 1 ? "s" : ""}` : ""}
        </p>
      </div>

      <div className="px-4">
        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl animate-pulse"
                style={{ background: "rgba(255,255,255,0.05)" }}
              />
            ))}
          </div>
        )}

        {!loading && trips.length === 0 && (
          <div className="text-center pt-16">
            <span className="text-[48px] block mb-4">🗺️</span>
            <p className="text-[16px] font-semibold text-white mb-2">Aún no tienes viajes</p>
            <p className="text-[14px] text-[#9ca3af] mb-6">
              Crea tu primer itinerario con IA
            </p>
            <button
              onClick={() => router.push("/onboarding")}
              className="px-6 py-3 rounded-2xl text-white font-semibold"
              style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
            >
              Planear un viaje
            </button>
          </div>
        )}

        {!loading &&
          trips.map((trip) => (
            <TripRow
              key={trip.id}
              trip={trip}
              onActivate={handleActivate}
              activating={activating}
            />
          ))}
      </div>
    </div>
  )
}
