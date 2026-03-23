// ─── Database Types ────────────────────────────────────────────────────────────
// Manual TypeScript types matching the Supabase schema

export interface DbProfile {
  id: string
  name: string | null
  avatar_url: string | null
  level: number
  xp: number
  xp_to_next: number
  title: string
  total_trips: number
  countries_visited: number
  monuments_collected: number
  created_at: string
  updated_at: string
}

export interface DbOnboardingProfile {
  id: string
  user_id: string | null
  destination: string
  start_date: string
  end_date: string
  arrival_time: string | null
  departure_time: string | null
  companion: string
  group_size: number
  kids_pets: string[]
  mobility: string
  accommodation_zone: string | null
  interests: string[]
  traveler_style: string | null
  famous_local: string
  pace: number
  rest_days: boolean
  rest_frequency: string | null
  wake_style: number
  siesta: boolean
  budget_level: string
  splurge_categories: string[]
  dietary_restrictions: string[]
  allergies: string | null
  transport: string[]
  weather_adaptation: boolean
  first_time: boolean
  must_see: string | null
  must_avoid: string | null
  booked_tickets: string | null
  created_at: string
}

export interface DbTrip {
  id: string
  user_id: string | null
  onboarding_id: string | null
  name: string
  destination: string
  country: string | null
  start_date: string
  end_date: string
  budget: number
  spent: number
  status: "planning" | "active" | "completed"
  current_activity: string | null
  weather_temp: number | null
  weather_condition: string | null
  weather_icon: string | null
  created_at: string
  updated_at: string
}

export interface DbItineraryDay {
  id: string
  trip_id: string
  day_number: number
  date: string
  theme: string | null
  is_rest_day: boolean
  created_at: string
}

export interface DbActivity {
  id: string
  day_id: string
  trip_id: string
  name: string
  type: string
  location: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  time: string | null
  end_time: string | null
  duration: number | null
  cost: number
  booked: boolean
  notes: string | null
  icon: string | null
  neighborhood: string | null
  is_ai_suggestion: boolean
  weather_dependent: boolean
  indoor: boolean
  accessibility_info: string | null
  kid_friendly: boolean
  pet_friendly: boolean
  dietary_tags: string[]
  sort_order: number
  created_at: string
}

export interface DbChatMessage {
  id: string
  trip_id: string
  user_id: string
  role: "user" | "assistant"
  content: string
  suggestions: unknown | null
  created_at: string
}

export interface DbItineraryVersion {
  id: string
  trip_id: string
  version_number: number
  parent_version_id: string | null
  snapshot: GeneratedItinerary
  source: "generate" | "manual" | "weather" | "fatigue" | "system"
  reason: string | null
  created_by: string | null
  created_at: string
}

export interface DbAdaptationEvent {
  id: string
  trip_id: string
  from_version_id: string | null
  to_version_id: string
  source: "generate" | "manual" | "weather" | "fatigue" | "system"
  reason: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface DbAchievement {
  id: string
  user_id: string
  name: string
  description: string | null
  rarity: "common" | "rare" | "epic" | "legendary"
  xp_reward: number
  icon: string | null
  location: string | null
  unlocked: boolean
  unlocked_at: string | null
  created_at: string
}

export interface DbMonument {
  id: string
  user_id: string
  trip_id: string | null
  name: string
  location: string | null
  description: string | null
  rarity: "common" | "rare" | "epic" | "legendary"
  xp_reward: number
  collected: boolean
  collected_at: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
}

// ─── Generated Itinerary (from Gemini) ────────────────────────────────────────

export interface GeneratedActivity {
  name: string
  type: string
  location: string
  address?: string
  time: string
  endTime?: string
  duration: number
  cost: number
  notes?: string
  description?: string
  icon?: string
  url?: string
  pricePerPerson?: number
  imageQuery?: string
  indoor?: boolean
  weatherDependent?: boolean
  kidFriendly?: boolean
  petFriendly?: boolean
  dietaryTags?: string[]
}

export interface GeneratedDay {
  dayNumber: number
  date: string
  theme: string
  isRestDay: boolean
  activities: GeneratedActivity[]
}

export interface GeneratedItinerary {
  tripName: string
  days: GeneratedDay[]
}
