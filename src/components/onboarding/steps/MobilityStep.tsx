"use client"

import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"
import { ChipSelector } from "../ui/ChipSelector"
import type { MobilityOption } from "@/lib/onboarding-types"

const chips: { id: MobilityOption; label: string; emoji: string }[] = [
  { id: "full", label: "Camino sin problema (15+ km/día)", emoji: "🚶" },
  { id: "moderate", label: "Ritmo moderado (8-12 km/día)", emoji: "🚶‍♂️" },
  { id: "frequent-rest", label: "Necesito descansos frecuentes", emoji: "🪑" },
  { id: "wheelchair", label: "Silla de ruedas / carrito", emoji: "♿" },
  { id: "reduced", label: "Movilidad reducida", emoji: "🦽" },
]

export function MobilityStep() {
  const { data, setField } = useOnboardingStore()

  return (
    <div>
      <StepHeader
        title="¿Cómo es vuestra movilidad?"
        subtitle="Planificamos rutas y distancias adaptadas a vuestras necesidades"
        emoji="🚶"
      />
      <div className="flex flex-col gap-3">
        {chips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => setField("mobility", chip.id)}
            className={`
              w-full p-4 rounded-2xl border text-left transition-all duration-200 flex items-center gap-3
              ${data.mobility === chip.id
                ? "border-[#0A84FF] bg-[#0A84FF]/10 glow-blue"
                : "border-white/6 bg-[var(--surface-container)] hover:border-white/15"
              }
            `}
          >
            <span className="text-2xl">{chip.emoji}</span>
            <span className="text-sm font-medium text-[color:var(--on-surface)]">{chip.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
