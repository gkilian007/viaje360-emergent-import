import { getFeatureFlag } from "@/lib/feature-flags"
import type { NormalizedPlace, PlacesProvider, PlacesSearchParams } from "./types"
import { GeminiPlacesProvider } from "./gemini-provider"
import { GooglePlacesProvider } from "./google-provider"

export type { NormalizedPlace, PlacesSearchParams } from "./types"

const geminiProvider = new GeminiPlacesProvider()
const googleProvider = new GooglePlacesProvider()

/**
 * Returns the active places provider based on feature flags and env config.
 * Google Places is primary when enabled + API key present; Gemini is fallback.
 */
export function getPlacesProvider(): PlacesProvider {
  if (
    getFeatureFlag("GOOGLE_PLACES") &&
    process.env.GOOGLE_PLACES_API_KEY
  ) {
    return googleProvider
  }
  return geminiProvider
}

/**
 * Search for places using the active provider with automatic fallback.
 * If the primary provider fails, falls back to Gemini.
 */
export async function searchPlaces(
  params: PlacesSearchParams
): Promise<NormalizedPlace[]> {
  const provider = getPlacesProvider()

  try {
    const results = await provider.search(params)
    if (results.length > 0) return results
  } catch (err) {
    console.warn(
      `[searchPlaces] ${provider.name} provider failed, falling back to Gemini:`,
      err instanceof Error ? err.message : err
    )
  }

  // Fallback to Gemini if primary failed or returned empty
  if (provider.name !== "gemini") {
    try {
      return await geminiProvider.search(params)
    } catch (err) {
      console.error("[searchPlaces] Gemini fallback also failed:", err)
    }
  }

  return []
}
