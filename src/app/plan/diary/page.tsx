"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { useAppStore } from "@/store/useAppStore"
import { DiaryConversation } from "@/components/features/diary"

interface DiaryData {
  mood: string | null
  energyScore: number
  paceScore: number
  activityFeedback: {
    activityId: string
    liked: boolean | null
    wouldRepeat: boolean | null
    notes: string
  }[]
  freeTextSummary: string
  wouldRepeat: boolean | null
  conversation: {
    id: string
    role: "assistant" | "user"
    content: string
  }[]
}

function DiaryPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentTrip, generatedItinerary } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setHydrated(true)
  }, [])

  // Get day from URL or default to last day
  const dayParam = searchParams.get("day")
  const dayNumber = dayParam ? parseInt(dayParam, 10) : (generatedItinerary?.length ?? 1)
  const dayItinerary = generatedItinerary?.[dayNumber - 1]
  const activities = dayItinerary?.activities ?? []

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-[#c0c6d6] text-sm">Cargando...</div>
      </div>
    )
  }

  if (!currentTrip || !generatedItinerary || generatedItinerary.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center px-6 text-center">
        <span className="material-symbols-outlined text-[56px] text-[#5856D6] mb-4">auto_stories</span>
        <h1 className="text-[22px] font-bold text-white mb-2">Sin viaje activo</h1>
        <p className="text-[#c0c6d6] max-w-sm mb-6">
          Necesitas tener un viaje activo para escribir en tu diario.
        </p>
        <button
          onClick={() => router.push("/plan")}
          className="px-5 py-3 rounded-2xl font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #5856D6, #AF52DE)" }}
        >
          Ir a mi viaje
        </button>
      </div>
    )
  }

  if (dayNumber < 1 || dayNumber > generatedItinerary.length) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center px-6 text-center">
        <span className="material-symbols-outlined text-[56px] text-[#FF453A] mb-4">error</span>
        <h1 className="text-[22px] font-bold text-white mb-2">Día no encontrado</h1>
        <p className="text-[#c0c6d6] max-w-sm mb-6">
          El día {dayNumber} no existe en tu itinerario.
        </p>
        <button
          onClick={() => router.push("/plan")}
          className="px-5 py-3 rounded-2xl font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
        >
          Volver al plan
        </button>
      </div>
    )
  }

  const handleComplete = async (data: DiaryData) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: currentTrip.id,
          dayNumber,
          date: dayItinerary?.date ?? new Date().toISOString().split("T")[0],
          mood: data.mood,
          energyScore: data.energyScore,
          paceScore: data.paceScore,
          freeTextSummary: data.freeTextSummary,
          wouldRepeat: data.wouldRepeat,
          conversation: data.conversation.map(({ role, content }) => ({ role, content })),
          activityFeedback: data.activityFeedback,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Error al guardar el diario")
      }

      // Navigate back to plan with success message
      router.push(`/plan?diary=saved&day=${dayNumber}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el diario")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    router.push("/plan")
  }

  return (
    <>
      <div className="lg:hidden flex flex-col h-screen bg-[#0f1117]">
        <DiaryConversation
          dayNumber={dayNumber}
          date={dayItinerary?.date ?? new Date().toISOString().split("T")[0]}
          activities={activities}
          onComplete={handleComplete}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-4 left-4 right-4 p-4 rounded-2xl bg-[#FF453A]/20 border border-[#FF453A]/30 z-50"
          >
            <p className="text-[#FF453A] text-[13px] text-center">{error}</p>
          </motion.div>
        )}
      </div>

      {/* Desktop - same layout for now */}
      <div className="hidden lg:flex flex-col h-screen bg-[#0f1117]">
        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
          <DiaryConversation
            dayNumber={dayNumber}
            date={dayItinerary?.date ?? new Date().toISOString().split("T")[0]}
            activities={activities}
            onComplete={handleComplete}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        </div>
      </div>
    </>
  )
}

export default function DiaryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-[#c0c6d6] text-sm">Cargando...</div>
      </div>
    }>
      <DiaryPageContent />
    </Suspense>
  )
}
