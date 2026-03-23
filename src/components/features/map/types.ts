import type { TimelineActivity } from "@/lib/types"

// Coordinate type
export interface Coordinate {
  lng: number
  lat: number
}

// Activity with coordinates
export interface ActivityWithCoords extends TimelineActivity {
  coordinates: Coordinate
}

// Animation state
export type AnimationState = "idle" | "playing" | "paused" | "finished"

// Animation config
export interface AnimationConfig {
  speed: number // pixels per frame
  pauseAtStops: number // ms to pause at each stop
  easing: "linear" | "easeInOut" | "easeOut"
  followCamera: boolean
  cameraZoom: number
}

// Route segment for animation calculations
export interface RouteSegment {
  from: Coordinate
  to: Coordinate
  distance: number
  bearing: number
  activityIndex: number
}

// Avatar position during animation
export interface AvatarPosition {
  coordinate: Coordinate
  bearing: number
  progress: number // 0-1 for entire route
  currentSegmentIndex: number
  isAtStop: boolean
  currentActivityIndex: number
}

// Default animation config
export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  speed: 0.00008, // degrees per frame (adjust for visual speed)
  pauseAtStops: 1500,
  easing: "easeInOut",
  followCamera: true,
  cameraZoom: 15,
}

// Sample coordinates for Barcelona (fallback when real coords not available)
export const BARCELONA_COORDS: Record<string, Coordinate> = {
  "Check-in Hotel Arts": { lng: 2.1970, lat: 41.3879 },
  "Paseo por la Barceloneta": { lng: 2.1896, lat: 41.3784 },
  "Cena en El Nacional": { lng: 2.1683, lat: 41.3914 },
  "Sagrada Família": { lng: 2.1744, lat: 41.4036 },
  "Almuerzo en Cervecería Catalana": { lng: 2.1632, lat: 41.3936 },
  "Casa Batlló": { lng: 2.1650, lat: 41.3916 },
  "Park Güell": { lng: 2.1527, lat: 41.4145 },
  "Mercado de La Boqueria": { lng: 2.1719, lat: 41.3816 },
  default: { lng: 2.1734, lat: 41.3851 },
}

// City center coordinates for fallback
export const CITY_CENTERS: Record<string, Coordinate> = {
  "barcelona": { lng: 2.1734, lat: 41.3851 },
  "madrid": { lng: -3.7038, lat: 40.4168 },
  "paris": { lng: 2.3522, lat: 48.8566 },
  "roma": { lng: 12.4964, lat: 41.9028 },
  "londres": { lng: -0.1276, lat: 51.5074 },
  "nueva york": { lng: -74.0060, lat: 40.7128 },
  "tokio": { lng: 139.6917, lat: 35.6895 },
  "default": { lng: 2.1734, lat: 41.3851 },
}

// Get city center from destination name
export function getCityCenter(destination?: string): Coordinate {
  if (!destination) return CITY_CENTERS.default
  const normalizedDest = destination.toLowerCase().trim()
  return CITY_CENTERS[normalizedDest] || CITY_CENTERS.default
}

// Activity type to color mapping
export const ACTIVITY_COLORS: Record<string, string> = {
  hotel: "#8B5CF6",
  restaurant: "#F97316",
  monument: "#EAB308",
  museum: "#EC4899",
  park: "#22C55E",
  shopping: "#F43F5E",
  tour: "#0EA5E9",
  transport: "#64748B",
  default: "#0A84FF",
}

export function getActivityColor(type: string): string {
  return ACTIVITY_COLORS[type] || ACTIVITY_COLORS.default
}

// Get coordinates for an activity (with dynamic fallback based on destination)
export function getActivityCoordinates(activity: TimelineActivity, destination?: string): Coordinate {
  // Check if activity has real coordinates (from API like Google Places)
  if ((activity as any).coordinates) {
    const coords = (activity as any).coordinates
    if (typeof coords.lng === "number" && typeof coords.lat === "number") {
      return coords
    }
  }
  
  // Check if activity has lat/lng properties directly
  if ((activity as any).lat && (activity as any).lng) {
    return { lng: (activity as any).lng, lat: (activity as any).lat }
  }
  
  // Check for predefined coords by name (Barcelona specific)
  const predefined = BARCELONA_COORDS[activity.name]
  if (predefined) return predefined
  
  // Get city center for dynamic offset
  const cityCenter = getCityCenter(destination)
  
  // Generate deterministic offset based on activity id
  // This ensures same activity always gets same coords
  const hash = activity.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const offsetLng = ((hash % 100) - 50) * 0.0004
  const offsetLat = (((hash * 7) % 100) - 50) * 0.0003
  
  return {
    lng: cityCenter.lng + offsetLng,
    lat: cityCenter.lat + offsetLat,
  }
}

// Calculate bearing between two points (in degrees)
export function calculateBearing(from: Coordinate, to: Coordinate): number {
  const dLng = (to.lng - from.lng) * Math.PI / 180
  const lat1 = from.lat * Math.PI / 180
  const lat2 = to.lat * Math.PI / 180
  
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI
  return (bearing + 360) % 360
}

// Calculate distance between two coordinates (in degrees, approximate)
export function calculateDistance(from: Coordinate, to: Coordinate): number {
  const dLng = to.lng - from.lng
  const dLat = to.lat - from.lat
  return Math.sqrt(dLng * dLng + dLat * dLat)
}

// Build route segments from activities
export function buildRouteSegments(activities: ActivityWithCoords[]): RouteSegment[] {
  const segments: RouteSegment[] = []
  
  for (let i = 0; i < activities.length - 1; i++) {
    const from = activities[i].coordinates
    const to = activities[i + 1].coordinates
    
    segments.push({
      from,
      to,
      distance: calculateDistance(from, to),
      bearing: calculateBearing(from, to),
      activityIndex: i,
    })
  }
  
  return segments
}

// Easing functions
export const easingFunctions = {
  linear: (t: number) => t,
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
}

// Interpolate position along a segment
export function interpolatePosition(
  segment: RouteSegment,
  progress: number, // 0-1 within this segment
  easing: keyof typeof easingFunctions = "linear"
): Coordinate {
  const easedProgress = easingFunctions[easing](progress)
  
  return {
    lng: segment.from.lng + (segment.to.lng - segment.from.lng) * easedProgress,
    lat: segment.from.lat + (segment.to.lat - segment.from.lat) * easedProgress,
  }
}
