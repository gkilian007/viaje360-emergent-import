"use client"

import { motion } from "framer-motion"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"
import type { Interest } from "@/lib/onboarding-types"

const interests: { id: Interest; label: string; emoji: string }[] = [
  { id: "historia", label: "Historia y cultura", emoji: "🏛️" },
  { id: "gastronomia", label: "Gastronomía", emoji: "🍷" },
  { id: "playa", label: "Playa y relax", emoji: "🌊" },
  { id: "nocturna", label: "Vida nocturna", emoji: "🎉" },
  { id: "aventura", label: "Aventura / outdoor", emoji: "🥾" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "fotografia", label: "Fotografía", emoji: "📸" },
  { id: "arte", label: "Arte y museos", emoji: "🎨" },
  { id: "naturaleza", label: "Naturaleza", emoji: "🌿" },
  { id: "familiar", label: "Actividades familiares", emoji: "👨‍👩‍👧" },
  { id: "deportes", label: "Deportes", emoji: "🏃" },
  { id: "bienestar", label: "Bienestar / spa", emoji: "🧘" },
]

export function InterestsStep() {
  const { data, setField } = useOnboardingStore()

  const toggle = (id: Interest) => {
    const current = data.interests
    if (current.includes(id)) {
      setField("interests", current.filter((i) => i !== id))
    } else {
      setField("interests", [...current, id])
    }
  }

  return (
    <div>
      <StepHeader
        title="¿Qué te apasiona?"
        subtitle="Selecciona todo lo que quieras explorar"
        emoji="✨"
      />

      <div className="grid grid-cols-3 gap-2.5">
        {interests.map((item) => {
          const isSelected = data.interests.includes(item.id)
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.94 }}
              onClick={() => toggle(item.id)}
              className={`
                aspect-square rounded-2xl border p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-200
                ${isSelected
                  ? "border-[#0A84FF] bg-[#0A84FF]/12 glow-blue ring-1 ring-[#0A84FF]/20"
                  : "border-white/6 bg-[var(--surface-container)] hover:border-white/15"
                }
              `}
            >
              <span className="text-3xl">{item.emoji}</span>
              <span className={`text-[16px] font-medium text-center leading-tight ${isSelected ? "text-[#0A84FF]" : "text-[color:var(--on-surface-variant)]"}`}>
                {item.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
