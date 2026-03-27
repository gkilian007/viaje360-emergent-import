"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"

interface ActivitySnap {
  name: string
  type: string
  emoji: string
  time: string
}

interface DayRecap {
  dayNumber: number
  activities: ActivitySnap[]
  journal: {
    mood: string | null
    moodEmoji: string
    energyScore: number | null
    paceScore: number | null
    summary: string | null
    wouldRepeat: boolean | null
  } | null
}

interface RecapData {
  trip: {
    id: string
    name: string
    destination: string
    country: string
    startDate: string
    endDate: string
    status: string
  }
  days: DayRecap[]
  aiNarrative: string | null
  hasDiaryData: boolean
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }
  return `${s.toLocaleDateString("es-ES", opts)} – ${e.toLocaleDateString("es-ES", opts)}, ${e.getFullYear()}`
}

function EnergyDots({ score }: { score: number | null }) {
  if (!score) return null
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ background: i <= score ? "#30D158" : "rgba(255,255,255,0.1)" }}
        />
      ))}
    </div>
  )
}

export default function RecapPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const router = useRouter()
  const [data, setData] = useState<RecapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!tripId) return
    fetch(`/api/diary/recap?tripId=${tripId}`)
      .then(r => r.json())
      .then(res => {
        if (res.data) setData(res.data)
        else setError("No se pudo cargar el recap")
      })
      .catch(() => setError("Error de red"))
      .finally(() => setLoading(false))
  }, [tripId])

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Mi viaje a ${data?.trip.destination}`,
          text: `¡Mira el recap de mi viaje a ${data?.trip.destination}! 🌍✈️`,
          url,
        })
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[40px] text-[#0A84FF] animate-pulse">auto_stories</span>
          <p className="text-[#888] text-[14px]">Preparando tu viaje...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6 text-center">
        <div>
          <span className="text-[56px]">😕</span>
          <p className="text-white text-[18px] font-bold mt-4 mb-2">No encontrado</p>
          <p className="text-[#888] text-[13px] mb-6">{error ?? "Este recap no existe"}</p>
          <button onClick={() => router.push("/plan")} className="text-[#0A84FF] text-[13px]">← Volver al plan</button>
        </div>
      </div>
    )
  }

  const { trip, days, aiNarrative, hasDiaryData } = data
  const totalActivities = days.reduce((s, d) => s + d.activities.length, 0)

  return (
    <div className="min-h-screen bg-[#0a0a0f]" style={{ fontFamily: "system-ui, sans-serif" }}>

      {/* ─── Hero ─── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, rgba(10,132,255,0.25) 0%, rgba(88,86,214,0.20) 50%, rgba(191,90,242,0.15) 100%)",
          minHeight: "340px",
        }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.4) 1px, transparent 0)", backgroundSize: "32px 32px" }}
        />

        <div className="relative z-10 max-w-xl mx-auto px-6 pt-14 pb-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-[12px] text-[#0A84FF] font-semibold uppercase tracking-widest mb-3">Mi viaje</p>
            <h1 className="text-[42px] font-black text-white leading-none mb-2 capitalize">{trip.destination}</h1>
            <p className="text-[16px] text-[#c0c6d6] mb-6">{trip.country} · {formatDateRange(trip.startDate, trip.endDate)}</p>

            {/* Stats row */}
            <div className="flex gap-5 flex-wrap">
              {[
                { icon: "📅", label: `${days.length} días` },
                { icon: "📍", label: `${totalActivities} actividades` },
                { icon: "✍️", label: hasDiaryData ? `${days.filter(d => d.journal).length} entradas de diario` : "Sin diario aún" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className="text-[15px]">{s.icon}</span>
                  <span className="text-[13px] text-[#c0c6d6]">{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 py-6 space-y-5">

        {/* ─── AI Narrative ─── */}
        {aiNarrative && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-5 rounded-2xl"
            style={{ background: "rgba(191,90,242,0.07)", border: "1px solid rgba(191,90,242,0.18)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[18px]">✨</span>
              <p className="text-[12px] font-semibold text-[#BF5AF2] uppercase tracking-wider">Tu historia</p>
            </div>
            <p className="text-[15px] text-[#e0e6f0] leading-relaxed italic">&ldquo;{aiNarrative}&rdquo;</p>
          </motion.div>
        )}

        {/* ─── Day by day ─── */}
        {days.map((day, idx) => (
          <motion.div
            key={day.dayNumber}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + idx * 0.08 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(22,22,30,0.95)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {/* Day header */}
            <div className="px-4 pt-4 pb-3 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div>
                <p className="text-[11px] text-[#666] uppercase tracking-widest font-medium">Día {day.dayNumber}</p>
                <p className="text-[15px] font-bold text-white">{day.activities.length} actividades</p>
              </div>
              {day.journal && (
                <div className="flex items-center gap-2">
                  <span className="text-[22px]">{day.journal.moodEmoji}</span>
                  <EnergyDots score={day.journal.energyScore} />
                </div>
              )}
            </div>

            {/* Activities list */}
            <div className="px-4 py-3 space-y-2">
              {day.activities.map((act, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[18px] w-7 text-center shrink-0">{act.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white font-medium truncate">{act.name}</p>
                  </div>
                  <span className="text-[11px] text-[#555] shrink-0">{act.time}</span>
                </div>
              ))}
            </div>

            {/* Journal summary */}
            {day.journal?.summary && (
              <div className="px-4 pb-4">
                <div className="mt-2 p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-[12px] text-[#999] leading-relaxed">&ldquo;{day.journal.summary}&rdquo;</p>
                  {day.journal.wouldRepeat !== null && (
                    <p className="text-[11px] mt-2 text-[#666]">
                      {day.journal.wouldRepeat ? "✅ Lo repetiría" : "🤔 No lo repetiría"}
                    </p>
                  )}
                </div>
              </div>
            )}

            {!day.journal && (
              <div className="px-4 pb-4">
                <p className="text-[11px] text-[#444] italic">Sin entrada de diario para este día</p>
              </div>
            )}
          </motion.div>
        ))}

        {/* ─── Share button ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="pb-10"
        >
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-[15px] text-white transition-all"
            style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
          >
            <span className="material-symbols-outlined text-[20px]">
              {copied ? "check_circle" : "share"}
            </span>
            {copied ? "¡Enlace copiado!" : "Compartir este viaje"}
          </button>

          <button
            onClick={() => router.push("/plan")}
            className="w-full mt-3 py-3 text-[13px] text-[#666] hover:text-[#aaa] transition-colors"
          >
            ← Volver al plan
          </button>
        </motion.div>
      </div>
    </div>
  )
}
