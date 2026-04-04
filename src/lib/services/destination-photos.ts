/**
 * Destination photo lookup service.
 * Maps city names and POI names to Wikimedia Commons photo URLs.
 * Uses pre-fetched metadata from data/photos/metadata/.
 */

import destinationsDb from "@/../data/photos/metadata/destinations-photos.json"

// ── Types ──

interface PhotoEntry {
  url: string
  thumbUrl?: string
  width?: number
  height?: number
  title?: string
  attribution?: string
  license?: string
  description?: string
  source?: string
  method?: string
  articleTitle?: string
}

interface DestinationEntry {
  city: string
  country: string
  wiki: string
  hero: PhotoEntry | null
  pois: Array<{ name: string; photo: PhotoEntry | null }>
}

// ── Normalize city names for matching ──

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, "")
    .trim()

// Build lookup maps at module load
const cityMap = new Map<string, DestinationEntry>()
const aliasMap = new Map<string, string>() // alias → normalized city

// Common aliases (Spanish name → wiki name, etc.)
const CITY_ALIASES: Record<string, string[]> = {
  Roma: ["Rome", "roma"],
  París: ["Paris", "paris"],
  Londres: ["London", "london"],
  Tokyo: ["Tokio", "tokio", "tokyo"],
  "Nueva York": ["New York", "New York City", "new york", "nueva york", "nyc"],
  Lisboa: ["Lisbon", "lisbon", "lisboa"],
  Ámsterdam: ["Amsterdam", "amsterdam"],
  Berlín: ["Berlin", "berlin"],
  Praga: ["Prague", "prague", "praga"],
  Viena: ["Vienna", "vienna", "viena", "wien"],
  Estambul: ["Istanbul", "istanbul", "estambul"],
  Dubái: ["Dubai", "dubai"],
  "Ciudad de México": ["Mexico City", "cdmx", "ciudad de mexico", "mexico city"],
  "Buenos Aires": ["buenos aires"],
  Marrakech: ["Marrakesh", "marrakesh", "marrakech"],
  Singapur: ["Singapore", "singapore", "singapur"],
  Sevilla: ["Seville", "seville", "sevilla"],
  Barcelona: ["barcelona"],
  Madrid: ["madrid"],
  Bangkok: ["bangkok"],
}

// Initialize maps
for (const dest of destinationsDb as DestinationEntry[]) {
  const normCity = normalize(dest.city)
  const normWiki = normalize(dest.wiki)
  cityMap.set(normCity, dest)
  cityMap.set(normWiki, dest)

  // Register aliases
  const aliases = CITY_ALIASES[dest.city] ?? []
  for (const alias of aliases) {
    cityMap.set(normalize(alias), dest)
  }
}

// POI lookup: build a flat map of normalized POI name → photo URL
const poiMap = new Map<string, PhotoEntry>()
for (const dest of destinationsDb as DestinationEntry[]) {
  for (const poi of dest.pois) {
    if (poi.photo) {
      poiMap.set(normalize(poi.name), poi.photo)
    }
  }
}

// ── Public API ──

/**
 * Get the hero image URL for a destination city.
 * Returns a Wikimedia URL or null if not found.
 */
export function getDestinationHeroUrl(city: string): string | null {
  const entry = cityMap.get(normalize(city))
  return entry?.hero?.url ?? null
}

/**
 * Get a thumbnail-sized hero URL (resized via Wikimedia's thumb service).
 * Width defaults to 800px.
 */
export function getDestinationHeroThumb(city: string, width = 800): string | null {
  const url = getDestinationHeroUrl(city)
  if (!url) return null
  // Use full-res URL directly — Wikimedia thumb endpoints are rate-limited (429)
  // and Next.js Image can resize on the fly via sizes/quality props
  return url
}

/**
 * Get photo URL for a specific POI (activity/place).
 * Tries exact POI match first, then fuzzy search.
 */
export function getPoiPhotoUrl(poiName: string): string | null {
  // Exact normalized match
  const exact = poiMap.get(normalize(poiName))
  if (exact) return exact.url

  // Fuzzy: check if POI name contains or is contained in a known POI
  const normQuery = normalize(poiName)
  for (const [key, photo] of poiMap.entries()) {
    if (key.includes(normQuery) || normQuery.includes(key)) {
      return photo.url
    }
  }

  return null
}

/**
 * Get thumbnail photo URL for a POI.
 */
export function getPoiPhotoThumb(poiName: string, width = 400): string | null {
  const url = getPoiPhotoUrl(poiName)
  if (!url) return null
  // Use full-res URL directly — Wikimedia thumb endpoints are rate-limited (429)
  return url
}

/**
 * Get all POI photos for a destination city.
 * Returns array of { name, url, thumbUrl }.
 */
export function getDestinationPois(
  city: string
): Array<{ name: string; url: string; thumbUrl: string }> {
  const entry = cityMap.get(normalize(city))
  if (!entry) return []

  return entry.pois
    .filter((p) => p.photo?.url)
    .map((p) => ({
      name: p.name,
      url: p.photo!.url,
      thumbUrl: toWikimediaThumb(p.photo!.url, 400),
    }))
}

/**
 * Check if we have photos for a destination.
 */
export function hasDestinationPhotos(city: string): boolean {
  return cityMap.has(normalize(city))
}

/**
 * Get photo for an activity: tries activity name as POI, then imageQuery field.
 */
export function getActivityPhoto(
  activityName: string,
  imageQuery?: string
): string | null {
  // Try activity name directly
  const byName = getPoiPhotoThumb(activityName, 400)
  if (byName) return byName

  // Try imageQuery if provided
  if (imageQuery) {
    const byQuery = getPoiPhotoThumb(imageQuery, 400)
    if (byQuery) return byQuery
  }

  return null
}

// ── Helpers ──

/**
 * Convert a full Wikimedia Commons URL to a thumbnail URL.
 * Works with both /commons/ and /en/ uploads.
 */
function toWikimediaThumb(url: string, width: number): string {
  // Already a thumb URL
  if (url.includes("/thumb/")) return url

  // SVG — not useful as photo
  if (url.endsWith(".svg")) return url

  // Convert: .../commons/a/ab/File.jpg → .../commons/thumb/a/ab/File.jpg/{width}px-File.jpg
  const match = url.match(/\/wikipedia\/(commons|en)\/([0-9a-f]\/[0-9a-f]{2})\/(.+)$/)
  if (!match) return url

  const [, repo, hash, filename] = match
  return `https://upload.wikimedia.org/wikipedia/${repo}/thumb/${hash}/${filename}/${width}px-${filename}`
}
