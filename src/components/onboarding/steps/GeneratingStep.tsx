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
  "Añadiendo toques mágicos...",
  "¡Casi listo!",
]

// Fake progress milestones (%) for each message index
const PROGRESS_MILESTONES = [10, 30, 55, 75, 90, 98]

interface GenerateResponse {
  trip: Trip
  days: DayItinerary[]
  tripId: string
}

interface GenerateResponseEnvelope {
  ok: true
  data: GenerateResponse
}

interface ErrorEnvelope {
  ok: false
  error: {
    message: string
  }
}

interface CelebrationData {
  days: number
  activities: number
  destination: string
}

export function GeneratingStep() {
  const router = useRouter()
  const { data, completeOnboarding } = useOnboardingStore()
  const { setCurrentTrip, setGeneratedItinerary } = useAppStore()
  const [messageIndex, setMessageIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [celebration, setCelebration] = useState<CelebrationData | null>(null)
  const [slowWarning, setSlowWarning] = useState(false)
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle")

  // Show slow warning after 30s of generating
  useEffect(() => {
    if (status !== "generating") return
    const t = setTimeout(() => setSlowWarning(true), 30000)
    return () => clearTimeout(t)
  }, [status])

  const generate = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    setMessageIndex(0)
    setProgress(0)
    setSlowWarning(false)
    setStatus("generating")

    let currentIndex = 0
    const interval = setInterval(() => {
      currentIndex = Math.min(currentIndex + 1, LOADING_MESSAGES.length - 1)
      setMessageIndex(currentIndex)
      setProgress(PROGRESS_MILESTONES[currentIndex] ?? 98)
    }, 1400)

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 120000)

    try {
      const res = await fetch("/api/itinerary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, language: navigator.language?.split("-")[0] || "es", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid" }),
        signal: abortController.signal,
      })

      clearTimeout(timeoutId)
      clearInterval(interval)

      if (!res.ok) {
        const errData = (await res.json()) as ErrorEnvelope
        throw new Error(errData.error.message ?? "Error generando itinerario")
      }

      const result = (await res.json()) as GenerateResponseEnvelope

      setCurrentTrip(result.data.trip)
      setGeneratedItinerary(result.data.days)
      setMessageIndex(LOADING_MESSAGES.length - 1)
      setProgress(100)
      setStatus("done")

      // Short pause to let progress bar reach 100%, then show celebration
      setTimeout(() => {
        const totalActivities = result.data.days.reduce(
          (acc, d) => acc + d.activities.length,
          0
        )
        setCelebration({
          days: result.data.days.length,
          activities: totalActivities,
          destination: result.data.trip.destination,
        })

        // After 1.5s celebration, redirect
        setTimeout(() => {
          completeOnboarding()
          router.replace("/plan")
        }, 1500)
      }, 600)
    } catch (err) {
      clearTimeout(timeoutId)
      clearInterval(interval)
      console.error("GeneratingStep error:", err)

      const isAbort = err instanceof Error && err.name === "AbortError"
      setError(
        isAbort
          ? "La generación tardó demasiado. Por favor inténtalo de nuevo."
          : err instanceof Error
          ? err.message
          : "Error desconocido"
      )
      setIsLoading(false)
      setStatus("error")
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
        <h1 className="text-xl font-bold text-[color:var(--on-surface)] mb-2 text-center">
          Algo salió mal
        </h1>
        <p className="text-sm text-[color:var(--on-surface-variant)] mb-8 text-center max-w-xs">{error}</p>
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

  if (celebration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen map-bg px-6">
        {/* Big animated emoji */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 1], opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8 text-8xl select-none"
        >
          ✈️
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-[28px] font-bold text-[color:var(--on-surface)] mb-3 text-center"
        >
          ¡Tu itinerario está listo!
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="text-[15px] text-[color:var(--on-surface-variant)] text-center capitalize"
        >
          {celebration.days} días · {celebration.activities} actividades · {celebration.destination}
        </motion.p>

        {/* Progress bar at 100% */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-xs mt-10"
        >
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: "100%", background: "linear-gradient(90deg, #0A84FF, #5856D6)" }}
            />
          </div>
          <p className="text-[11px] text-[color:var(--on-surface-variant)] text-right mt-1">100%</p>
        </motion.div>
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

      {/* Slow warning message */}
      {slowWarning && (
        <p className="text-[12px] text-[#888] text-center mt-2 animate-pulse">
          Esto está tardando un poco más... Gemini está trabajando en los detalles ✨
        </p>
      )}

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

      {/* Fake progress bar */}
      <div className="w-full max-w-xs mt-8">
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #0A84FF, #5856D6)" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <p className="text-[11px] text-[#9ca3af] text-right mt-1">{progress}%</p>
      </div>

      {/* Spinner for long waits */}
      {isLoading && messageIndex === LOADING_MESSAGES.length - 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4"
        >
          <div className="w-5 h-5 border-2 border-[#0A84FF]/30 border-t-[#0A84FF] rounded-full animate-spin" />
        </motion.div>
      )}
    </div>
  )
}
