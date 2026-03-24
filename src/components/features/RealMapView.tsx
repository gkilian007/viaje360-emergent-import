"use client"

import { useEffect, useMemo, useRef } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface GeocodedActivity {
  activity: {
    id: string
    name: string
    type: string
    location: string
    time: string
    duration: number
    cost: number
    notes?: string
    description?: string
  }
  lat: number
  lng: number
}

interface RealMapViewProps {
  geocoded: GeocodedActivity[]
  center: { lat: number; lng: number } | null
  loading: boolean
  selectedActivityId?: string | null
  onMarkerClick?: (activityId: string) => void
}

// Type → emoji mapping
const TYPE_EMOJI: Record<string, string> = {
  museum: "🏛️",
  restaurant: "🍴",
  monument: "🏰",
  park: "🌳",
  shopping: "🛍️",
  tour: "🚶",
  hotel: "🏨",
  transport: "🚇",
  nightlife: "🌙",
  beach: "🏖️",
  entertainment: "🎭",
  cafe: "☕",
}

// Type → readable label
const TYPE_LABEL: Record<string, string> = {
  museum: "Museo",
  restaurant: "Restaurante",
  monument: "Monumento",
  park: "Parque",
  shopping: "Compras",
  tour: "Tour",
  hotel: "Hotel",
  transport: "Transporte",
  nightlife: "Nocturno",
  beach: "Playa",
  entertainment: "Entretenimiento",
  cafe: "Café",
}

// Create marker icon with emoji by type + number badge
function createActivityIcon(
  index: number,
  type: string,
  isSelected: boolean,
  isFirst: boolean,
  isLast: boolean
) {
  const color = isSelected
    ? "#0A84FF"
    : isFirst
    ? "#30D158"
    : isLast
    ? "#FF453A"
    : "#5856D6"

  const emoji = TYPE_EMOJI[type] ?? "📍"
  const size = isSelected ? 44 : 36
  const emojiSize = isSelected ? 20 : 16
  const badgeSize = 16
  const dimmed = !isSelected && false // placeholder for future dim logic

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${color}18;
        border: 2.5px solid ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${emojiSize}px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5)${isSelected ? `, 0 0 20px ${color}60` : ""};
        transition: all 0.3s cubic-bezier(.4,0,.2,1);
        opacity: ${dimmed ? 0.5 : 1};
        ${isSelected ? `animation: marker-pulse 1.5s ease-in-out infinite;` : ""}
      ">
        ${emoji}
        <div style="
          position: absolute;
          top: -4px;
          right: -4px;
          width: ${badgeSize}px;
          height: ${badgeSize}px;
          border-radius: 50%;
          background: ${color};
          border: 1.5px solid #131315;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 800;
          color: white;
          line-height: 1;
        ">${index + 1}</div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 6],
  })
}

// Inject keyframes for pulse animation (once)
const STYLE_ID = "viaje360-map-styles"
function injectMapStyles() {
  if (typeof document === "undefined") return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    @keyframes marker-pulse {
      0%, 100% { box-shadow: 0 2px 10px rgba(0,0,0,0.5), 0 0 20px rgba(10,132,255,0.35); }
      50% { box-shadow: 0 2px 14px rgba(0,0,0,0.5), 0 0 32px rgba(10,132,255,0.55); }
    }
    .leaflet-popup-content-wrapper {
      background: #1c1c1e !important;
      color: #e5e7eb !important;
      border-radius: 14px !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
      backdrop-filter: blur(16px);
      padding: 0 !important;
    }
    .leaflet-popup-tip {
      background: #1c1c1e !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      box-shadow: none !important;
    }
    .leaflet-popup-close-button {
      color: #888 !important;
      font-size: 18px !important;
      top: 6px !important;
      right: 8px !important;
    }
    .leaflet-popup-close-button:hover {
      color: #fff !important;
    }
    .leaflet-popup-content {
      margin: 0 !important;
    }
    .custom-marker > div {
      cursor: pointer;
    }
  `
  document.head.appendChild(style)
}

// Auto-fit map bounds when markers change
function FitBounds({ geocoded }: { geocoded: GeocodedActivity[] }) {
  const map = useMap()

  useEffect(() => {
    if (geocoded.length === 0) return

    const bounds = L.latLngBounds(geocoded.map((g) => [g.lat, g.lng]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [geocoded, map])

  return null
}

// Fly to selected marker
function FlyToSelected({
  geocoded,
  selectedActivityId,
}: {
  geocoded: GeocodedActivity[]
  selectedActivityId?: string | null
}) {
  const map = useMap()

  useEffect(() => {
    if (!selectedActivityId) return

    const target = geocoded.find((g) => g.activity.id === selectedActivityId)
    if (target) {
      map.flyTo([target.lat, target.lng], 16, { duration: 0.8 })
    }
  }, [selectedActivityId, geocoded, map])

  return null
}

export function RealMapView({
  geocoded,
  center,
  loading,
  selectedActivityId,
  onMarkerClick,
}: RealMapViewProps) {
  const defaultCenter = center ?? { lat: 40.4168, lng: -3.7038 } // Madrid fallback

  // Inject dark-popup & pulse styles once
  useEffect(() => injectMapStyles(), [])

  // Route polyline
  const routePositions = useMemo(
    () => geocoded.map((g) => [g.lat, g.lng] as [number, number]),
    [geocoded]
  )

  if (geocoded.length === 0 && !loading) {
    // Still render map with default center, just no markers yet
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[defaultCenter.lat, defaultCenter.lng]}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: "#0f1117" }}
      >
        {/* Dark theme tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />

        {/* Auto-fit bounds */}
        <FitBounds geocoded={geocoded} />

        {/* Fly to selected */}
        <FlyToSelected geocoded={geocoded} selectedActivityId={selectedActivityId} />

        {/* Route line connecting activities in order */}
        {routePositions.length > 1 && (
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: "#5856D6",
              weight: 3,
              opacity: 0.6,
              dashArray: "8, 8",
            }}
          />
        )}

        {/* Activity markers */}
        {geocoded.map((geo, index) => {
          const isSelected = geo.activity.id === selectedActivityId
          const isFirst = index === 0
          const isLast = index === geocoded.length - 1
          const emoji = TYPE_EMOJI[geo.activity.type] ?? "📍"
          const typeLabel = TYPE_LABEL[geo.activity.type] ?? geo.activity.type

          const accentColor = isSelected
            ? "#0A84FF"
            : isFirst
            ? "#30D158"
            : isLast
            ? "#FF453A"
            : "#5856D6"

          return (
            <Marker
              key={geo.activity.id}
              position={[geo.lat, geo.lng]}
              icon={createActivityIcon(index, geo.activity.type, isSelected, isFirst, isLast)}
              eventHandlers={{
                click: () => onMarkerClick?.(geo.activity.id),
              }}
            >
              <Popup>
                <div style={{ minWidth: 200, padding: "12px 14px" }}>
                  {/* Header: badge + name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{
                      padding: "3px 8px",
                      borderRadius: 8,
                      background: `${accentColor}20`,
                      border: `1px solid ${accentColor}40`,
                      fontSize: 11,
                      fontWeight: 600,
                      color: accentColor,
                      whiteSpace: "nowrap",
                    }}>
                      {emoji} {typeLabel}
                    </div>
                    <span style={{
                      fontSize: 10,
                      color: "#888",
                      fontWeight: 600,
                    }}>#{index + 1}</span>
                  </div>

                  {/* Name */}
                  <div style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#f0f0f0",
                    marginBottom: 6,
                    lineHeight: 1.3,
                  }}>
                    {geo.activity.name}
                  </div>

                  {/* Details row */}
                  <div style={{
                    display: "flex",
                    gap: 10,
                    fontSize: 11,
                    color: "#9ca3af",
                    marginBottom: geo.activity.cost > 0 ? 4 : 0,
                  }}>
                    <span>🕐 {geo.activity.time}</span>
                    <span>⏱ {geo.activity.duration}min</span>
                  </div>

                  {/* Cost */}
                  {geo.activity.cost > 0 && (
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      💰 €{geo.activity.cost}
                    </div>
                  )}

                  {/* Location */}
                  <div style={{
                    fontSize: 10,
                    color: "#6b7280",
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    lineHeight: 1.4,
                  }}>
                    📍 {geo.activity.location}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute top-4 left-4 px-3 py-2 rounded-xl flex items-center gap-2 z-[1000]"
          style={{ background: "rgba(19,19,21,0.9)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="w-3 h-3 rounded-full bg-[#0A84FF] animate-pulse" />
          <span className="text-[11px] text-[#c0c6d6]">
            Geocodificando... ({geocoded.length} de ?)
          </span>
        </div>
      )}

      {/* Legend */}
      <div
        className="absolute left-4 bottom-4 px-3 py-2 rounded-xl flex items-center gap-3 z-[1000]"
        style={{
          background: "rgba(19,19,21,0.85)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#30D158]" />
          <span className="text-[11px] text-[#c0c6d6]">Inicio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#5856D6]" />
          <span className="text-[11px] text-[#c0c6d6]">Ruta</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF453A]" />
          <span className="text-[11px] text-[#c0c6d6]">Final</span>
        </div>
      </div>
    </div>
  )
}
