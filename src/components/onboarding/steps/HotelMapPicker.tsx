"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { getCityCenter } from "@/components/features/map/types"

// Fix Leaflet default icon issue in Next.js
const pinIcon = L.divIcon({
  className: "",
  html: `<div style="
    width: 32px; height: 32px;
    background: linear-gradient(135deg, #0A84FF, #5856D6);
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid white;
    box-shadow: 0 4px 12px rgba(10,132,255,0.5);
  "></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

function ClickHandler({ onPin }: { onPin: (lat: number, lng: number, address?: string) => void }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng
      onPin(lat, lng)
      // Reverse geocode to get address
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`, {
        headers: { "User-Agent": "Viaje360/1.0", "Accept-Language": "es,en" },
      })
        .then(r => r.json())
        .then(data => {
          if (data?.display_name) {
            onPin(lat, lng, data.display_name)
          }
        })
        .catch(() => {})
    },
  })
  return null
}

function FlyToDestination({ destination, initialQuery }: { destination: string; initialQuery: string }) {
  const map = useMap()

  useEffect(() => {
    const q = initialQuery || destination
    if (!q) return
    fetch(`/api/geocode?q=${encodeURIComponent(q)}${destination ? `&near=${encodeURIComponent(destination)}` : ""}`)
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.lat && data?.lng) {
          map.flyTo([data.lat, data.lng], 15, { duration: 1.2 })
        }
      })
      .catch(() => {})
  }, [map, destination, initialQuery])

  return null
}

interface HotelMapPickerProps {
  destination: string
  initialQuery?: string
  pinLat?: number
  pinLng?: number
  onPin: (lat: number, lng: number, address?: string) => void
}

export function HotelMapPicker({ destination, initialQuery, pinLat, pinLng, onPin }: HotelMapPickerProps) {
  const cityCenter = getCityCenter(destination)
  const center: [number, number] = [cityCenter.lat, cityCenter.lng]
  const pinPosition: [number, number] | null = pinLat && pinLng ? [pinLat, pinLng] : null

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <FlyToDestination destination={destination} initialQuery={initialQuery ?? ""} />
        <ClickHandler onPin={onPin} />
        {pinPosition && (
          <Marker position={pinPosition} icon={pinIcon} />
        )}
      </MapContainer>

      {/* Tap-to-pin hint */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-medium pointer-events-none"
        style={{
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          color: "#c0c6d6",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {pinPosition ? "✓ Ubicación marcada · toca para mover" : "Toca el mapa para marcar tu hotel"}
      </div>
    </div>
  )
}
