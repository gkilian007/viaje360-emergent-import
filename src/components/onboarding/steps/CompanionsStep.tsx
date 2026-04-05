"use client"

import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"
import { SelectionCard } from "../ui/SelectionCard"
import type { TravelCompanion } from "@/lib/onboarding-types"

const options: { id: TravelCompanion; emoji: string; label: string; sublabel: string }[] = [
  { id: "solo", emoji: "🧍", label: "Solo/a", sublabel: "Viajo a mi ritmo" },
  { id: "pareja", emoji: "💑", label: "Pareja", sublabel: "Escapada romántica" },
  { id: "familia", emoji: "👨‍👩‍👧‍👦", label: "Familia", sublabel: "Con niños o mayores" },
  { id: "amigos", emoji: "👯", label: "Amigos", sublabel: "Grupo de amigos" },
]

export function CompanionsStep() {
  const { data, setField } = useOnboardingStore()
  const needsCount = data.companion === "familia" || data.companion === "amigos"

  return (
    <div>
      <StepHeader
        title="¿Con quién viajas?"
        subtitle="Adaptamos cada recomendación a tu grupo"
        emoji="👥"
      />

      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <SelectionCard
            key={opt.id}
            emoji={opt.emoji}
            label={opt.label}
            sublabel={opt.sublabel}
            selected={data.companion === opt.id}
            onSelect={() => setField("companion", opt.id)}
          />
        ))}
      </div>

      {needsCount && (
        <div className="mt-5">
          <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-3">
            ¿Cuántos sois?
          </label>
          <div className="glass-panel p-4 flex items-center justify-between">
            <button
              onClick={() => setField("groupSize", Math.max(2, data.groupSize - 1))}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-[color:var(--on-surface)] hover:bg-white/20 transition-colors text-xl font-light"
            >
              −
            </button>
            <span className="text-2xl font-bold text-[color:var(--on-surface)]">{data.groupSize}</span>
            <button
              onClick={() => setField("groupSize", Math.min(20, data.groupSize + 1))}
              className="w-10 h-10 rounded-full bg-[#0A84FF]/20 flex items-center justify-center text-[#0A84FF] hover:bg-[#0A84FF]/30 transition-colors text-xl"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
