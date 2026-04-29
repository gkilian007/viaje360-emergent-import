"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "react-leaflet-cluster/dist/assets/MarkerCluster.css"
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css"
import { useRouteGeometry } from "@/lib/hooks/useRouteGeometry"

// Dynamic import for MarkerClusterGroup (ESM-only package)
import dynamic from "next/dynamic"
const MarkerClusterGroup = dynamic(
  () => import("react-leaflet-cluster").then(m => ({ default: m.default })),
  { ssr: false }
)

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

interface RouteHighlight {
  from: { lat: number; lng: number; name: string }
  to: { lat: number; lng: number; name: string }
  mode: "walking" | "transit" | "driving" | "bicycling"
}

interface RealMapViewProps {
  geocoded: GeocodedActivity[]
  center: { lat: number; lng: number } | null
  loading: boolean
  selectedActivityId?: string | null
  onMarkerClick?: (activityId: string) => void
  /** User transport preferences from onboarding (e.g. ["pie", "publico"]) */
  transportPrefs?: string[]
  /** Max comfortable walking distance in meters (from mobility profile) */
  maxWalkMeters?: number
  /** City/destination name for transit route lookups */
  destination?: string
  /** Highlighted route to show on the map */
  routeHighlight?: RouteHighlight | null
  /** Callback to clear the highlighted route */
  onClearRouteHighlight?: () => void
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

// Type → color mapping
const TYPE_COLOR: Record<string, string> = {
  restaurant: "#FF9F0A",  // naranja
  museum: "#5856D6",      // morado
  monument: "#0A84FF",    // azul
  park: "#30D158",        // verde
  shopping: "#FF375F",    // rosa
  tour: "#BF5AF2",        // púrpura
  hotel: "#64748B",       // gris
  transport: "#32ADE6",   // azul claro
  nightlife: "#FFD60A",   // amarillo
  beach: "#FF6B6B",       // coral
  entertainment: "#FF2D55", // rojo rosa
  cafe: "#A2845E",        // marrón
}

// Detect iOS for navigation URL
function getDirectionsUrl(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const isIOS =
    typeof navigator !== "undefined" &&
    (navigator.userAgent.includes("iPhone") || navigator.userAgent.includes("iPad"))
  if (isIOS) {
    return `maps://maps.apple.com/?saddr=${fromLat},${fromLng}&daddr=${toLat},${toLng}`
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=walking`
}

// Create marker icon with emoji by type + number badge
function createActivityIcon(
  index: number,
  type: string,
  isSelected: boolean,
  isFirst: boolean,
  isLast: boolean
) {
  const typeColor = TYPE_COLOR[type] ?? "#5856D6"
  const color = isSelected ? "#0A84FF" : typeColor

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
    /* Cluster styles — dark theme */
    .marker-cluster-small,
    .marker-cluster-medium,
    .marker-cluster-large {
      background-color: rgba(10, 132, 255, 0.18) !important;
    }
    .marker-cluster-small div,
    .marker-cluster-medium div,
    .marker-cluster-large div {
      background-color: rgba(10, 132, 255, 0.72) !important;
      color: #fff !important;
      font-weight: 700;
      font-size: 13px;
    }
  `
  document.head.appendChild(style)
}

// User location indicator
function UserLocation() {
  const map = useMap()
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  if (!pos) return null

  return (
    <>
      <Circle center={[pos.lat, pos.lng]} radius={60} pathOptions={{ color: "#0A84FF", fillColor: "#0A84FF", fillOpacity: 0.15, weight: 1 }} />
      <Circle center={[pos.lat, pos.lng]} radius={8} pathOptions={{ color: "#fff", fillColor: "#0A84FF", fillOpacity: 1, weight: 2 }} />
    </>
  )
}

// Decode Google's encoded polyline to [lat, lng][]
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : (result >> 1)
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : (result >> 1)
    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m} min`
}

const MODE_ICON: Record<string, string> = {
  walking: "directions_walk",
  transit: "directions_transit",
  driving: "directions_car",
  bicycling: "directions_bike",
}

const MODE_LABEL: Record<string, string> = {
  walking: "A pie",
  transit: "Transporte público",
  driving: "Coche / Taxi",
  bicycling: "Bicicleta",
}

// Route highlight overlay — shows a chosen route on the map
function RouteHighlightOverlay({
  routeHighlight,
}: {
  routeHighlight: RouteHighlight
}) {
  const map = useMap()
  const [coords, setCoords] = useState<[number, number][]>([])
  const [error, setError] = useState(false)

  const { from, to, mode } = routeHighlight
  const key = `${from.lat},${from.lng}->${to.lat},${to.lng}:${mode}`

  useEffect(() => {
    let cancelled = false
    setCoords([])
    setError(false)

    async function fetchRoute() {
      try {
        if (mode === "transit") {
          const params = new URLSearchParams({
            olat: from.lat.toString(),
            olng: from.lng.toString(),
            dlat: to.lat.toString(),
            dlng: to.lng.toString(),
            oname: from.name,
            dname: to.name,
          })
          const res = await fetch(`/api/transit-route?${params}`)
          if (!res.ok) throw new Error("transit failed")
          const { data } = await res.json()
          if (data?.steps?.length) {
            const allCoords: [number, number][] = []
            for (const step of data.steps) {
              if (step.polyline) allCoords.push(...decodePolyline(step.polyline))
            }
            if (!cancelled) setCoords(allCoords)
            return
          }
          throw new Error("no transit steps")
        } else {
          // OSRM
          const profile = mode === "driving" ? "driving" : mode === "bicycling" ? "driving" : "foot"
          const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
          const res = await fetch(url)
          if (!res.ok) throw new Error("osrm failed")
          const data = await res.json()
          const route = data.routes?.[0]
          if (!route) throw new Error("no route")
          const pts: [number, number][] = (route.geometry?.coordinates ?? []).map(
            (c: [number, number]) => [c[1], c[0]] as [number, number]
          )
          if (!cancelled) setCoords(pts)
        }
      } catch {
        if (!cancelled) {
          // Fallback: straight line
          setCoords([[from.lat, from.lng], [to.lat, to.lng]])
          setError(true)
        }
      }
    }

    fetchRoute()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Fit bounds when coords are ready
  useEffect(() => {
    if (coords.length < 2) return
    const bounds = L.latLngBounds(coords)
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 })
  }, [coords, map])

  const fromIcon = L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;background:#30D158;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
  const toIcon = L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;background:#FF375F;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })

  return (
    <>
      {/* Route polyline */}
      {coords.length >= 2 && (
        <Polyline
          positions={coords}
          pathOptions={{
            color: "#0A84FF",
            weight: 6,
            opacity: 0.9,
            dashArray: error ? "10, 8" : undefined,
          }}
        />
      )}

      {/* Origin marker */}
      <Marker position={[from.lat, from.lng]} icon={fromIcon}>
        <Popup>
          <div style={{ fontSize: 12, fontFamily: "system-ui", color: "#e5e7eb", padding: "4px 6px" }}>
            <span style={{ color: "#30D158", fontWeight: 700 }}>Origen</span><br />{from.name}
          </div>
        </Popup>
      </Marker>

      {/* Destination marker */}
      <Marker position={[to.lat, to.lng]} icon={toIcon}>
        <Popup>
          <div style={{ fontSize: 12, fontFamily: "system-ui", color: "#e5e7eb", padding: "4px 6px" }}>
            <span style={{ color: "#FF375F", fontWeight: 700 }}>Destino</span><br />{to.name}
          </div>
        </Popup>
      </Marker>
    </>
  )
}

// Route highlight info card — shown as a floating bottom card
function RouteHighlightCard({
  routeHighlight,
  onClear,
}: {
  routeHighlight: RouteHighlight
  onClear?: () => void
}) {
  // This component renders outside the MapContainer (as a DOM overlay)
  const [distance, setDistance] = useState<number | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const { from, to, mode } = routeHighlight
  const key = `${from.lat},${from.lng}->${to.lat},${to.lng}:${mode}`

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDistance(null)
    setDuration(null)

    async function fetchInfo() {
      try {
        if (mode === "transit") {
          const params = new URLSearchParams({
            olat: from.lat.toString(),
            olng: from.lng.toString(),
            dlat: to.lat.toString(),
            dlng: to.lng.toString(),
            oname: from.name,
            dname: to.name,
          })
          const res = await fetch(`/api/transit-route?${params}`)
          if (res.ok) {
            const { data } = await res.json()
            let totalDist = 0, totalDur = 0
            for (const step of data?.steps ?? []) {
              if (step.distanceMeters) totalDist += step.distanceMeters
              if (step.durationSeconds) totalDur += step.durationSeconds
            }
            if (!cancelled) { setDistance(totalDist || null); setDuration(totalDur || null) }
          }
        } else {
          const profile = mode === "driving" ? "driving" : mode === "bicycling" ? "driving" : "foot"
          const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
          const res = await fetch(url)
          if (res.ok) {
            const data = await res.json()
            const route = data.routes?.[0]
            if (!cancelled && route) { setDistance(route.distance ?? null); setDuration(route.duration ?? null) }
          }
        }
      } catch {}
      if (!cancelled) setLoading(false)
    }

    fetchInfo()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const modeColor = mode === "walking" ? "#30D158" : mode === "transit" ? "#0A84FF" : mode === "driving" ? "#FF9F0A" : "#BF5AF2"

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 12,
        right: 12,
        zIndex: 1000,
        background: "rgba(19,19,21,0.95)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 18,
        padding: "12px 16px",
        backdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      {/* Mode icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: `${modeColor}18`,
        border: `1.5px solid ${modeColor}40`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 22, color: modeColor }}>
          {MODE_ICON[mode] ?? "directions"}
        </span>
      </div>

      {/* Route info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#e4e2e4", marginBottom: 2 }}>
          {MODE_LABEL[mode] ?? mode}
        </div>
        <div style={{ fontSize: 11, color: "#c0c6d6" }}>
          {loading ? (
            <span style={{ color: "#888" }}>Calculando...</span>
          ) : (
            <>
              {distance != null && <span>{formatDistance(distance)}</span>}
              {distance != null && duration != null && <span style={{ margin: "0 6px", color: "#444" }}>·</span>}
              {duration != null && <span>{formatDuration(duration)}</span>}
              {distance == null && duration == null && <span style={{ color: "#888" }}>Ruta aproximada</span>}
            </>
          )}
        </div>
        <div style={{ fontSize: 10, color: "#666", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {from.name.slice(0, 20)}{from.name.length > 20 ? "…" : ""} → {to.name.slice(0, 20)}{to.name.length > 20 ? "…" : ""}
        </div>
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={onClear}
        style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 10,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
          color: "#888", display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
        aria-label="Cerrar ruta"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
      </button>
    </div>
  )
}


function getDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadius = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function getBearingDegrees(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function formatHudDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

function MobileGtaNavigationHud({ geocoded, selectedActivityId }: { geocoded: GeocodedActivity[]; selectedActivityId?: string | null }) {
  const valid = geocoded.filter(g => isFinite(g.lat) && isFinite(g.lng))
  if (valid.length < 2) return null

  const selectedIndex = selectedActivityId ? valid.findIndex(g => g.activity.id === selectedActivityId) : -1
  const currentIndex = Math.max(0, selectedIndex >= 0 ? selectedIndex : 0)
  const from = valid[currentIndex] ?? valid[0]
  const to = valid[currentIndex + 1] ?? valid[currentIndex]
  if (!from || !to || from.activity.id === to.activity.id) return null

  const distance = getDistanceMeters(from, to)
  const bearing = getBearingDegrees(from, to)
  const visiblePoints = valid.slice(Math.max(0, currentIndex - 1), Math.min(valid.length, currentIndex + 5))
  const spanLat = Math.max(0.0012, Math.max(...visiblePoints.map(g => g.lat)) - Math.min(...visiblePoints.map(g => g.lat)))
  const spanLng = Math.max(0.0012, Math.max(...visiblePoints.map(g => g.lng)) - Math.min(...visiblePoints.map(g => g.lng)))
  const minLat = Math.min(...visiblePoints.map(g => g.lat))
  const minLng = Math.min(...visiblePoints.map(g => g.lng))

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1100] md:hidden">
      <div className="absolute left-3 bottom-3 h-[122px] w-[122px] overflow-hidden rounded-full border border-white/18 bg-[#05070d]/88 shadow-[0_20px_60px_rgba(0,0,0,0.62)] backdrop-blur-xl">
        <div className="absolute inset-[10px] rounded-full border border-white/10 bg-[radial-gradient(circle_at_center,rgba(10,132,255,0.20),rgba(4,8,18,0.95)_60%)]" />
        <div className="absolute left-1/2 top-[12px] -translate-x-1/2 text-[9px] font-black tracking-[0.22em] text-white/55">N</div>
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/8" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/8" />
        <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#0A84FF]/55 bg-[#0A84FF]/18 shadow-[0_0_18px_rgba(10,132,255,0.65)]">
          <div className="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-[58%] border-x-[6px] border-b-[16px] border-x-transparent border-b-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        </div>
        <div className="absolute left-1/2 top-1/2 h-[2px] w-[42px] origin-left bg-[#30D158] shadow-[0_0_12px_rgba(48,209,88,0.85)]" style={{ transform: `rotate(${bearing - 90}deg)` }} />
        {visiblePoints.map((point, index) => {
          const x = 16 + ((point.lng - minLng) / spanLng) * 86
          const y = 102 - ((point.lat - minLat) / spanLat) * 86
          const isCurrent = point.activity.id === from.activity.id
          const isTarget = point.activity.id === to.activity.id
          return (
            <div
              key={point.activity.id}
              className={`absolute flex items-center justify-center rounded-full text-[8px] font-black text-white ${isTarget ? "h-4 w-4 bg-[#30D158]" : isCurrent ? "h-4 w-4 bg-[#0A84FF]" : "h-3 w-3 bg-white/28"}`}
              style={{ left: x, top: y, boxShadow: isTarget ? "0 0 14px rgba(48,209,88,0.8)" : isCurrent ? "0 0 12px rgba(10,132,255,0.8)" : undefined }}
            >
              {isCurrent || isTarget ? index + 1 : ""}
            </div>
          )
        })}
        <div className="absolute inset-0 rounded-full shadow-[inset_0_0_28px_rgba(0,0,0,0.78)]" />
      </div>

      <div className="ml-[138px] mr-3 mb-3 rounded-[26px] border border-white/12 bg-[#090b12]/84 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[9px] font-black uppercase tracking-[0.22em] text-[#30D158]">Modo ruta</span>
          <span className="rounded-full border border-[#30D158]/30 bg-[#30D158]/12 px-2 py-0.5 text-[10px] font-bold text-[#b8ffd0]">{formatHudDistance(distance)}</span>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(17,23,35,0.96),rgba(5,7,12,0.98))] px-3 pb-3 pt-2">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#30D158]/30 bg-[#30D158]/12 text-[12px] text-[#b8ffd0]">➜</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-extrabold text-white">Ir a {to.activity.name}</div>
              <div className="truncate text-[10px] text-white/55">Siguiente parada · {to.activity.time}</div>
            </div>
          </div>

          <div className="relative h-[78px] overflow-hidden rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,24,38,0.92),rgba(8,10,16,0.98))]">
            <div className="absolute inset-x-0 bottom-0 h-10 bg-[linear-gradient(180deg,transparent,rgba(48,209,88,0.20))]" />
            <div className="absolute left-1/2 bottom-3 h-11 w-7 -translate-x-1/2 rounded-full border border-white/20 bg-[#0A84FF] shadow-[0_0_18px_rgba(10,132,255,0.72)]" />
            <div className="absolute left-1/2 bottom-[46px] h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#f2d7c3]" />
            <div className="absolute left-1/2 top-2 h-10 w-[2px] -translate-x-1/2 bg-[#30D158] shadow-[0_0_14px_rgba(48,209,88,0.95)]" />
            <div className="absolute left-1/2 top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-[#30D158] bg-[#30D158]/20 shadow-[0_0_14px_rgba(48,209,88,0.88)]" />
            <div className="absolute bottom-2 left-3 right-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/78">Vista navegación</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Route segments with transport-mode-aware styling
function RealRouteSegments({ geocoded, transportPrefs = [], maxWalkMeters = 1500, destination = "", hasHighlight = false }: { geocoded: GeocodedActivity[]; transportPrefs?: string[]; maxWalkMeters?: number; destination?: string; hasHighlight?: boolean }) {
  // Stabilize reference — only recompute when the set of activity IDs changes
  const geoKey = geocoded.map(g => g.activity.id).join(",")
  const activities = useMemo(
    () => geocoded.filter(g => isFinite(g.lat) && isFinite(g.lng)).map(g => ({ id: g.activity.id, type: g.activity.type, lat: g.lat, lng: g.lng, name: g.activity.name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geoKey]
  )

  const segments = useRouteGeometry(activities, TYPE_COLOR, { transportPrefs, maxWalkMeters, destination })

  if (segments.length === 0) {
    const valid = geocoded.filter(g => isFinite(g.lat) && isFinite(g.lng))
    return (
      <>
        {valid.length >= 2 && valid.map((g, i) => {
          if (i === valid.length - 1) return null
          const next = valid[i + 1]
          return (
            <Polyline
              key={`fallback-${i}`}
              positions={[[g.lat, g.lng], [next.lat, next.lng]]}
              pathOptions={{ color: "#0A84FF", weight: 2.5, opacity: 0.5, dashArray: "6, 8" }}
            />
          )
        })}
      </>
    )
  }

  // Style segments by transport mode:
  // - foot: solid green line
  // - transit: thick colored line (uses actual transit line color from Google)
  // - car: dashed orange line
  return (
    <>
      {segments.map((seg, i) => {
        const isTransit = seg.mode === "transit"
        const isCar = seg.mode === "car"
        return (
          <Polyline
            key={`route-${i}`}
            positions={seg.coordinates}
            pathOptions={{
              color: seg.color,
              weight: isTransit ? 5 : 3.5,
              opacity: hasHighlight ? (isTransit ? 0.35 : 0.25) : (isTransit ? 0.9 : 0.85),
              dashArray: isCar ? "12, 4" : undefined,
            }}
          >
            {isTransit && seg.transitInfo && (
              <Popup>
                <div style={{ minWidth: 160, fontFamily: "system-ui" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ background: seg.transitInfo.color, color: seg.transitInfo.textColor, padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                      {seg.transitInfo.lineShort || seg.transitInfo.lineName}
                    </span>
                    <span style={{ fontSize: 11, color: "#666" }}>{seg.transitInfo.vehicle}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#333" }}>
                    <div>🟢 {seg.transitInfo.departureStop}</div>
                    <div style={{ fontSize: 10, color: "#999", margin: "2px 0 2px 8px" }}>
                      {seg.transitInfo.stopCount} paradas → {seg.transitInfo.headsign}
                    </div>
                    <div>🔴 {seg.transitInfo.arrivalStop}</div>
                  </div>
                </div>
              </Popup>
            )}
          </Polyline>
        )
      })}
    </>
  )
}

// Auto-fit map bounds when markers change
function FitBounds({ geocoded }: { geocoded: GeocodedActivity[] }) {
  const map = useMap()
  const prevIdsRef = useRef("")

  // Single effect: fit whenever the set of activity IDs changes
  const geoIds = geocoded.map(g => g.activity.id).join(",")

  useEffect(() => {
    if (!geoIds) return
    // Same set as before — don't re-fit
    if (geoIds === prevIdsRef.current) return
    prevIdsRef.current = geoIds

    const valid = geocoded.filter(g => isFinite(g.lat) && isFinite(g.lng))
    if (valid.length === 0) return

    const size = map.getSize()
    if (size.x === 0 || size.y === 0) {
      // Map not ready yet — retry after paint
      setTimeout(() => {
        const s = map.getSize()
        if (s.x > 0 && s.y > 0) {
          const bounds = L.latLngBounds(valid.map((g) => [g.lat, g.lng]))
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
        }
      }, 150)
      return
    }

    const bounds = L.latLngBounds(valid.map((g) => [g.lat, g.lng]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoIds, map])

  return null
}

// Invalidate map size and re-fit when activity set changes (day switch)
function DayChangeEffect({ geocoded }: { geocoded: GeocodedActivity[] }) {
  const map = useMap()
  const geoIds = geocoded.map(g => g.activity.id).join(",")
  const prevIdsRef = useRef("")

  useEffect(() => {
    if (!geoIds || geoIds === prevIdsRef.current) return
    prevIdsRef.current = geoIds

    // Let React finish rendering the new markers, then invalidate + fit
    const timer = setTimeout(() => {
      map.invalidateSize()
      const valid = geocoded.filter(g => isFinite(g.lat) && isFinite(g.lng))
      if (valid.length === 0) return
      const bounds = L.latLngBounds(valid.map(g => [g.lat, g.lng]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    }, 100)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoIds, map])

  return null
}

// Center map on destination when no markers
function CenterOnDestination({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap()
  const centeredRef = useRef(false)

  useEffect(() => {
    if (!center || centeredRef.current) return
    if (!isFinite(center.lat) || !isFinite(center.lng)) return

    const size = map.getSize()
    if (size.x === 0 || size.y === 0) return

    centeredRef.current = true
    map.setView([center.lat, center.lng], 13)
  }, [center, map])

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
    if (target && isFinite(target.lat) && isFinite(target.lng)) {
      // Skip flyTo if map container has zero size (hidden in mobile)
      const size = map.getSize()
      if (size.x > 0 && size.y > 0) {
        map.flyTo([target.lat, target.lng], 16, { duration: 0.8 })
      }
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
  transportPrefs,
  maxWalkMeters,
  destination,
  routeHighlight,
  onClearRouteHighlight,
}: RealMapViewProps) {
  const defaultCenter = center ?? { lat: 0, lng: 0 } // will be overridden by FitBounds

  // Inject dark-popup & pulse styles once
  useEffect(() => injectMapStyles(), [])

  if (geocoded.length === 0 && !loading) {
    // Still render map with default center, just no markers yet
  }

  const validGeo = geocoded.filter(g => isFinite(g.lat) && isFinite(g.lng))

  // Offset markers at the same coordinates so both are visible
  const offsetGeo = useMemo(() => {
    const coordMap = new Map<string, number>()
    return validGeo.map((geo) => {
      const key = `${geo.lat.toFixed(5)},${geo.lng.toFixed(5)}`
      const count = coordMap.get(key) ?? 0
      coordMap.set(key, count + 1)
      if (count === 0) return geo
      // Offset ~50m per duplicate in a circle pattern
      const angle = (count * 2 * Math.PI) / 8 // up to 8 positions
      const offsetLat = 0.0005 * Math.cos(angle)
      const offsetLng = 0.0005 * Math.sin(angle)
      return { ...geo, lat: geo.lat + offsetLat, lng: geo.lng + offsetLng }
    })
  }, [validGeo])

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

        {/* Center on destination when no markers */}
        {geocoded.length === 0 && <CenterOnDestination center={center} />}

        {/* Invalidate + re-fit on day change */}
        <DayChangeEffect geocoded={geocoded} />

        {/* Auto-fit bounds */}
        <FitBounds geocoded={geocoded} />

        {/* Fly to selected */}
        <FlyToSelected geocoded={geocoded} selectedActivityId={selectedActivityId} />

        {/* Route segments with gradient colors — dimmed when a highlight is active */}
        <RealRouteSegments geocoded={geocoded} transportPrefs={transportPrefs} maxWalkMeters={maxWalkMeters} destination={destination} hasHighlight={!!routeHighlight} />

        {/* Route highlight overlay */}
        {routeHighlight && (
          <RouteHighlightOverlay routeHighlight={routeHighlight} />
        )}

        {/* User location */}
        <UserLocation />

        {/* Activity markers — wrapped in cluster group */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={1}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          disableClusteringAtZoom={1}
        >
          {offsetGeo.map((geo, index) => {
            const isSelected = geo.activity.id === selectedActivityId
            const isFirst = index === 0
            const isLast = index === offsetGeo.length - 1
            const emoji = TYPE_EMOJI[geo.activity.type] ?? "📍"
            const typeLabel = TYPE_LABEL[geo.activity.type] ?? geo.activity.type

            const accentColor = isSelected
              ? "#0A84FF"
              : TYPE_COLOR[geo.activity.type] ?? "#5856D6"

            // Directions: from this activity to the next one
            const nextGeo = offsetGeo[index + 1]
            const directionsUrl = nextGeo
              ? getDirectionsUrl(geo.lat, geo.lng, nextGeo.lat, nextGeo.lng)
              : getDirectionsUrl(geo.lat, geo.lng, geo.lat, geo.lng) // last activity: self

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

                    {/* Cómo llegar button */}
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        marginTop: 10,
                        padding: "7px 12px",
                        borderRadius: 10,
                        background: `${accentColor}22`,
                        border: `1px solid ${accentColor}55`,
                        color: accentColor,
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                    >
                      🧭 {nextGeo ? `Ir a: ${nextGeo.activity.name.slice(0, 25)}${nextGeo.activity.name.length > 25 ? "…" : ""}` : "Cómo llegar"}
                    </a>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MarkerClusterGroup>
      </MapContainer>

      <MobileGtaNavigationHud geocoded={offsetGeo} selectedActivityId={selectedActivityId} />

      {/* Route highlight info card */}
      {routeHighlight && (
        <RouteHighlightCard routeHighlight={routeHighlight} onClear={onClearRouteHighlight} />
      )}

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

      {/* Route mode legend */}
      {(transportPrefs?.includes("publico") || transportPrefs?.includes("mix") || transportPrefs?.includes("coche")) && (
        <div
          className="absolute right-4 bottom-4 hidden px-3 py-2 rounded-xl md:flex flex-col gap-1.5 z-[1000]"
          style={{
            background: "rgba(19,19,21,0.85)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(12px)",
          }}
        >
          <span className="text-[9px] uppercase tracking-wider text-[#888] font-medium">Rutas</span>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-[3px] rounded-full" style={{ background: "#30D158" }} />
            <span className="text-[10px] text-[#c0c6d6]">A pie</span>
          </div>
          {(transportPrefs?.includes("publico") || transportPrefs?.includes("mix")) && (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-[3px] rounded-full" style={{ background: "#32ADE6", backgroundImage: "repeating-linear-gradient(90deg, #32ADE6 0 5px, transparent 5px 9px)" }} />
              <span className="text-[10px] text-[#c0c6d6]">Transporte público</span>
            </div>
          )}
          {(transportPrefs?.includes("coche") || transportPrefs?.includes("taxi")) && (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-[3px] rounded-full" style={{ background: "#FF9F0A", backgroundImage: "repeating-linear-gradient(90deg, #FF9F0A 0 6px, transparent 6px 9px)" }} />
              <span className="text-[10px] text-[#c0c6d6]">Coche/taxi</span>
            </div>
          )}
        </div>
      )}

      {/* Legend — show unique activity types present */}
      {(() => {
        const uniqueTypes = [...new Set(geocoded.map(g => g.activity.type))]
        return uniqueTypes.length > 0 ? (
          <div
            className="absolute left-4 bottom-4 hidden px-3 py-2 rounded-xl md:flex flex-wrap items-center gap-x-3 gap-y-1.5 z-[1000] max-w-[280px]"
            style={{
              background: "rgba(19,19,21,0.85)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(12px)",
            }}
          >
            {uniqueTypes.map(type => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TYPE_COLOR[type] ?? "#5856D6" }} />
                <span className="text-[10px] text-[#c0c6d6]">{TYPE_LABEL[type] ?? type}</span>
              </div>
            ))}
          </div>
        ) : null
      })()}
    </div>
  )
}
