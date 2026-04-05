"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import type { TimelineActivity } from "@/lib/types"
import { useGeocodedActivities } from "@/lib/hooks/useGeocodedActivities"

const RealMapView = dynamic(
  () => import("./RealMapView").then((mod) => mod.RealMapView),
  {
    ssr: false,
    loading: () => (
      <div className="relative w-full h-full flex items-center justify-center bg-[#0f1117]">
        <div className="text-center">
          <span className="material-symbols-outlined text-[48px] text-[#c0c6d6]/30">map</span>
          <p className="text-[#c0c6d6] text-sm mt-2">Cargando mapa...</p>
        </div>
      </div>
    ),
  }
)

export interface RouteHighlight {
  from: { lat: number; lng: number; name: string }
  to: { lat: number; lng: number; name: string }
  mode: "walking" | "transit" | "driving" | "bicycling"
}

interface DynamicMapViewProps {
  activities: TimelineActivity[]
  destination: string
  selectedActivityId?: string | null
  onMarkerClick?: (activityId: string) => void
  transportPrefs?: string[]
  maxWalkMeters?: number
  routeHighlight?: RouteHighlight | null
  onClearRouteHighlight?: () => void
}

export function DynamicMapView({
  activities,
  destination,
  selectedActivityId,
  onMarkerClick,
  transportPrefs,
  maxWalkMeters,
  routeHighlight,
  onClearRouteHighlight,
}: DynamicMapViewProps) {
  const { geocoded, center, loading } = useGeocodedActivities(activities, destination)

  // Fallback: geocode the destination itself when no activity coords available
  const [destCenter, setDestCenter] = useState<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (center || !destination) return
    fetch(`/api/geocode?q=${encodeURIComponent(destination)}`)
      .then(r => r.json())
      .then(({ data }) => { if (data) setDestCenter(data) })
      .catch(() => {})
  }, [center, destination])

  const effectiveCenter = center ?? destCenter

  return (
    <RealMapView
      geocoded={geocoded}
      center={effectiveCenter}
      loading={loading}
      selectedActivityId={selectedActivityId}
      onMarkerClick={onMarkerClick}
      transportPrefs={transportPrefs}
      maxWalkMeters={maxWalkMeters}
      destination={destination}
      routeHighlight={routeHighlight}
      onClearRouteHighlight={onClearRouteHighlight}
    />
  )
}
