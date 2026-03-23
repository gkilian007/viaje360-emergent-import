"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import type { DayItinerary, TimelineActivity } from "@/lib/types"
import { ACTIVITY_ICONS } from "@/lib/constants"

interface ItineraryMapProps {
  itinerary: DayItinerary[]
  selectedDay: number
  onActivityClick?: (activity: TimelineActivity) => void
  accessToken: string
}

// Activity type to color mapping
const ACTIVITY_COLORS: Record<string, string> = {
  hotel: "#8B5CF6",      // Purple
  restaurant: "#F97316", // Orange
  monument: "#EAB308",   // Yellow
  museum: "#EC4899",     // Pink
  park: "#22C55E",       // Green
  shopping: "#F43F5E",   // Rose
  tour: "#0EA5E9",       // Sky blue
  transport: "#64748B",  // Slate
  default: "#0A84FF",    // Primary blue
}

function getActivityColor(type: string): string {
  return ACTIVITY_COLORS[type] || ACTIVITY_COLORS.default
}

// Create custom marker element
function createMarkerElement(activity: TimelineActivity, index: number): HTMLDivElement {
  const el = document.createElement("div")
  el.className = "map-marker"
  el.style.cssText = `
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: ${getActivityColor(activity.type)};
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.2s ease;
    position: relative;
  `
  
  // Add order badge
  const badge = document.createElement("span")
  badge.style.cssText = `
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    color: #131315;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  `
  badge.textContent = String(index + 1)
  el.appendChild(badge)

  el.addEventListener("mouseenter", () => {
    el.style.transform = "scale(1.15)"
  })
  el.addEventListener("mouseleave", () => {
    el.style.transform = "scale(1)"
  })

  return el
}

// Create popup content
function createPopupContent(activity: TimelineActivity): string {
  const icon = activity.icon ?? ACTIVITY_ICONS[activity.type] ?? "place"
  return `
    <div style="font-family: 'Inter', system-ui, sans-serif; padding: 8px; min-width: 180px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span class="material-symbols-outlined" style="font-size: 20px; color: ${getActivityColor(activity.type)};">${icon}</span>
        <div>
          <div style="font-weight: 600; font-size: 14px; color: #131315;">${activity.name}</div>
          <div style="font-size: 11px; color: #666;">${activity.time} · ${activity.duration} min</div>
        </div>
      </div>
      <div style="font-size: 12px; color: #666; display: flex; align-items: center; gap: 4px;">
        <span class="material-symbols-outlined" style="font-size: 14px;">location_on</span>
        ${activity.location}
      </div>
      ${activity.cost > 0 ? `
        <div style="margin-top: 6px; font-size: 12px; color: #22C55E; font-weight: 500;">
          €${activity.cost}
        </div>
      ` : ""}
    </div>
  `
}

// Sample coordinates for Barcelona activities (in real app would come from geocoding or DB)
const SAMPLE_COORDS: Record<string, [number, number]> = {
  "Check-in Hotel Arts": [2.1970, 41.3879],
  "Paseo por la Barceloneta": [2.1896, 41.3784],
  "Cena en El Nacional": [2.1683, 41.3914],
  "Sagrada Família": [2.1744, 41.4036],
  "Almuerzo en Cervecería Catalana": [2.1632, 41.3936],
  "Casa Batlló": [2.1650, 41.3916],
  "Park Güell": [2.1527, 41.4145],
  "Mercado de La Boqueria": [2.1719, 41.3816],
  // Default fallback coordinates for Barcelona center
  default: [2.1734, 41.3851],
}

function getActivityCoords(activity: TimelineActivity): [number, number] {
  // Check if we have predefined coords for this activity
  const coords = SAMPLE_COORDS[activity.name]
  if (coords) return coords
  
  // Otherwise return default with slight random offset for demo
  const [lng, lat] = SAMPLE_COORDS.default
  const offset = Math.random() * 0.02 - 0.01
  return [lng + offset, lat + offset]
}

export function ItineraryMap({
  itinerary,
  selectedDay,
  onActivityClick,
  accessToken,
}: ItineraryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  const dayData = itinerary[selectedDay - 1]
  const activities = dayData?.activities ?? []

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    mapboxgl.accessToken = accessToken

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: SAMPLE_COORDS.default,
      zoom: 13,
      pitch: 45,
      bearing: -17.6,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right")

    map.current.on("load", () => {
      setIsLoaded(true)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [accessToken])

  // Update markers and route when day changes
  useEffect(() => {
    if (!map.current || !isLoaded) return

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    // Remove existing route layer and source
    if (map.current.getLayer("route")) {
      map.current.removeLayer("route")
    }
    if (map.current.getLayer("route-outline")) {
      map.current.removeLayer("route-outline")
    }
    if (map.current.getSource("route")) {
      map.current.removeSource("route")
    }

    if (activities.length === 0) return

    // Get coordinates for all activities
    const coordinates: [number, number][] = activities.map(getActivityCoords)

    // Add route line
    if (coordinates.length >= 2) {
      map.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: coordinates,
          },
        },
      })

      // Route outline (for glow effect)
      map.current.addLayer({
        id: "route-outline",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#0A84FF",
          "line-width": 8,
          "line-opacity": 0.3,
          "line-blur": 3,
        },
      })

      // Main route line
      map.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#0A84FF",
          "line-width": 4,
          "line-dasharray": [2, 1],
        },
      })
    }

    // Add markers
    activities.forEach((activity, index) => {
      const coords = getActivityCoords(activity)
      const el = createMarkerElement(activity, index)

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        maxWidth: "280px",
      }).setHTML(createPopupContent(activity))

      const marker = new mapboxgl.Marker(el)
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(map.current!)

      el.addEventListener("click", () => {
        onActivityClick?.(activity)
      })

      markersRef.current.push(marker)
    })

    // Fit bounds to show all markers
    if (coordinates.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      coordinates.forEach((coord) => bounds.extend(coord))
      map.current.fitBounds(bounds, {
        padding: { top: 100, bottom: 150, left: 50, right: 50 },
        maxZoom: 15,
        duration: 1000,
      })
    }
  }, [activities, isLoaded, onActivityClick])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Map legend */}
      <div
        className="absolute bottom-4 left-4 p-3 rounded-xl z-10"
        style={{
          background: "rgba(19, 19, 21, 0.9)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <p className="text-[10px] uppercase tracking-widest text-[#c0c6d6] font-medium mb-2">
          Día {selectedDay}
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ACTIVITY_COLORS)
            .filter(([key]) => key !== "default")
            .slice(0, 4)
            .map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: color }}
                />
                <span className="text-[10px] text-[#c0c6d6] capitalize">{type}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
