/**
 * Normalized place shape used throughout the app.
 * All providers must return data in this format.
 */
export interface NormalizedPlace {
  id: string
  name: string
  type: string
  address: string
  neighborhood: string
  lat?: number
  lng?: number
  rating?: number
  priceLevel?: string
  notes: string
  kidFriendly: boolean
  petFriendly: boolean
  accessible: boolean
  dietaryOptions: string[]
  openingHours?: string
  indoor?: boolean
  source: "google" | "gemini"
}

export interface PlacesSearchParams {
  query: string
  location: string
  lat?: number
  lng?: number
  filters?: {
    kidFriendly?: boolean
    petFriendly?: boolean
    dietary?: string[]
    accessible?: boolean
    type?: string
  }
}

/**
 * Provider interface — any places data source must implement this.
 */
export interface PlacesProvider {
  readonly name: string
  search(params: PlacesSearchParams): Promise<NormalizedPlace[]>
}
