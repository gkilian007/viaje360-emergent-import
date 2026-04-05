"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/store/useAppStore"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { BottomNav } from "@/components/layout/BottomNav"
import { SideNav } from "@/components/layout/SideNav"
import { motion } from "framer-motion"
import Image from "next/image"
import { getDestinationHeroThumb } from "@/lib/services/destination-photos"

// ─── Curated content — no dependency on user state ───────────────────────────

const FEATURED_DESTINATIONS = [
  { name: "Tokio", country: "Japón", emoji: "🗼", color: "#FF453A", tag: "Cultura y tecnología" },
  { name: "Barcelona", country: "España", emoji: "🏛️", color: "#0A84FF", tag: "Arquitectura y playa" },
  { name: "Bali", country: "Indonesia", emoji: "🏝️", color: "#30D158", tag: "Naturaleza y bienestar" },
  { name: "Nueva York", country: "EE.UU.", emoji: "🗽", color: "#5856D6", tag: "Ciudad sin parar" },
  { name: "Roma", country: "Italia", emoji: "🏟️", color: "#FF9F0A", tag: "Historia viva" },
  { name: "París", country: "Francia", emoji: "🗼", color: "#BF5AF2", tag: "Arte y gastronomía" },
  { name: "Lisboa", country: "Portugal", emoji: "🐟", color: "#32D74B", tag: "Fado y pastelería" },
  { name: "Kioto", country: "Japón", emoji: "⛩️", color: "#FF6B6B", tag: "Tradición japonesa" },
  { name: "Marrakech", country: "Marruecos", emoji: "🕌", color: "#FFB84D", tag: "Souks y especias" },
  { name: "Ámsterdam", country: "Países Bajos", emoji: "🌷", color: "#4ECDC4", tag: "Canales y arte" },
  { name: "Dubái", country: "EAU", emoji: "🌆", color: "#C4A35A", tag: "Lujo y modernidad" },
  { name: "Ciudad de México", country: "México", emoji: "🌮", color: "#E84393", tag: "Cultura y sabor" },
].map(d => ({ ...d, photoUrl: getDestinationHeroThumb(d.name, 600) }))

const TRAVEL_STYLES = [
  { emoji: "🎒", label: "Mochilero", desc: "Máximo con mínimo presupuesto", companion: "solo" },
  { emoji: "💑", label: "Pareja", desc: "Escapadas románticas", companion: "pareja" },
  { emoji: "👨‍👩‍👧‍👦", label: "Familia", desc: "Para todas las edades", companion: "familia" },
  { emoji: "👯", label: "Amigos", desc: "Planes en grupo", companion: "amigos" },
]

const HIDDEN_GEMS = [
  { name: "Kotor", country: "Montenegro", emoji: "🏰", desc: "Ciudad medieval amurallada en un fiordo adriático" },
  { name: "Matera", country: "Italia", emoji: "🪨", desc: "Ciudad rupestre de 9.000 años de antigüedad, Capital Europea de la Cultura" },
  { name: "Faroe Islands", country: "Dinamarca", emoji: "🌊", desc: "Acantilados dramáticos y pueblos de turba en el Atlántico Norte" },
  { name: "Luang Prabang", country: "Laos", emoji: "🛕", desc: "Ciudad de templos y cascadas en el Mekong" },
  { name: "Chefchaouen", country: "Marruecos", emoji: "💙", desc: "La ciudad azul escondida en las montañas del Rif" },
  { name: "Tbilisi", country: "Georgia", emoji: "🏔️", desc: "Vinos naturales, baños de azufre y arquitectura soviética" },
]

const TRAVEL_TIPS = [
  { icon: "🌦️", tip: "Viaje360 adapta tu itinerario en tiempo real si llueve o hace calor extremo" },
  { icon: "✨", tip: "El Momento Mágico detecta gemas ocultas cerca de ti mientras viajas" },
  { icon: "📖", tip: "El diario de viaje con IA genera tu historia personalizada al final del viaje" },
  { icon: "🚇", tip: "El sistema de transporte sugiere metro o caminar según tu energía del día" },
  { icon: "🎟️", tip: "Reserva entradas directamente desde la actividad de tu itinerario" },
]

export default function ExplorePage() {
  const router = useRouter()
  const { monuments } = useAppStore()
  const { setField: setOnboardingField, reset: resetOnboarding } = useOnboardingStore()
  const [search, setSearch] = useState("")
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)

  useEffect(() => {
    if (!isSupabaseBrowserConfigured()) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setAuthUser(data.user ?? null))
  }, [])

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

  const email = authUser?.email ?? ""

  const filteredDestinations = FEATURED_DESTINATIONS.filter(
    d =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.country.toLowerCase().includes(search.toLowerCase()) ||
      d.tag.toLowerCase().includes(search.toLowerCase())
  )

  const filteredGems = HIDDEN_GEMS.filter(
    g =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.country.toLowerCase().includes(search.toLowerCase()) ||
      g.desc.toLowerCase().includes(search.toLowerCase())
  )

  function handleDestinationSelect(destName: string) {
    resetOnboarding()
    setOnboardingField("destination", destName)
    router.push("/onboarding")
  }

  function handleStyleSelect(companion: string) {
    resetOnboarding()
    setOnboardingField("companion", companion as "solo" | "pareja" | "familia" | "amigos")
    router.push("/onboarding")
  }

  const isSearching = search.length > 0
  const hasResults = filteredDestinations.length > 0 || filteredGems.length > 0

  return (
    <div className="flex min-h-screen" style={{ background: "var(--surface)" }}>
    <div className="hidden lg:block"><SideNav /></div>
    <div className="flex flex-col flex-1 min-h-screen overflow-y-auto pb-28 lg:pb-8">

      {/* Desktop top bar with avatar */}
      <header
        className="hidden lg:flex items-center justify-between px-6 py-3 sticky top-0 z-50"
        style={{
          background: "var(--surface-container)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Viaje360" className="w-8 h-8 rounded-xl" />
          <span className="text-[18px] font-bold text-[var(--on-surface)]">Explorar</span>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAvatarMenu((v) => !v)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white cursor-pointer"
            style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
          >
            {initials || "?"}
          </button>
          {showAvatarMenu && (
            <div
              className="absolute right-0 top-12 w-56 rounded-2xl p-2 z-[60] shadow-2xl"
              style={{ background: "var(--surface-container)", border: "1px solid var(--border-color)", backdropFilter: "blur(20px)" }}
            >
              {email && (
                <div className="px-3 py-2 mb-1">
                  <p className="text-[13px] font-semibold text-[var(--on-surface)] truncate">{displayName}</p>
                  <p className="text-[11px] text-[var(--on-surface-variant)] truncate">{email}</p>
                </div>
              )}
              <div style={{ borderTop: "1px solid var(--border-color)" }} />
              <button
                type="button"
                onClick={() => { setShowAvatarMenu(false); router.push("/home") }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-[color:var(--on-surface-variant)] hover:bg-white/5 transition-colors text-left mt-1"
              >
                <span className="material-symbols-outlined text-[18px]">home</span>
                Inicio
              </button>
              <button
                type="button"
                onClick={() => { setShowAvatarMenu(false); handleLogout() }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-red-400 hover:bg-red-500/10 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Header */}
      <div className="px-5 pb-5 page-header-safe-lg lg:hidden">
        <p className="text-[11px] uppercase tracking-widest text-[#0A84FF] font-medium mb-1">Descubrir</p>
        <h1 className="text-[28px] font-black text-[var(--on-surface)]">Explorar</h1>
        <p className="text-[13px] text-[var(--on-surface-variant)] mt-1">Inspírate y planea tu próximo viaje</p>
      </div>

      {/* Search */}
      <div className="px-5 mb-5">
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)" }}>
          <span className="material-symbols-outlined text-[20px] text-[var(--on-surface-variant)]">search</span>
          <input
            type="text"
            placeholder="Buscar destinos, estilos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[14px] text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {isSearching && (
        <div className="px-5 space-y-4">
          {filteredDestinations.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[var(--on-surface-variant)] font-medium mb-3">
                Destinos ({filteredDestinations.length})
              </p>
              <div className="space-y-2">
                {filteredDestinations.map(dest => (
                  <motion.button
                    key={dest.name}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDestinationSelect(dest.name)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl text-left"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)" }}
                  >
                    <span className="text-[28px]">{dest.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-[var(--on-surface)]">{dest.name}</p>
                      <p className="text-[11px] text-[var(--on-surface-variant)]">{dest.country} · {dest.tag}</p>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-[var(--on-surface-variant)]">arrow_forward</span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          {filteredGems.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[var(--on-surface-variant)] font-medium mb-3">
                Gemas ocultas ({filteredGems.length})
              </p>
              <div className="space-y-2">
                {filteredGems.map(gem => (
                  <motion.button
                    key={gem.name}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDestinationSelect(gem.name)}
                    className="w-full flex items-start gap-3 p-3 rounded-2xl text-left"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)" }}
                  >
                    <span className="text-[24px] shrink-0 mt-0.5">{gem.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[var(--on-surface)]">{gem.name}</p>
                      <p className="text-[11px] text-[var(--on-surface-variant)]">{gem.country}</p>
                      <p className="text-[11px] text-[var(--on-surface-variant)] mt-1 leading-relaxed">{gem.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          {!hasResults && (
            <div className="text-center py-12">
              <span className="text-[48px]">🌍</span>
              <p className="text-[var(--on-surface)] font-semibold mt-3">No encontrado</p>
              <p className="text-[var(--on-surface-variant)] text-[13px] mt-1">Prueba con otro nombre de ciudad o país</p>
            </div>
          )}
        </div>
      )}

      {/* Main content (no search) */}
      {!isSearching && (
        <>
          {/* Featured destinations + Travel styles — side by side on desktop */}
          <div className="px-5 mb-6 lg:flex lg:gap-6">
            {/* Featured destinations */}
            <div className="lg:flex-1 mb-6 lg:mb-0">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-bold text-[var(--on-surface)]">✈️ Destinos populares</p>
                <p className="text-[11px] text-[var(--on-surface-variant)]">Toca para planear</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none lg:grid lg:grid-cols-3 lg:overflow-visible">
                {FEATURED_DESTINATIONS.map((dest, idx) => (
                  <motion.button
                    key={dest.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDestinationSelect(dest.name)}
                    className="shrink-0 w-36 lg:w-auto rounded-2xl overflow-hidden text-left"
                    style={{ background: "var(--surface-container)", border: "1px solid var(--border-color)" }}
                  >
                    <div
                      className="h-20 relative flex items-center justify-center overflow-hidden"
                      style={{ background: `${dest.color}18` }}
                    >
                      {dest.photoUrl ? (
                        <Image
                          src={dest.photoUrl}
                          alt={dest.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 144px, 200px"
                          unoptimized
                        />
                      ) : (
                        <span className="text-[44px]">{dest.emoji}</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-[13px] font-bold text-[var(--on-surface)]">{dest.name}</p>
                      <p className="text-[10px] text-[var(--on-surface-variant)] mt-0.5">{dest.tag}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Travel styles */}
            <div className="lg:flex-1">
              <p className="text-[13px] font-bold text-[var(--on-surface)] mb-3">🧭 Estilo de viaje</p>
              <div className="grid grid-cols-2 gap-2">
                {TRAVEL_STYLES.map(style => (
                  <motion.button
                    key={style.label}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleStyleSelect(style.companion)}
                    className="flex flex-col items-center gap-1.5 p-4 rounded-2xl"
                    style={{ background: "var(--surface-container)", border: "1px solid var(--border-color)" }}
                  >
                    <span className="text-[32px]">{style.emoji}</span>
                    <p className="text-[13px] font-bold text-[var(--on-surface)]">{style.label}</p>
                    <p className="text-[10px] text-[var(--on-surface-variant)]">{style.desc}</p>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {/* Hidden gems + Tips — side by side on desktop */}
          <div className="px-5 mb-6 lg:flex lg:gap-6">
            {/* Hidden gems */}
            <div className="lg:flex-1 mb-6 lg:mb-0">
              <p className="text-[13px] font-bold text-[var(--on-surface)] mb-3">💎 Gemas ocultas</p>
              <div className="space-y-2">
                {HIDDEN_GEMS.map(gem => (
                  <motion.button
                    key={gem.name}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDestinationSelect(gem.name)}
                    className="w-full flex items-start gap-3 p-4 rounded-2xl text-left"
                    style={{ background: "var(--surface-container)", border: "1px solid var(--border-color)" }}
                  >
                    <span className="text-[28px] shrink-0">{gem.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-[14px] font-bold text-[var(--on-surface)]">{gem.name}</p>
                        <p className="text-[11px] text-[var(--on-surface-variant)]">{gem.country}</p>
                      </div>
                      <p className="text-[12px] text-[var(--on-surface-variant)] mt-1 leading-relaxed">{gem.desc}</p>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-[var(--on-surface-variant)] shrink-0 mt-1">arrow_forward</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="lg:flex-1">
              <p className="text-[13px] font-bold text-[var(--on-surface)] mb-3">💡 ¿Sabías que...?</p>
              <div className="space-y-2">
                {TRAVEL_TIPS.map((tip, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)" }}
                  >
                    <span className="text-[18px] shrink-0">{tip.icon}</span>
                    <p className="text-[12px] text-[var(--on-surface-variant)] leading-relaxed">{tip.tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Collected monuments (if any) */}
          {monuments.length > 0 && (
            <div className="px-5 mb-6">
              <p className="text-[13px] font-bold text-[var(--on-surface)] mb-3">📍 Lugares visitados</p>
              <div className="space-y-2">
                {monuments.filter(m => m.collected).map(m => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: "rgba(48,209,88,0.06)", border: "1px solid rgba(48,209,88,0.15)" }}
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#30D158]"
                      style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--on-surface)]">{m.name}</p>
                      <p className="text-[11px] text-[var(--on-surface-variant)]">{m.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="lg:hidden"><BottomNav /></div>
    </div>
    </div>
  )
}
