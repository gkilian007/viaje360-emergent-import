"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import dynamic from "next/dynamic"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"

const HotelMapPicker = dynamic(() => import("./HotelMapPicker").then(m => m.HotelMapPicker), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[220px] rounded-2xl bg-white/5 flex items-center justify-center">
      <span className="text-sm text-[#c0c6d6]">Cargando mapa...</span>
    </div>
  ),
})

interface SearchResult {
  name: string
  lat: number
  lng: number
  type: string
}

// Top hotel chains / popular options per destination type
const POPULAR_OPTIONS = [
  { emoji: "🏨", label: "Hotel céntrico" },
  { emoji: "🏡", label: "Airbnb / Apartamento" },
  { emoji: "🏫", label: "Hostal / Hostel" },
  { emoji: "⭐", label: "Hotel boutique" },
  { emoji: "🏖️", label: "Resort / Todo incluido" },
]

export function AccommodationStep() {
  const { data, setField } = useOnboardingStore()
  const [showMap, setShowMap] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasPinned = !!(data.accommodationLat && data.accommodationLng)

  // Search for hotel/place suggestions
  const handleInputChange = useCallback((value: string) => {
    setField("accommodationZone", value)
    setField("accommodationLat", null)
    setField("accommodationLng", null)
    setShowMap(false)

    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (value.trim().length < 3) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const dest = data.destination ? `&destination=${encodeURIComponent(data.destination)}` : ""
        const res = await fetch(`/api/hotel-search?q=${encodeURIComponent(value)}${dest}`)
        const json = await res.json()
        const results: SearchResult[] = json.results ?? []
        setSearchResults(results)
        setShowDropdown(results.length > 0)
      } catch {
        setSearchResults([])
      }
      setSearching(false)
    }, 400)
  }, [data.destination, setField])

  const handleSelectResult = (result: SearchResult) => {
    const shortName = result.name.split(",").slice(0, 2).join(",").trim()
    setField("accommodationZone", shortName)
    setField("accommodationLat", result.lat)
    setField("accommodationLng", result.lng)
    setResolvedAddress(result.name)
    setSearchResults([])
    setShowDropdown(false)
    setShowMap(true)
  }

  const handleSelectPopular = (label: string) => {
    const fullQuery = data.destination ? `${label} ${data.destination}` : label
    setField("accommodationZone", fullQuery)
    handleInputChange(fullQuery)
    inputRef.current?.focus()
  }

  const handleMapPin = (lat: number, lng: number, address?: string) => {
    setField("accommodationLat", lat)
    setField("accommodationLng", lng)
    if (address) setResolvedAddress(address)
  }

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-hotel-search]")) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [])

  return (
    <div>
      <StepHeader
        title="¿Dónde te alojas?"
        subtitle="Optimizamos rutas desde tu alojamiento"
        emoji="🏨"
      />

      {/* Popular quick-select chips */}
      {!data.accommodationZone && (
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-2.5">
            Tipo de alojamiento
          </p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => handleSelectPopular(opt.label)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all hover:border-white/20"
                style={{
                  background: "rgba(31,31,33,0.9)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#c0c6d6",
                }}
              >
                <span>{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search input */}
      <div className="relative" data-hotel-search>
        <div className="glass-pill px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#0A84FF] text-xl">hotel</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Nombre del hotel, barrio o dirección..."
            value={data.accommodationZone}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true) }}
            className="flex-1 bg-transparent text-[#e4e2e4] placeholder:text-[#c0c6d6]/50 text-sm outline-none"
          />
          {searching && (
            <span className="material-symbols-outlined text-[#c0c6d6] text-lg animate-spin">progress_activity</span>
          )}
          {hasPinned && (
            <span className="material-symbols-outlined text-[#30D158] text-lg">check_circle</span>
          )}
          {data.accommodationZone && (
            <button
              type="button"
              onClick={() => {
                setField("accommodationZone", "")
                setField("accommodationLat", null)
                setField("accommodationLng", null)
                setShowMap(false)
                setSearchResults([])
                setResolvedAddress(null)
              }}
              className="text-[#888] hover:text-white"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div
            className="absolute z-20 left-0 right-0 top-full mt-1 rounded-xl overflow-hidden max-h-[240px] overflow-y-auto"
            style={{
              background: "rgba(30,30,34,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}
          >
            {searchResults.map((result, i) => {
              const parts = result.name.split(",")
              const primary = parts.slice(0, 2).join(",").trim()
              const secondary = parts.slice(2).join(",").trim()
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectResult(result)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                  style={{ borderBottom: i < searchResults.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                >
                  <span className="material-symbols-outlined text-[#0A84FF] text-[20px] mt-0.5 shrink-0">location_on</span>
                  <div className="min-w-0">
                    <p className="text-[13px] text-[#e4e2e4] truncate">{primary}</p>
                    {secondary && <p className="text-[11px] text-[#888] truncate">{secondary}</p>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Map */}
      {showMap && (
        <div className="mt-3 rounded-2xl overflow-hidden" style={{ height: 220 }}>
          <HotelMapPicker
            destination={data.destination}
            initialQuery={data.accommodationZone}
            pinLat={data.accommodationLat ?? undefined}
            pinLng={data.accommodationLng ?? undefined}
            onPin={handleMapPin}
          />
        </div>
      )}

      {/* Toggle map button when hotel is typed but no map shown */}
      {!showMap && data.accommodationZone.trim().length > 0 && hasPinned && (
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
          style={{
            background: "rgba(48,209,88,0.1)",
            border: "1px solid rgba(48,209,88,0.3)",
            color: "#30D158",
          }}
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          Ubicación confirmada — ver en mapa
        </button>
      )}

      {/* Resolved address confirmation */}
      {hasPinned && resolvedAddress && (
        <div
          className="mt-3 px-4 py-3 rounded-xl flex items-start gap-3"
          style={{
            background: "rgba(48,209,88,0.08)",
            border: "1px solid rgba(48,209,88,0.2)",
          }}
        >
          <span className="material-symbols-outlined text-[#30D158] text-[20px] mt-0.5 shrink-0">pin_drop</span>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-[#30D158] font-medium mb-1">Ubicación seleccionada</p>
            <p className="text-[13px] text-[#e4e2e4] leading-relaxed">{resolvedAddress}</p>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-[#c0c6d6]/60 text-center">
        {hasPinned
          ? "📍 Ubicación guardada — las rutas saldrán desde aquí"
          : "Puedes dejarlo en blanco y añadirlo más tarde"}
      </p>
    </div>
  )
}
