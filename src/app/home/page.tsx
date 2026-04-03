"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/store/useAppStore"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client"
import { BottomNav } from "@/components/layout/BottomNav"
import { SideNav } from "@/components/layout/SideNav"
import { motion } from "framer-motion"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import type { TripSummary } from "@/app/api/trips/route"

// ─── Trending destinations ───────────────────────────────────────────────────

const TRENDING = [
  { name: "Tokio", country: "Japón", emoji: "🗼", color: "#FF453A" },
  { name: "Barcelona", country: "España", emoji: "🏛️", color: "#0A84FF" },
  { name: "Bali", country: "Indonesia", emoji: "🏝️", color: "#30D158" },
  { name: "Nueva York", country: "EE.UU.", emoji: "🗽", color: "#5856D6" },
  { name: "Roma", country: "Italia", emoji: "🏟️", color: "#FF9F0A" },
  { name: "París", country: "Francia", emoji: "🗼", color: "#BF5AF2" },
]

const QUICK_STYLES = [
  { emoji: "👨‍👩‍👧‍👦", label: "Familia", desc: "Con niños", companion: "familia" },
  { emoji: "💑", label: "Pareja", desc: "Romántico", companion: "pareja" },
  { emoji: "🎒", label: "Solo", desc: "Aventura", companion: "solo" },
  { emoji: "👯", label: "Amigos", desc: "Grupo", companion: "amigos" },
]

// ─── Subcomponents ───────────────────────────────────────────────────────────

function ProfileHeader({
  user,
  initials,
  displayName,
  email,
  tripCount,
  totalDays,
  onLogout,
}: {
  user: SupabaseUser | null
  initials: string
  displayName: string
  email: string
  tripCount: number
  totalDays: number
  onLogout: () => void
}) {
  return (
    <div className="relative">
      {/* Cover */}
      <div
        className="h-32 lg:h-44 rounded-b-3xl lg:rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0A84FF 0%, #5856D6 50%, #BF5AF2 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
        />
      </div>

      {/* Profile card */}
      <div className="px-4 lg:px-6 -mt-12">
        <div
          className="rounded-2xl p-4 lg:p-5"
          style={{
            background: "rgba(28,28,30,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl flex items-center justify-center text-[22px] lg:text-[28px] font-bold text-white shrink-0 ring-4 ring-[#131315]"
              style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
            >
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-[18px] lg:text-[22px] font-bold text-white truncate">{displayName}</h1>
              <p className="text-[12px] text-[#9ca3af] truncate">{email}</p>

              {/* Stats row */}
              <div className="flex gap-4 mt-2">
                <div className="text-center">
                  <p className="text-[16px] font-bold text-white">{tripCount}</p>
                  <p className="text-[10px] text-[#888]">Viajes</p>
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-bold text-white">{totalDays}</p>
                  <p className="text-[10px] text-[#888]">Días</p>
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-bold text-white">{tripCount > 0 ? 1 : 0}</p>
                  <p className="text-[10px] text-[#888]">Países</p>
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 hover:bg-white/5 transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="material-symbols-outlined text-[18px] text-[#888]">logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreatePostCTA({ onNewTrip }: { onNewTrip: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onNewTrip}
      className="w-full rounded-2xl p-4 text-left"
      style={{
        background: "rgba(28,28,30,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
        >
          <span className="material-symbols-outlined text-[20px] text-white">add_location_alt</span>
        </div>
        <p className="text-[14px] text-[#888]">¿A dónde quieres ir?</p>
        <div className="ml-auto px-4 py-2 rounded-xl text-[13px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
        >
          Planificar
        </div>
      </div>
    </motion.button>
  )
}

function getDestinationImageUrl(destination: string): string {
  const encoded = encodeURIComponent(destination.toLowerCase())
  return `https://source.unsplash.com/featured/800x400/?${encoded},travel`
}

function TripCard({
  trip,
  onContinue,
  onViewRecap,
  onShare,
}: {
  trip: TripSummary
  onContinue: () => void
  onViewRecap: () => void
  onShare: () => void
}) {
  const imageUrl = trip.imageUrl ?? getDestinationImageUrl(trip.destination)
  const isCompleted = trip.status === "completed"

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(28,28,30,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Trip header image area */}
      <div className="h-36 lg:h-44 relative overflow-hidden">
        {/* Destination photo */}
        <img
          src={imageUrl}
          alt={trip.destination}
          className="absolute inset-0 w-full h-full object-cover"
          style={isCompleted ? { filter: "saturate(0.5) brightness(0.85)" } : undefined}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none"
          }}
        />
        {/* Dark gradient overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        {/* Status badge */}
        <div
          className="absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-semibold"
          style={{
            background: trip.status === "active"
              ? "rgba(48,209,88,0.85)"
              : isCompleted
              ? "rgba(80,80,90,0.85)"
              : "rgba(0,0,0,0.55)",
            color: trip.status === "active" ? "#fff" : isCompleted ? "#a8e6b8" : "#ccc",
            backdropFilter: "blur(8px)",
            border: `1px solid ${trip.status === "active" ? "rgba(48,209,88,0.5)" : isCompleted ? "rgba(120,200,140,0.3)" : "rgba(255,255,255,0.15)"}`,
          }}
        >
          {trip.status === "active" ? "● En curso" : trip.status === "planning" ? "Planificando" : "✓ Completado"}
        </div>
        {/* Destination label at bottom-left */}
        <div className="absolute bottom-3 left-3">
          <p className="text-[18px] font-bold text-white capitalize drop-shadow-md">{trip.destination}</p>
          {trip.country && (
            <p className="text-[11px] text-white/75 drop-shadow-sm">{trip.country}</p>
          )}
        </div>
      </div>

      {/* Trip info */}
      <div className="p-4">
        <p className="text-[12px] text-[#888]">
          {trip.totalDays} días · {trip.totalActivities} actividades · €{trip.budget}
        </p>

        {/* Action row */}
        <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={onShare}
            className="flex items-center gap-1.5 text-[12px] text-[#888] hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            Compartir
          </button>
          {!isCompleted && (
            <button
              onClick={onViewRecap}
              className="flex items-center gap-1.5 text-[12px] text-[#888] hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">auto_stories</span>
              Recap
            </button>
          )}
          {isCompleted ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onViewRecap}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold"
              style={{
                background: "rgba(80,80,90,0.6)",
                border: "1px solid rgba(120,200,140,0.25)",
                color: "#a8e6b8",
              }}
            >
              <span className="material-symbols-outlined text-[16px]">auto_stories</span>
              Ver recap
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onContinue}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
            >
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              Ver itinerario
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function EmptyFeed({ onNewTrip }: { onNewTrip: () => void }) {
  return (
    <div
      className="rounded-2xl p-8 text-center"
      style={{
        background: "rgba(28,28,30,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span className="text-[56px] block mb-3">🗺️</span>
      <h3 className="text-[18px] font-bold text-white mb-2">Tu aventura empieza aquí</h3>
      <p className="text-[13px] text-[#888] max-w-sm mx-auto mb-6">
        Crea tu primer itinerario personalizado con IA y empieza a explorar el mundo.
      </p>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onNewTrip}
        className="px-6 py-3 rounded-2xl font-semibold text-white"
        style={{
          background: "linear-gradient(135deg, #0A84FF, #5856D6)",
          boxShadow: "0 4px 20px rgba(10,132,255,0.3)",
        }}
      >
        Crear mi primer viaje ✨
      </motion.button>
    </div>
  )
}

function TrendingWidget({ onSelect }: { onSelect: (companion?: string, destination?: string) => void }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "rgba(28,28,30,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[18px] text-[#FF9F0A]">trending_up</span>
        <h3 className="text-[14px] font-bold text-white">Destinos populares</h3>
      </div>
      <div className="space-y-2">
        {TRENDING.map((dest) => (
          <motion.button
            key={dest.name}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(undefined, dest.name)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[18px] shrink-0"
              style={{ background: `${dest.color}15`, border: `1px solid ${dest.color}30` }}
            >
              {dest.emoji}
            </div>
            <div className="text-left">
              <p className="text-[13px] font-semibold text-white">{dest.name}</p>
              <p className="text-[11px] text-[#888]">{dest.country}</p>
            </div>
            <span className="material-symbols-outlined text-[16px] text-[#555] ml-auto">chevron_right</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function StylesWidget({ onNewTrip }: { onNewTrip: (companion?: string, destination?: string) => void }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "rgba(28,28,30,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[18px] text-[#BF5AF2]">travel_explore</span>
        <h3 className="text-[14px] font-bold text-white">Tipo de viaje</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_STYLES.map((style) => (
          <motion.button
            key={style.label}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNewTrip(style.companion)}
            className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-white/5 transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-[24px]">{style.emoji}</span>
            <span className="text-[12px] font-semibold text-white">{style.label}</span>
            <span className="text-[10px] text-[#888]">{style.desc}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function TipsWidget() {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "rgba(28,28,30,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[18px] text-[#30D158]">tips_and_updates</span>
        <h3 className="text-[14px] font-bold text-white">Tips de viaje</h3>
      </div>
      <div className="space-y-3">
        {[
          { icon: "🧳", text: "Haz una lista de lo esencial 2 días antes de salir" },
          { icon: "📱", text: "Descarga mapas offline de tu destino" },
          { icon: "💡", text: "La IA adapta tu plan si cambias de opinión" },
        ].map((tip, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="text-[16px] shrink-0 mt-0.5">{tip.icon}</span>
            <p className="text-[12px] text-[#c0c6d6] leading-relaxed">{tip.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const resetOnboarding = useOnboardingStore((s) => s.reset)
  const setOnboardingField = useOnboardingStore((s) => s.setField)
  const { setCurrentTrip, setGeneratedItinerary, replaceChatMessages } = useAppStore()
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [allTrips, setAllTrips] = useState<TripSummary[]>([])
  const [shareToast, setShareToast] = useState("")

  useEffect(() => {
    async function loadUser() {
      if (!isSupabaseBrowserConfigured()) {
        setLoadingAuth(false)
        return
      }
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      setAuthUser(data.user ?? null)
      setLoadingAuth(false)
    }
    void loadUser()
  }, [])

  // Load all trips for the feed
  useEffect(() => {
    async function loadTrips() {
      try {
        const res = await fetch("/api/trips", { cache: "no-store" })
        if (!res.ok) return
        const payload = await res.json()
        const trips: TripSummary[] = payload?.data?.trips ?? []
        setAllTrips(trips)
        // Fire background image caching for trips without a cached image URL
        for (const trip of trips) {
          if (!trip.imageUrl) {
            fetch(`/api/trips/${trip.id}/image`, { method: "POST" }).catch(() => {})
          }
        }
      } catch {}
    }
    if (!loadingAuth) void loadTrips()
  }, [loadingAuth])

  // Also load the active trip into the store so /plan still works
  useEffect(() => {
    async function loadActiveTrip() {
      try {
        const res = await fetch("/api/trips/active", { cache: "no-store" })
        if (!res.ok) return
        const payload = await res.json()
        if (payload?.data?.trip) {
          setCurrentTrip(payload.data.trip)
          setGeneratedItinerary(payload.data.days ?? null)
          if (payload.data.chatMessages) {
            replaceChatMessages(payload.data.chatMessages)
          }
        }
      } catch {}
    }
    if (!loadingAuth) void loadActiveTrip()
  }, [loadingAuth, setCurrentTrip, setGeneratedItinerary, replaceChatMessages])

  function handleNewTrip(companion?: string, destination?: string) {
    resetOnboarding()
    if (companion) {
      setOnboardingField("companion", companion as "solo" | "pareja" | "familia" | "amigos")
    }
    if (destination) {
      setOnboardingField("destination", destination)
    }
    router.push("/onboarding")
  }

  async function handleActivateAndNavigate(trip: TripSummary) {
    if (trip.status !== "active") {
      try {
        await fetch(`/api/trips/${trip.id}/activate`, { method: "POST" })
      } catch {}
    }
    router.push("/plan")
  }

  function handleViewRecap(tripId: string) {
    router.push(`/recap/${tripId}`)
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

  async function handleLogout() {
    if (isSupabaseBrowserConfigured()) {
      const supabase = createClient()
      await supabase.auth.signOut()
    }
    router.replace("/login")
  }

  const displayName =
    authUser?.user_metadata?.full_name ??
    authUser?.email?.split("@")[0] ??
    "Viajero"

  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const email = authUser?.email ?? "Modo demo"
  const tripCount = allTrips.length
  const totalDays = allTrips.reduce((sum, t) => sum + t.totalDays, 0)

  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "#131315" }}>
        <div className="w-10 h-10 border-2 border-[#0A84FF] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#131315" }}>
    <div className="hidden lg:block"><SideNav /></div>
    <div className="flex-1 min-h-screen pb-28 lg:pb-8">
      {/* Share toast */}
      {shareToast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-[13px] font-semibold text-white"
          style={{ background: "rgba(48,209,88,0.9)", backdropFilter: "blur(12px)" }}
        >
          {shareToast}
        </div>
      )}

      {/* Top bar — desktop */}
      <header
        className="hidden lg:flex items-center justify-between px-6 py-3 sticky top-0 z-50"
        style={{
          background: "rgba(19,19,21,0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Viaje360" className="w-8 h-8 rounded-xl"/>
          <span className="text-[18px] font-bold text-white">Viaje360</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: "rgba(42,42,44,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[18px] text-[#888]">search</span>
          <span className="text-[13px] text-[#888]">Buscar destinos...</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="material-symbols-outlined text-[20px] text-[#c0c6d6]">notifications</span>
          </button>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white cursor-pointer"
            style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
          >
            {initials}
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="lg:hidden flex items-center justify-between px-4 pb-3 page-header-safe-lg">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Viaje360" className="w-7 h-7 rounded-lg"/>
          <span className="text-[16px] font-bold text-white">Viaje360</span>
        </div>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(42,42,44,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[18px] text-[#c0c6d6]">notifications</span>
        </button>
      </header>

      {/* 3-column layout */}
      <div className="max-w-7xl mx-auto lg:px-6 lg:mt-6">
        <div className="lg:grid lg:grid-cols-[280px_1fr_300px] lg:gap-6">

          {/* ─── Left sidebar (desktop) ─── */}
          <aside className="hidden lg:block space-y-4 sticky top-20 self-start">
            <ProfileHeader
              user={authUser}
              initials={initials}
              displayName={displayName}
              email={email}
              tripCount={tripCount}
              totalDays={totalDays}
              onLogout={handleLogout}
            />

            {/* Nav links */}
            <div
              className="rounded-2xl p-3"
              style={{
                background: "rgba(28,28,30,0.95)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {[
                { icon: "home", label: "Inicio", href: "/home", active: true },
                { icon: "explore", label: "Explorar", href: "/explore" },
                { icon: "event_note", label: "Mi Plan", href: "/plan" },
                { icon: "map", label: "Mapa", href: "/mapa" },
                { icon: "smart_toy", label: "Asistente IA", href: "/ai" },
                { icon: "emoji_events", label: "Logros", href: "/status" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    item.active ? "bg-[#0A84FF]/10 text-[#0A84FF]" : "text-[#c0c6d6] hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="text-[13px] font-medium">{item.label}</span>
                </a>
              ))}
            </div>
          </aside>

          {/* ─── Main feed ─── */}
          <main className="space-y-4 px-4 lg:px-0">
            {/* Mobile profile */}
            <div className="lg:hidden">
              <ProfileHeader
                user={authUser}
                initials={initials}
                displayName={displayName}
                email={email}
                tripCount={tripCount}
                totalDays={totalDays}
                onLogout={handleLogout}
              />
            </div>

            {/* Create trip CTA — like "What's on your mind?" */}
            <div className="mt-4 lg:mt-0">
              <CreatePostCTA onNewTrip={handleNewTrip} />
            </div>

            {/* Trip feed — all trips */}
            {allTrips.length > 0 ? (
              allTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onContinue={() => handleActivateAndNavigate(trip)}
                  onViewRecap={() => handleViewRecap(trip.id)}
                  onShare={() => handleShare(trip)}
                />
              ))
            ) : (
              <EmptyFeed onNewTrip={handleNewTrip} />
            )}

            {/* Mobile widgets — stacked below feed */}
            <div className="lg:hidden space-y-4">
              <TrendingWidget onSelect={handleNewTrip} />
              <StylesWidget onNewTrip={handleNewTrip} />
              <TipsWidget />
            </div>
          </main>

          {/* ─── Right sidebar (desktop) ─── */}
          <aside className="hidden lg:block space-y-4 sticky top-20 self-start">
            <TrendingWidget onSelect={handleNewTrip} />
            <StylesWidget onNewTrip={handleNewTrip} />
            <TipsWidget />
          </aside>

        </div>
      </div>

      <div className="lg:hidden"><BottomNav /></div>
    </div>
    </div>
  )
}
