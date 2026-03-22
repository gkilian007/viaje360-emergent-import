"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { useAppStore } from "@/store/useAppStore"
import type { DayItinerary, Trip } from "@/lib/types"

const LOADING_MESSAGES = [
  "Analizando tu destino...",
  "Optimizando rutas...",
  "Buscando los mejores sitios...",
  "Personalizando tu experiencia...",
  "¡Casi listo!",
]

interface GenerateResponse {
  trip: Trip
  days: DayItinerary[]
  tripId: string
}

export function GeneratingStep() {
  const router = useRouter()
  const { data, completeOnboarding } = useOnboardingStore()
  const { setCurrentTrip, setGeneratedItinerary } = useAppStore()
  const [messageIndex, setMessageIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const generate = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    setMessageIndex(0)

    const interval = setInterval(() => {
      setMessageIndex((i) => (i < LOADING_MESSAGES.length - 1 ? i + 1 : i))
    }, 1400)

    try {
      const res = await fetch("/api/itinerary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      clearInterval(interval)

      if (!res.ok) {
        const errData = await res.json() as { error?: string }
        throw new Error(errData.error ?? "Error generando itinerario")
      }

      const result = await res.json() as GenerateResponse

      setCurrentTrip(result.trip)
      setGeneratedItinerary(result.days)
      setMessageIndex(LOADING_MESSAGES.length - 1)

      setTimeout(() => {
        completeOnboarding()
        router.replace("/plan")
      }, 600)
    } catch (err) {
      clearInterval(interval)
      console.error("GeneratingStep error:", err)
      setError(err instanceof Error ? err.message : "Error desconocido")
      setIsLoading(false)
    }
  }, [data, completeOnboarding, router, setCurrentTrip, setGeneratedItinerary])

  useEffect(() => {
    generate()
  }, [generate])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen map-bg px-6">
        <div className="w-24 h-24 rounded-3xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-8">
          <span className="material-symbols-outlined text-red-400 text-5xl">error</span>
        </div>
        <h1 className="text-xl font-bold text-[#e4e2e4] mb-2 text-center">
          Algo salió mal
        </h1>
        <p className="text-sm text-[#c0c6d6] mb-8 text-center max-w-xs">{error}</p>
        <button
          onClick={generate}
          className="px-6 py-3 rounded-2xl font-semibold text-white transition-all hover:scale-105 active:scale-95"
          style={{ background: "#0A84FF" }}
        >
          Intentar de nuevo
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen map-bg px-6">
      {/* Logo / Icon */}
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="mb-10"
      >
        <div className="w-24 h-24 rounded-3xl bg-[#0A84FF]/20 border border-[#0A84FF]/30 flex items-center justify-center glow-blue">
          <span className="material-symbols-outlined text-[#0A84FF] text-5xl filled">travel_explore</span>
        </div>
      </motion.div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-[#e4e2e4] mb-2 text-center">
        Generando tu itinerario
      </h1>
      <p className="text-sm text-[#c0c6d6] mb-10 text-center">
        Nuestro AI está creando una experiencia única para ti
      </p>

      {/* Animated message */}
      <div className="h-8 flex items-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-[#0A84FF] font-medium text-base"
          >
            {LOADING_MESSAGES[messageIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2 mt-8">
        {LOADING_MESSAGES.map((_, i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full"
            animate={{
              backgroundColor: i <= messageIndex ? "#0A84FF" : "rgba(255,255,255,0.15)",
              scale: i === messageIndex ? 1.3 : 1,
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>

      {/* Spinner for long waits */}
      {isLoading && messageIndex === LOADING_MESSAGES.length - 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8"
        >
          <div className="w-5 h-5 border-2 border-[#0A84FF]/30 border-t-[#0A84FF] rounded-full animate-spin" />
        </motion.div>
      )}
    </div>
  )
}
