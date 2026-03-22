import type { NormalizedPlace, PlacesProvider, PlacesSearchParams } from "./types"

const PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText"

/**
 * Google Places (new) API provider.
 * Requires GOOGLE_PLACES_API_KEY env var.
 */
export class GooglePlacesProvider implements PlacesProvider {
  readonly name = "google"

  async search(params: PlacesSearchParams): Promise<NormalizedPlace[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY not set")
    }

    const filters = params.filters ?? {}
    const queryParts = [params.query]
    if (filters.type) queryParts.push(filters.type)
    if (filters.kidFriendly) queryParts.push("family friendly")
    if (filters.accessible) queryParts.push("wheelchair accessible")

    const body: Record<string, unknown> = {
      textQuery: `${queryParts.join(" ")} in ${params.location}`,
      maxResultCount: 5,
      languageCode: "es",
    }

    // If we have lat/lng, add location bias
    if (params.lat != null && params.lng != null) {
      body.locationBias = {
        circle: {
          center: { latitude: params.lat, longitude: params.lng },
          radius: 5000,
        },
      }
    }

    const fieldMask = [
      "places.displayName",
      "places.formattedAddress",
      "places.location",
      "places.rating",
      "places.priceLevel",
      "places.types",
      "places.currentOpeningHours",
      "places.accessibilityOptions",
      "places.editorialSummary",
    ].join(",")

    const res = await fetch(PLACES_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[GooglePlacesProvider] API error ${res.status}: ${text}`)
      throw new Error(`Google Places error: ${res.status}`)
    }

    const data = (await res.json()) as { places?: GooglePlace[] }
    return (data.places ?? []).map((p, i) => normalizeGooglePlace(p, i, filters))
  }
}

// --- Google Places API response types ---

interface GooglePlace {
  displayName?: { text: string; languageCode: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  rating?: number
  priceLevel?: string
  types?: string[]
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] }
  accessibilityOptions?: { wheelchairAccessibleEntrance?: boolean }
  editorialSummary?: { text: string }
}

const GOOGLE_PRICE_MAP: Record<string, string> = {
  PRICE_LEVEL_FREE: "Gratis",
  PRICE_LEVEL_INEXPENSIVE: "€",
  PRICE_LEVEL_MODERATE: "€€",
  PRICE_LEVEL_EXPENSIVE: "€€€",
  PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
}

function mapGoogleType(types: string[]): string {
  const mapping: Record<string, string> = {
    restaurant: "restaurant",
    museum: "museum",
    park: "park",
    shopping_mall: "shopping",
    tourist_attraction: "monument",
    lodging: "hotel",
  }
  for (const t of types) {
    if (mapping[t]) return mapping[t]
  }
  return "tour"
}

function normalizeGooglePlace(
  raw: GooglePlace,
  index: number,
  filters: PlacesSearchParams["filters"]
): NormalizedPlace {
  const types = raw.types ?? []
  return {
    id: `google-${Date.now()}-${index}`,
    name: raw.displayName?.text ?? "Unknown",
    type: mapGoogleType(types),
    address: raw.formattedAddress ?? "",
    neighborhood: "",
    lat: raw.location?.latitude,
    lng: raw.location?.longitude,
    rating: raw.rating,
    priceLevel: raw.priceLevel ? GOOGLE_PRICE_MAP[raw.priceLevel] ?? raw.priceLevel : undefined,
    notes: raw.editorialSummary?.text ?? "",
    kidFriendly: filters?.kidFriendly ?? false,
    petFriendly: filters?.petFriendly ?? false,
    accessible: raw.accessibilityOptions?.wheelchairAccessibleEntrance ?? false,
    dietaryOptions: filters?.dietary ?? [],
    openingHours: raw.currentOpeningHours?.weekdayDescriptions?.[0],
    indoor: types.includes("museum") || types.includes("shopping_mall"),
    source: "google",
  }
}
