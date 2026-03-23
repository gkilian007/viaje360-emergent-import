// ─── User & Trip ─────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  avatar?: string
  level: number
  xp: number
  xpToNext: number
  title: string
  totalTrips: number
  countriesVisited: number
  monumentsCollected: number
}

export interface Trip {
  id: string
  name: string
  destination: string
  country: string
  startDate: string
  endDate: string
  budget: number
  spent: number
  status: "planning" | "active" | "completed"
  imageUrl?: string
  description?: string
  currentActivity?: string
  nextActivity?: TimelineActivity
  weather?: Weather
}

// ─── Activities ───────────────────────────────────────────────────────────────

export type ActivityType =
  | "museum"
  | "restaurant"
  | "monument"
  | "park"
  | "shopping"
  | "tour"
  | "hotel"
  | "transport"

export interface TimelineActivity {
  id: string
  name: string
  type: ActivityType
  location: string
  time: string
  duration: number
  cost: number
  booked: boolean
  notes?: string
  description?: string
  icon?: string
  friendAvatars?: string[]
  /** Ticket/booking URL or restaurant menu URL */
  url?: string
  /** Average price per person (restaurants) */
  pricePerPerson?: number
  /** Search query for fetching a photo */
  imageQuery?: string
}

export interface DayItinerary {
  date: string
  dayNumber: number
  activities: TimelineActivity[]
}

// ─── Weather ──────────────────────────────────────────────────────────────────

export interface Weather {
  temp: number
  condition: string
  icon: string
  humidity: number
  wind: number
}

// ─── Monument / Achievement ───────────────────────────────────────────────────

export type Rarity = "common" | "rare" | "epic" | "legendary"

export interface Monument {
  id: string
  name: string
  location: string
  description: string
  imageUrl?: string
  collected: boolean
  collectedAt?: string
  xpReward: number
  rarity: Rarity
}

export interface Achievement {
  id: string
  name: string
  description: string
  rarity: Rarity
  xpReward: number
  icon: string
  unlockedAt?: string
  unlocked: boolean
  location?: string
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant"

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: string
  suggestions?: AISuggestion[]
}

export interface AISuggestion {
  id: string
  title: string
  subtitle: string
  imageUrl?: string
  imageColor?: string
  cta?: string
  ctaAction?: string
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  funFact: string
  xpReward: number
}

// ─── Map ──────────────────────────────────────────────────────────────────────

export interface MapMarker {
  id: string
  lat: number
  lng: number
  label: string
  type: "current" | "next" | "poi" | "visited"
}

// ─── Destination ──────────────────────────────────────────────────────────────

export interface Destination {
  id: string
  name: string
  country: string
  description: string
  imageColor: string
  rating: number
  category: string[]
}
