import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Viaje360 — Tu viaje perfecto, diseñado por IA",
  description:
    "Itinerarios personalizados que se adaptan en tiempo real a ti, al clima y al momento. Gratis los primeros 2 días.",
}

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Clean layout — no BottomNav, no TopAppBar
  return <>{children}</>
}
