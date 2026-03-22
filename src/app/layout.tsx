import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { AppBootstrap } from "@/components/AppBootstrap"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Viaje360",
  description: "Tu compañero de viaje inteligente",
  manifest: "/manifest.json",
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
      <body className="h-full overflow-hidden bg-[#131315] text-[#e4e2e4] font-[family-name:var(--font-inter)]">
        <AppBootstrap />
        {children}
      </body>
    </html>
  )
}
