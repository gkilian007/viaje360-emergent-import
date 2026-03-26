export const COLORS = {
  surface: "#131315",
  surfaceContainer: "#1f1f21",
  surfaceContainerHigh: "#2a2a2c",
  surfaceContainerHighest: "#35353a",
  onSurface: "#e4e2e4",
  onSurfaceVariant: "#c0c6d6",
  primary: "#0A84FF",
  gold: "#ffdb3c",
  error: "#FF453A",
  success: "#30D158",
} as const

export const RARITY_COLORS: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  common: {
    text: "text-[#c0c6d6]",
    bg: "bg-[#2a2a2c]",
    border: "border-white/10",
    glow: "",
  },
  rare: {
    text: "text-blue-400",
    bg: "bg-blue-950/40",
    border: "border-blue-500/30",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.3)]",
  },
  epic: {
    text: "text-purple-400",
    bg: "bg-purple-950/40",
    border: "border-purple-500/30",
    glow: "shadow-[0_0_20px_rgba(168,85,247,0.3)]",
  },
  legendary: {
    text: "text-[#ffdb3c]",
    bg: "bg-yellow-950/30",
    border: "border-[#ffdb3c]/30",
    glow: "shadow-[0_0_30px_rgba(255,219,60,0.25)]",
  },
}

export const RARITY_LABELS: Record<string, string> = {
  common: "Común",
  rare: "Raro",
  epic: "Épico",
  legendary: "Legendario",
}

export const ACTIVITY_ICONS: Record<string, string> = {
  museum: "museum",
  restaurant: "restaurant",
  monument: "account_balance",
  park: "park",
  shopping: "shopping_bag",
  tour: "tour",
  hotel: "hotel",
  transport: "directions_transit",
}

export const XP_PER_LEVEL = 500

export const NAV_TABS = [
  { id: "home", label: "Home", icon: "home", href: "/home" },
  { id: "explore", label: "Explorar", icon: "explore", href: "/explore" },
  { id: "plan", label: "Plan", icon: "event_note", href: "/plan" },
  { id: "mapa", label: "Mapa", icon: "map", href: "/mapa" },
  { id: "ai", label: "IA", icon: "smart_toy", href: "/ai" },
  { id: "status", label: "Logros", icon: "emoji_events", href: "/status" },
] as const
