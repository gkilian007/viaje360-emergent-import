"use client"

import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"
import { ChipSelector } from "../ui/ChipSelector"
import type { DietaryRestriction } from "@/lib/onboarding-types"

const chips: { id: DietaryRestriction; label: string; emoji: string }[] = [
  { id: "vegetariano", label: "Vegetariano", emoji: "🥬" },
  { id: "vegano", label: "Vegano", emoji: "🌱" },
  { id: "halal", label: "Halal", emoji: "🕌" },
  { id: "kosher", label: "Kosher", emoji: "✡️" },
  { id: "sin-gluten", label: "Sin gluten", emoji: "🚫🌾" },
  { id: "sin-lactosa", label: "Sin lactosa", emoji: "🚫🥛" },
  { id: "ninguna", label: "Ninguna restricción", emoji: "❌" },
]

export function DietaryStep() {
  const { data, setField } = useOnboardingStore()

  const handleToggle = (id: string) => {
    const current = data.dietary
    if (id === "ninguna") {
      setField("dietary", ["ninguna"] as DietaryRestriction[])
      return
    }
    const filtered = current.filter((d) => d !== "ninguna") as DietaryRestriction[]
    const typedId = id as DietaryRestriction
    if (filtered.includes(typedId)) {
      setField("dietary", filtered.filter((d) => d !== typedId))
    } else {
      setField("dietary", [...filtered, typedId])
    }
  }

  return (
    <div>
      <StepHeader
        title="¿Restricciones alimentarias?"
        subtitle="Solo recomendamos restaurantes que se adapten a tus necesidades"
        emoji="🍽️"
      />

      <ChipSelector
        chips={chips}
        selected={data.dietary}
        onToggle={handleToggle}
      />

      <div className="mt-5">
        <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
          Alergias específicas
        </label>
        <div className="glass-pill px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-[color:var(--on-surface-variant)] text-xl">warning</span>
          <input
            type="text"
            placeholder="Alergias específicas (ej: nueces, mariscos...)"
            value={data.allergies}
            onChange={(e) => setField("allergies", e.target.value)}
            className="flex-1 bg-transparent text-[color:var(--on-surface)] placeholder:text-[color:var(--on-surface-variant)] text-sm"
          />
        </div>
      </div>
    </div>
  )
}
