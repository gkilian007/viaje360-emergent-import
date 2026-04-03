"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/store/useAppStore"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { BottomNav } from "@/components/layout/BottomNav"
import { SideNav } from "@/components/layout/SideNav"
import { motion } from "framer-motion"

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
]

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
    <div className="flex min-h-screen" style={{ background: "#0f1117" }}>
    <div className="hidden lg:block"><SideNav /></div>
    <div className="flex flex-col flex-1 min-h-screen overflow-y-auto pb-28 lg:pb-8">

      {/* Header */}
      <div className="px-5 pb-5 page-header-safe-lg">
        <p className="text-[11px] uppercase tracking-widest text-[#0A84FF] font-medium mb-1">Descubrir</p>
        <h1 className="text-[28px] font-black text-white">Explorar</h1>
        <p className="text-[13px] text-[#888] mt-1">Inspírate y planea tu próximo viaje</p>
      </div>

      {/* Search */}
      <div className="px-5 mb-5">
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[20px] text-[#666]">search</span>
          <input
            type="text"
            placeholder="Buscar destinos, estilos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[14px] text-white placeholder:text-[#555] outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[#555] hover:text-white transition-colors">
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
              <p className="text-[11px] uppercase tracking-widest text-[#666] font-medium mb-3">
                Destinos ({filteredDestinations.length})
              </p>
              <div className="space-y-2">
                {filteredDestinations.map(dest => (
                  <motion.button
                    key={dest.name}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDestinationSelect(dest.name)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl text-left"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <span className="text-[28px]">{dest.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-white">{dest.name}</p>
                      <p className="text-[11px] text-[#888]">{dest.country} · {dest.tag}</p>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-[#444]">arrow_forward</span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          {filteredGems.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#666] font-medium mb-3">
                Gemas ocultas ({filteredGems.length})
              </p>
              <div className="space-y-2">
                {filteredGems.map(gem => (
                  <motion.button
                    key={gem.name}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDestinationSelect(gem.name)}
                    className="w-full flex items-start gap-3 p-3 rounded-2xl text-left"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <span className="text-[24px] shrink-0 mt-0.5">{gem.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white">{gem.name}</p>
                      <p className="text-[11px] text-[#888]">{gem.country}</p>
                      <p className="text-[11px] text-[#666] mt-1 leading-relaxed">{gem.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          {!hasResults && (
            <div className="text-center py-12">
              <span className="text-[48px]">🌍</span>
              <p className="text-white font-semibold mt-3">No encontrado</p>
              <p className="text-[#888] text-[13px] mt-1">Prueba con otro nombre de ciudad o país</p>
            </div>
          )}
        </div>
      )}

      {/* Main content (no search) */}
      {!isSearching && (
        <>
          {/* Featured destinations — horizontal scroll */}
          <div className="mb-6">
            <div className="px-5 mb-3 flex items-center justify-between">
              <p className="text-[13px] font-bold text-white">✈️ Destinos populares</p>
              <p className="text-[11px] text-[#555]">Toca para planear</p>
            </div>
            <div className="flex gap-3 px-5 overflow-x-auto pb-2 scrollbar-none">
              {FEATURED_DESTINATIONS.map((dest, idx) => (
                <motion.button
                  key={dest.name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDestinationSelect(dest.name)}
                  className="shrink-0 w-36 rounded-2xl overflow-hidden text-left"
                  style={{ background: "rgba(22,22,30,0.95)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div
                    className="h-20 flex items-center justify-center"
                    style={{ background: `${dest.color}18` }}
                  >
                    <span className="text-[44px]">{dest.emoji}</span>
                  </div>
                  <div className="p-3">
                    <p className="text-[13px] font-bold text-white">{dest.name}</p>
                    <p className="text-[10px] text-[#666] mt-0.5">{dest.tag}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Travel styles */}
          <div className="px-5 mb-6">
            <p className="text-[13px] font-bold text-white mb-3">🧭 Estilo de viaje</p>
            <div className="grid grid-cols-2 gap-2">
              {TRAVEL_STYLES.map(style => (
                <motion.button
                  key={style.label}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleStyleSelect(style.companion)}
                  className="flex flex-col items-center gap-1.5 p-4 rounded-2xl"
                  style={{ background: "rgba(22,22,30,0.95)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <span className="text-[32px]">{style.emoji}</span>
                  <p className="text-[13px] font-bold text-white">{style.label}</p>
                  <p className="text-[10px] text-[#666]">{style.desc}</p>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Hidden gems + Tips — side by side on desktop */}
          <div className="px-5 mb-6 lg:flex lg:gap-6">
            {/* Hidden gems */}
            <div className="lg:flex-1 mb-6 lg:mb-0">
              <p className="text-[13px] font-bold text-white mb-3">💎 Gemas ocultas</p>
              <div className="space-y-2">
                {HIDDEN_GEMS.map(gem => (
                  <motion.button
                    key={gem.name}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDestinationSelect(gem.name)}
                    className="w-full flex items-start gap-3 p-4 rounded-2xl text-left"
                    style={{ background: "rgba(22,22,30,0.95)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <span className="text-[28px] shrink-0">{gem.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-[14px] font-bold text-white">{gem.name}</p>
                        <p className="text-[11px] text-[#555]">{gem.country}</p>
                      </div>
                      <p className="text-[12px] text-[#888] mt-1 leading-relaxed">{gem.desc}</p>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-[#333] shrink-0 mt-1">arrow_forward</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="lg:flex-1">
              <p className="text-[13px] font-bold text-white mb-3">💡 ¿Sabías que...?</p>
              <div className="space-y-2">
                {TRAVEL_TIPS.map((tip, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <span className="text-[18px] shrink-0">{tip.icon}</span>
                    <p className="text-[12px] text-[#aaa] leading-relaxed">{tip.tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Collected monuments (if any) */}
          {monuments.length > 0 && (
            <div className="px-5 mb-6">
              <p className="text-[13px] font-bold text-white mb-3">📍 Lugares visitados</p>
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
                      <p className="text-[13px] font-semibold text-white">{m.name}</p>
                      <p className="text-[11px] text-[#888]">{m.location}</p>
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
