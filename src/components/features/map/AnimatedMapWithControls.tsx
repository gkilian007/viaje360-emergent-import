"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { DayItinerary, TimelineActivity } from "@/lib/types"
import { ACTIVITY_ICONS } from "@/lib/constants"
import {
  type ActivityWithCoords,
  type AvatarPosition,
  getActivityCoordinates,
  getActivityColor,
  getCityCenter,
} from "./types"
import { useRouteAnimation } from "./useRouteAnimation"
import { createAvatarMarkerElement, updateAvatarMarker } from "./TravelerAvatar"
import {
  type TransportMode,
  type RouteSummary,
  type DirectionStep,
  TRANSPORT_MODES,
  fetchDirections,
  formatDuration,
  formatDistance,
  estimateTime,
  getManeuverIcon,
} from "./directions"

interface AnimatedMapWithControlsProps {
  itinerary: DayItinerary[]
  selectedDay: number
  onActivityClick?: (activity: TimelineActivity, index: number) => void
  accessToken: string
  showList: boolean
  onToggleList: () => void
  destination?: string // City name for coordinate fallback
}

// Direction step component
function DirectionStepItem({ step, isLast }: { step: DirectionStep; isLast: boolean }) {
  const icon = getManeuverIcon(step.maneuver)
  
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-white/5">
        <span className="material-symbols-outlined text-[14px] text-[#c0c6d6]">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[#e4e2e4] leading-relaxed">{step.instruction}</p>
        {!isLast && step.distance > 0 && (
          <p className="text-[10px] text-[#c0c6d6]/70 mt-0.5">
            {formatDistance(step.distance)} · {formatDuration(step.duration)}
          </p>
        )}
      </div>
    </div>
  )
}

// Expandable directions panel
function DirectionsPanel({
  steps,
  isExpanded,
  onToggle,
  modeColor,
}: {
  steps: DirectionStep[]
  isExpanded: boolean
  onToggle: () => void
  modeColor: string
}) {
  // Filter out very short steps and limit display
  const significantSteps = steps.filter((s) => s.distance > 20 || s.maneuver.type === "arrive")
  const displaySteps = significantSteps.slice(0, isExpanded ? undefined : 3)
  const hasMore = significantSteps.length > 3

  if (steps.length === 0) return null

  return (
    <div className="mt-2 pt-2 border-t border-white/5">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left mb-2"
      >
        <span className="material-symbols-outlined text-[14px]" style={{ color: modeColor }}>
          directions
        </span>
        <span className="text-[11px] font-medium" style={{ color: modeColor }}>
          Indicaciones ({significantSteps.length} pasos)
        </span>
        <span
          className="material-symbols-outlined text-[14px] ml-auto transition-transform"
          style={{ color: modeColor, transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}
        >
          expand_more
        </span>
      </button>
      
      <AnimatePresence>
        {(isExpanded || displaySteps.length <= 3) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 pl-1">
              {displaySteps.map((step, i) => (
                <DirectionStepItem
                  key={i}
                  step={step}
                  isLast={i === displaySteps.length - 1}
                />
              ))}
              {!isExpanded && hasMore && (
                <p className="text-[10px] text-[#c0c6d6]/50 py-1 pl-8">
                  +{significantSteps.length - 3} pasos más...
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AnimatedMapWithControls({
  itinerary,
  selectedDay,
  onActivityClick,
  accessToken,
  showList,
  onToggleList,
  destination,
}: AnimatedMapWithControlsProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const avatarMarkerRef = useRef<any>(null)
  const avatarElementRef = useRef<HTMLDivElement | null>(null)
  
  const [isLoaded, setIsLoaded] = useState(false)
  const [mapboxgl, setMapboxgl] = useState<any>(null)
  const [selectedActivity, setSelectedActivity] = useState<TimelineActivity | null>(null)
  const [transportMode, setTransportMode] = useState<TransportMode>("walking")
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  const [expandedDirections, setExpandedDirections] = useState<number | null>(null)

  const dayData = itinerary[selectedDay - 1]
  const rawActivities = dayData?.activities ?? []
  
  // Enrich activities with coordinates based on destination
  const activities: ActivityWithCoords[] = rawActivities.map((activity) => ({
    ...activity,
    coordinates: getActivityCoordinates(activity, destination),
  }))
  
  // Get default center for map initialization
  const defaultCenter = getCityCenter(destination)

  // Handle position updates
  const handlePositionChange = useCallback((position: AvatarPosition) => {
    if (!avatarMarkerRef.current || !avatarElementRef.current || !map.current) return
    
    avatarMarkerRef.current.setLngLat([position.coordinate.lng, position.coordinate.lat])
    updateAvatarMarker(avatarElementRef.current, !position.isAtStop, position.bearing)
    
    if (!position.isAtStop && map.current) {
      map.current.easeTo({
        center: [position.coordinate.lng, position.coordinate.lat],
        duration: 300,
      })
    }
  }, [])

  // Handle activity reached
  const handleActivityReached = useCallback((index: number) => {
    markersRef.current.forEach((marker, i) => {
      const el = marker.getElement()
      if (el) {
        el.style.transform = i === index ? "scale(1.2)" : "scale(1)"
        el.style.zIndex = i === index ? "10" : "1"
      }
    })
  }, [])

  // Animation hook
  const animation = useRouteAnimation({
    activities,
    config: { speed: 0.00012, pauseAtStops: 1200 },
    onPositionChange: handlePositionChange,
    onActivityReached: handleActivityReached,
  })

  // Load Mapbox
  useEffect(() => {
    let mounted = true
    import("mapbox-gl").then((mod) => {
      if (mounted) {
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.css"
        document.head.appendChild(link)
        setMapboxgl(mod.default)
      }
    })
    return () => { mounted = false }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxgl || map.current) return

    mapboxgl.accessToken = accessToken

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: activities.length > 0 
        ? [activities[0].coordinates.lng, activities[0].coordinates.lat]
        : [defaultCenter.lng, defaultCenter.lat],
      zoom: 14,
      pitch: 50,
      bearing: -17.6,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right")
    map.current.on("load", () => setIsLoaded(true))

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [accessToken, mapboxgl])

  // Fetch real directions when mode or activities change
  useEffect(() => {
    if (!isLoaded || activities.length < 2) {
      setRouteSummary(null)
      return
    }

    const fetchRoute = async () => {
      setIsLoadingRoute(true)
      const coords = activities.map((a) => a.coordinates)
      const result = await fetchDirections(coords, transportMode, accessToken)
      
      if (result) {
        setRouteSummary(result)
      } else {
        // Fallback: estimate times
        const segments = []
        let totalDistance = 0
        let totalDuration = 0
        
        for (let i = 0; i < coords.length - 1; i++) {
          const est = estimateTime(coords[i], coords[i + 1], transportMode)
          segments.push({
            from: coords[i],
            to: coords[i + 1],
            mode: transportMode,
            distance: est.distance,
            duration: est.duration,
            geometry: [[coords[i].lng, coords[i].lat], [coords[i + 1].lng, coords[i + 1].lat]] as [number, number][],
            steps: est.steps,
          })
          totalDistance += est.distance
          totalDuration += est.duration
        }
        
        setRouteSummary({ totalDistance, totalDuration, segments })
      }
      
      setIsLoadingRoute(false)
    }

    fetchRoute()
  }, [isLoaded, activities, transportMode, accessToken])

  // Update map elements
  useEffect(() => {
    if (!map.current || !isLoaded || !mapboxgl) return

    // Clear markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    if (avatarMarkerRef.current) {
      avatarMarkerRef.current.remove()
      avatarMarkerRef.current = null
    }

    // Clear layers
    ["route", "route-glow"].forEach((id) => {
      if (map.current.getLayer(id)) map.current.removeLayer(id)
    })
    if (map.current.getSource("route")) map.current.removeSource("route")

    if (activities.length === 0) return

    // Build route coordinates (use real directions if available)
    let routeCoordinates: [number, number][]
    
    if (routeSummary && routeSummary.segments.length > 0) {
      routeCoordinates = routeSummary.segments.flatMap((seg) => seg.geometry)
    } else {
      routeCoordinates = activities.map((a) => [a.coordinates.lng, a.coordinates.lat])
    }

    // Route
    if (routeCoordinates.length >= 2) {
      map.current.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeCoordinates } },
      })

      const modeColor = TRANSPORT_MODES.find((m) => m.id === transportMode)?.color || "#0A84FF"

      map.current.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        paint: { "line-color": modeColor, "line-width": 12, "line-opacity": 0.2, "line-blur": 4 },
      })

      map.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        paint: { "line-color": modeColor, "line-width": 4 },
      })
    }

    // Markers
    activities.forEach((activity, i) => {
      const el = createMarker(activity, i)
      const popup = new mapboxgl.Popup({ offset: 30, closeButton: false }).setHTML(createPopup(activity, i, routeSummary))
      const marker = new mapboxgl.Marker(el)
        .setLngLat([activity.coordinates.lng, activity.coordinates.lat])
        .setPopup(popup)
        .addTo(map.current!)
      el.onclick = () => {
        setSelectedActivity(activity)
        onActivityClick?.(activity, i)
      }
      markersRef.current.push(marker)
    })

    // Avatar
    avatarElementRef.current = createAvatarMarkerElement(false)
    avatarMarkerRef.current = new mapboxgl.Marker({ element: avatarElementRef.current, anchor: "center" })
      .setLngLat([activities[0].coordinates.lng, activities[0].coordinates.lat])
      .addTo(map.current!)

    // Fit bounds
    const allCoords = routeCoordinates.length > 0 ? routeCoordinates : activities.map((a) => [a.coordinates.lng, a.coordinates.lat])
    const bounds = new mapboxgl.LngLatBounds()
    allCoords.forEach((c) => bounds.extend(c as [number, number]))
    map.current.fitBounds(bounds, { padding: { top: 120, bottom: 220, left: 60, right: 60 }, maxZoom: 15, duration: 1000 })
  }, [activities, isLoaded, mapboxgl, onActivityClick, routeSummary, transportMode])

  const canAnimate = activities.length >= 2
  const modeColor = TRANSPORT_MODES.find((m) => m.id === transportMode)?.color || "#0A84FF"

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f1117]">
          <div className="w-8 h-8 border-2 border-[#0A84FF] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Transport mode selector */}
      <div className="absolute top-28 left-4 z-20">
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: "rgba(19,19,21,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {TRANSPORT_MODES.map((mode) => (
            <motion.button
              key={mode.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTransportMode(mode.id)}
              className="px-3 py-2 rounded-lg flex items-center gap-2 transition-all"
              style={{
                background: transportMode === mode.id ? `${mode.color}20` : "transparent",
                border: `1px solid ${transportMode === mode.id ? mode.color : "transparent"}`,
              }}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ color: transportMode === mode.id ? mode.color : "#c0c6d6" }}
              >
                {mode.icon}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Route summary card */}
      {routeSummary && !isLoadingRoute && (
        <div
          className="absolute top-28 right-4 p-3 rounded-xl z-20"
          style={{ background: "rgba(19,19,21,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <span className="material-symbols-outlined text-[20px]" style={{ color: modeColor }}>
                {TRANSPORT_MODES.find(m => m.id === transportMode)?.icon}
              </span>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white">{formatDuration(routeSummary.totalDuration)}</p>
              <p className="text-[11px] text-[#c0c6d6]">{formatDistance(routeSummary.totalDistance)}</p>
            </div>
          </div>
        </div>
      )}

      {isLoadingRoute && (
        <div
          className="absolute top-28 right-4 p-3 rounded-xl z-20"
          style={{ background: "rgba(19,19,21,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="w-5 h-5 border-2 border-[#0A84FF] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Controls overlay */}
      <div className="absolute bottom-20 left-4 right-4 z-20">
        {!canAnimate ? (
          <div className="p-4 rounded-2xl text-center" style={{ background: "rgba(19,19,21,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <span className="material-symbols-outlined text-[24px] text-[#FF9F0A]">info</span>
            <p className="text-[13px] text-[#c0c6d6] mt-1">Añade al menos 2 actividades para animar</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "rgba(19,19,21,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={animation.reset}
              disabled={animation.state === "idle"}
              className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <span className="material-symbols-outlined text-[20px] text-white">replay</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={animation.state === "playing" ? animation.pause : animation.play}
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: animation.state === "finished" 
                  ? "linear-gradient(135deg, #30D158, #00C853)"
                  : `linear-gradient(135deg, ${modeColor}, #5856D6)`,
                boxShadow: `0 4px 20px ${modeColor}40`,
              }}
            >
              <span className="material-symbols-outlined text-[28px] text-white">
                {animation.state === "playing" ? "pause" : animation.state === "finished" ? "replay" : "play_arrow"}
              </span>
            </motion.button>

            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden min-w-[80px]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${modeColor}, #5856D6)` }}
                animate={{ width: `${animation.progress * 100}%` }}
              />
            </div>

            <span className="text-[12px] text-[#c0c6d6] font-medium min-w-[40px] text-right">
              {Math.round(animation.progress * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Stats badge */}
      <div className="absolute bottom-36 right-4 p-3 rounded-xl z-10" style={{ background: "rgba(19,19,21,0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]" style={{ color: modeColor }}>
            {TRANSPORT_MODES.find(m => m.id === transportMode)?.icon}
          </span>
          <span className="text-[13px] font-semibold text-white">{activities.length}</span>
          <span className="text-[11px] text-[#c0c6d6]">paradas</span>
        </div>
      </div>

      {/* Activity list with directions */}
      <AnimatePresence>
        {showList && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="absolute bottom-40 left-4 right-4 max-h-[45vh] rounded-2xl overflow-hidden z-10"
            style={{ background: "rgba(19,19,21,0.98)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <p className="text-[14px] font-semibold text-white">Día {selectedDay} · {activities.length} paradas</p>
              {routeSummary && (
                <div className="flex items-center gap-2 px-2 py-1 rounded-full" style={{ background: `${modeColor}15` }}>
                  <span className="material-symbols-outlined text-[12px]" style={{ color: modeColor }}>schedule</span>
                  <span className="text-[11px] font-medium" style={{ color: modeColor }}>{formatDuration(routeSummary.totalDuration)}</span>
                </div>
              )}
            </div>
            <div className="p-3 space-y-2 overflow-y-auto max-h-[calc(45vh-50px)]">
              {activities.map((activity, i) => {
                const segmentInfo = routeSummary?.segments[i - 1]
                const isCurrentlyExpanded = expandedDirections === i
                
                return (
                  <div key={activity.id}>
                    {/* Segment info with directions between activities */}
                    {i > 0 && segmentInfo && (
                      <div
                        className="mb-2 p-3 rounded-xl"
                        style={{ background: `${modeColor}08`, border: `1px solid ${modeColor}15` }}
                      >
                        {/* Summary row */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]" style={{ color: modeColor }}>
                              {TRANSPORT_MODES.find(m => m.id === transportMode)?.icon}
                            </span>
                            <span className="text-[12px] font-medium" style={{ color: modeColor }}>
                              {formatDuration(segmentInfo.duration)}
                            </span>
                            <span className="text-[10px] text-[#c0c6d6]">·</span>
                            <span className="text-[11px] text-[#c0c6d6]">
                              {formatDistance(segmentInfo.distance)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Turn-by-turn directions */}
                        {segmentInfo.steps && segmentInfo.steps.length > 0 && (
                          <DirectionsPanel
                            steps={segmentInfo.steps}
                            isExpanded={isCurrentlyExpanded}
                            onToggle={() => setExpandedDirections(isCurrentlyExpanded ? null : i)}
                            modeColor={modeColor}
                          />
                        )}
                      </div>
                    )}
                    
                    {/* Activity card */}
                    <button
                      onClick={() => {
                        animation.jumpToActivity(i)
                        setSelectedActivity(activity)
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-all"
                      style={{
                        background: animation.currentActivityIndex === i ? `${getActivityColor(activity.type)}15` : "rgba(42,42,44,0.5)",
                        border: `1px solid ${animation.currentActivityIndex === i ? `${getActivityColor(activity.type)}40` : "transparent"}`,
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[13px]"
                        style={{ background: animation.currentActivityIndex === i ? getActivityColor(activity.type) : i < animation.currentActivityIndex ? "#30D158" : "rgba(255,255,255,0.1)" }}
                      >
                        {i < animation.currentActivityIndex && animation.currentActivityIndex !== i ? "✓" : i + 1}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-[13px] font-medium text-white truncate">{activity.name}</p>
                        <p className="text-[11px] text-[#c0c6d6]">{activity.time} · {activity.duration}min</p>
                      </div>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${getActivityColor(activity.type)}20` }}
                      >
                        <span
                          className="material-symbols-outlined text-[16px]"
                          style={{ color: getActivityColor(activity.type), fontVariationSettings: "'FILL' 1" }}
                        >
                          {activity.icon ?? ACTIVITY_ICONS[activity.type] ?? "place"}
                        </span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function createMarker(activity: TimelineActivity, index: number): HTMLDivElement {
  const color = getActivityColor(activity.type)
  const icon = activity.icon ?? ACTIVITY_ICONS[activity.type] ?? "place"
  
  const el = document.createElement("div")
  el.style.cssText = `width:44px;height:44px;cursor:pointer;transition:transform 0.2s;z-index:1;`
  
  const circle = document.createElement("div")
  circle.style.cssText = `width:100%;height:100%;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;position:relative;`
  
  const iconEl = document.createElement("span")
  iconEl.className = "material-symbols-outlined"
  iconEl.textContent = icon
  iconEl.style.cssText = `font-size:20px;color:white;font-variation-settings:'FILL' 1;`
  
  const badge = document.createElement("div")
  badge.style.cssText = `position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:white;color:#131315;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;`
  badge.textContent = String(index + 1)
  
  circle.appendChild(iconEl)
  circle.appendChild(badge)
  el.appendChild(circle)
  
  el.onmouseenter = () => { el.style.transform = "scale(1.15)"; el.style.zIndex = "10" }
  el.onmouseleave = () => { el.style.transform = "scale(1)"; el.style.zIndex = "1" }
  
  return el
}

function createPopup(activity: TimelineActivity, index: number, routeSummary: RouteSummary | null): string {
  const color = getActivityColor(activity.type)
  const segmentInfo = index > 0 && routeSummary?.segments[index - 1]
  
  return `<div style="font-family:Inter,system-ui;padding:12px;min-width:180px;">
    <div style="font-weight:600;font-size:14px;color:#131315;margin-bottom:4px;">${activity.name}</div>
    <div style="font-size:11px;color:#666;">${activity.time} · ${activity.duration}min · ${activity.location}</div>
    ${activity.cost > 0 ? `<div style="margin-top:6px;color:#22C55E;font-weight:500;">€${activity.cost}</div>` : ""}
    ${segmentInfo ? `
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #eee;font-size:11px;color:#666;">
        <span style="color:${color};">↑</span> ${formatDuration(segmentInfo.duration)} · ${formatDistance(segmentInfo.distance)} desde anterior
      </div>
    ` : ""}
  </div>`
}
