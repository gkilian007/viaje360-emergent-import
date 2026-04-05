import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { AppBootstrap } from "@/components/AppBootstrap"
import { ServiceWorkerProvider } from "@/components/ServiceWorkerProvider"
import { PHProvider } from "@/lib/analytics/posthog"
import { I18nProvider } from "@/lib/i18n-context"
import { ThemeProvider } from "@/lib/theme-context"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: {
    default: "Viaje360 — Planificador de viajes con IA",
    template: "%s | Viaje360",
  },
  description:
    "Planifica tu viaje perfecto con inteligencia artificial. Itinerarios personalizados, adaptación en tiempo real y momentos mágicos. Gratis los primeros 2 días.",
  keywords: [
    "planificador de viajes",
    "itinerario IA",
    "viajes con inteligencia artificial",
    "planificar viaje",
    "itinerario personalizado",
    "app de viajes",
  ],
  authors: [{ name: "Viaje360" }],
  creator: "Viaje360",
  publisher: "Viaje360",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://viaje360.app",
    siteName: "Viaje360",
    title: "Viaje360 — Planificador de viajes con IA",
    description:
      "Planifica tu viaje perfecto con inteligencia artificial. Itinerarios personalizados, adaptación en tiempo real.",
    images: [
      {
        url: "https://viaje360.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "Viaje360 — Tu compañero de viaje inteligente",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Viaje360 — Planificador de viajes con IA",
    description: "Planifica tu viaje perfecto con inteligencia artificial.",
    images: ["https://viaje360.app/og-image.png"],
  },
  alternates: {
    canonical: "https://viaje360.app",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Viaje360",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: "#131315",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} h-full`} style={{ colorScheme: "dark" }}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="h-full font-[family-name:var(--font-inter)] bg-[var(--surface)] text-[var(--on-surface)]">
        <PHProvider>
          <I18nProvider>
            <ThemeProvider>
              <AppBootstrap />
              <ServiceWorkerProvider />
              {children}
            </ThemeProvider>
          </I18nProvider>
        </PHProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Viaje360",
              description: "Planificador de viajes con inteligencia artificial",
              url: "https://viaje360.app",
              applicationCategory: "TravelApplication",
              operatingSystem: "Web, iOS, Android",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "EUR",
                description: "2 días gratis al llegar al destino",
              },
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                ratingCount: "1",
              },
            }),
          }}
        />
      </body>
    </html>
  )
}
