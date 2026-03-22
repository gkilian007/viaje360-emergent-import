import type { NormalizedPlace, PlacesProvider, PlacesSearchParams } from "./types"

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

/**
 * Gemini-based places provider — uses LLM to generate place suggestions.
 * Works as fallback when Google Places API key is not available.
 */
export class GeminiPlacesProvider implements PlacesProvider {
  readonly name = "gemini"

  async search(params: PlacesSearchParams): Promise<NormalizedPlace[]> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error("[GeminiPlacesProvider] GEMINI_API_KEY not set")
      return []
    }

    const filters = params.filters ?? {}
    const filterText = [
      filters.kidFriendly ? "kid-friendly" : "",
      filters.petFriendly ? "pet-friendly" : "",
      filters.accessible ? "wheelchair accessible" : "",
      ...(filters.dietary ?? []),
      filters.type ?? "",
    ]
      .filter(Boolean)
      .join(", ")

    const prompt = `You are a travel expert. Find places in ${params.location} matching: "${params.query}".
${filterText ? `Required filters: ${filterText}` : ""}

Return ONLY valid JSON array with 5 results:
[
  {
    "name": "Place name",
    "type": "restaurant|museum|monument|park|shopping|tour|hotel",
    "address": "Full address",
    "neighborhood": "Neighborhood",
    "rating": 4.5,
    "priceLevel": "€|€€|€€€|€€€€",
    "notes": "Brief description and tips",
    "kidFriendly": true,
    "petFriendly": false,
    "accessible": true,
    "dietaryOptions": ["vegetarian", "vegan"],
    "openingHours": "9:00-20:00",
    "indoor": true,
    "lat": 40.4168,
    "lng": -3.7038
  }
]`

    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    })

    if (!res.ok) {
      console.error(`[GeminiPlacesProvider] API error: ${res.status}`)
      return []
    }

    const data = (await res.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>
    }

    const raw = data.candidates[0]?.content?.parts[0]?.text ?? "[]"
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()

    try {
      const parsed = JSON.parse(cleaned) as Array<Record<string, unknown>>
      return parsed.map((p, i) => normalizeGeminiPlace(p, i))
    } catch {
      console.error("[GeminiPlacesProvider] Failed to parse response")
      return []
    }
  }
}

function normalizeGeminiPlace(raw: Record<string, unknown>, index: number): NormalizedPlace {
  return {
    id: `gemini-${Date.now()}-${index}`,
    name: String(raw.name ?? "Unknown"),
    type: String(raw.type ?? "tour"),
    address: String(raw.address ?? ""),
    neighborhood: String(raw.neighborhood ?? ""),
    lat: typeof raw.lat === "number" ? raw.lat : undefined,
    lng: typeof raw.lng === "number" ? raw.lng : undefined,
    rating: typeof raw.rating === "number" ? raw.rating : undefined,
    priceLevel: typeof raw.priceLevel === "string" ? raw.priceLevel : undefined,
    notes: String(raw.notes ?? ""),
    kidFriendly: Boolean(raw.kidFriendly),
    petFriendly: Boolean(raw.petFriendly),
    accessible: Boolean(raw.accessible),
    dietaryOptions: Array.isArray(raw.dietaryOptions)
      ? raw.dietaryOptions.map(String)
      : [],
    openingHours: typeof raw.openingHours === "string" ? raw.openingHours : undefined,
    indoor: typeof raw.indoor === "boolean" ? raw.indoor : undefined,
    source: "gemini",
  }
}
