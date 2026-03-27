"use client"

import { useState } from "react"
import { useAppStore } from "@/store/useAppStore"
import { BottomNav } from "@/components/layout/BottomNav"
import { RARITY_COLORS, RARITY_LABELS } from "@/lib/constants"
import { QuizCard } from "@/components/features/QuizCard"
import { demoDestinations } from "@/lib/demo-data"

export default function ExplorePage() {
  const { monuments } = useAppStore()
  const [search, setSearch] = useState("")

  const filteredMonuments = monuments.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.location.toLowerCase().includes(search.toLowerCase())
  )

  const filteredDestinations = demoDestinations.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.country.toLowerCase().includes(search.toLowerCase())
  )

  const hasResults = filteredMonuments.length > 0 || filteredDestinations.length > 0
  const totalResults = filteredMonuments.length + filteredDestinations.length

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24" style={{ background: "#131315" }}>
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-1">
          Descubrir
        </p>
        <h1 className="text-[26px] font-bold text-white">Explorar</h1>
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: "rgba(31,31,33,0.9)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <span className="material-symbols-outlined text-[20px] text-[#c0c6d6]">search</span>
          <input
            type="text"
            placeholder="Buscar lugares, ciudades..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[14px] text-[#e4e2e4] placeholder:text-[#c0c6d6]/50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[#c0c6d6] hover:text-white">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Featured destinations */}
      {!search && (
        <>
          <div className="px-4 mb-3">
            <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium">
              Destinos Populares
            </p>
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto pb-2 mb-4">
            {demoDestinations.map((dest) => (
              <div
                key={dest.id}
                className="shrink-0 w-40 rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-all"
                style={{ background: "rgba(31,31,33,0.9)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className={`h-24 bg-gradient-to-br ${dest.imageColor} relative`}>
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute bottom-2 left-2">
                    <span
                      className="text-[10px] px-2 py-1 rounded-full font-medium text-white"
                      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}
                    >
                      ⭐ {dest.rating}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-[13px] font-semibold text-white">{dest.name}</p>
                  <p className="text-[11px] text-[#c0c6d6]">{dest.country}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Quiz card */}
      {!search && (
        <div className="px-4 mb-4">
          <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-3">
            Quiz del Día
          </p>
          <QuizCard />
        </div>
      )}

      {/* Search results: destinations */}
      {search && filteredDestinations.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-3">
            Destinos ({filteredDestinations.length})
          </p>
          <div className="flex flex-col gap-2">
            {filteredDestinations.map((dest) => (
              <div
                key={dest.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "rgba(31,31,33,0.9)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${dest.imageColor} shrink-0`} />
                <div>
                  <p className="text-[14px] font-semibold text-white">{dest.name}</p>
                  <p className="text-[12px] text-[#c0c6d6]">{dest.country} · ⭐ {dest.rating}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monuments / places */}
      <div className="px-4">
        <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-3">
          {search ? `Resultados (${totalResults})` : "Lugares para Coleccionar"}
        </p>
        <div className="flex flex-col gap-3">
          {filteredMonuments.length === 0 && (
            <div
              className="flex flex-col items-center gap-3 py-8 px-4 rounded-2xl text-center"
              style={{ background: "rgba(19,19,21,0.6)", border: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span className="material-symbols-outlined text-[40px] text-[#c0c6d6]">explore</span>
              <div>
                <p className="text-[15px] font-semibold text-white mb-1">Descubre lugares increíbles</p>
                <p className="text-[13px] text-[#888]">
                  Visita sitios de tu itinerario para coleccionar lugares y ganar XP
                </p>
              </div>
            </div>
          )}
          {filteredMonuments.map((monument) => {
            const rarity = RARITY_COLORS[monument.rarity]
            return (
              <div
                key={monument.id}
                className={`flex items-center gap-4 p-4 rounded-2xl ${monument.collected ? rarity.glow : ""}`}
                style={{
                  background: monument.collected ? "rgba(31,31,33,0.9)" : "rgba(19,19,21,0.6)",
                  border: `1px solid ${monument.collected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}`,
                }}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${rarity.bg}`}
                >
                  <span
                    className={`material-symbols-outlined text-[24px] ${rarity.text}`}
                    style={
                      monument.collected
                        ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
                        : {}
                    }
                  >
                    {monument.collected ? "place" : "lock"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white truncate">{monument.name}</p>
                  <p className="text-[12px] text-[#c0c6d6] truncate flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">location_on</span>
                    {monument.location}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-medium ${rarity.text}`}>
                      {RARITY_LABELS[monument.rarity]}
                    </span>
                    <span className="text-[10px] text-[#ffdb3c] flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[11px]"
                        style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                        stars
                      </span>
                      +{monument.xpReward} XP
                    </span>
                  </div>
                </div>
                {monument.collected && (
                  <div className="shrink-0">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(48, 209, 88, 0.15)" }}
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#30D158]"
                        style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                        check_circle
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
