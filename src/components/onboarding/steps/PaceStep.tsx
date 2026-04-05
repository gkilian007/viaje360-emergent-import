"use client"

import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"
import { GlassSlider } from "../ui/GlassSlider"

export function PaceStep() {
  const { data, setField } = useOnboardingStore()

  return (
    <div>
      <StepHeader
        title="¿A qué ritmo viajas?"
        subtitle="Define cuántas actividades quieres por día"
        emoji="⏱️"
      />

      <div className="glass-card p-6 mt-4">
        <GlassSlider
          value={data.pace}
          onChange={(v) => setField("pace", v)}
          leftLabel="Tranquilo (2-3 actividades/día)"
          rightLabel="Intenso (6+ actividades/día)"
          leftEmoji="🐢"
          rightEmoji="🚀"
          gradient="from-[#0A84FF] to-[#ffdb3c]"
        />

        <div className="mt-5 text-center">
          {data.pace <= 33 && (
            <p className="text-sm text-[#0A84FF] font-medium">Ritmo relajado — tiempo para improvisar</p>
          )}
          {data.pace > 33 && data.pace <= 66 && (
            <p className="text-sm text-[color:var(--on-surface)] font-medium">Ritmo equilibrado — lo mejor de los dos mundos</p>
          )}
          {data.pace > 66 && (
            <p className="text-sm text-[#ffdb3c] font-medium">Ritmo intenso — ¡no te perderás nada!</p>
          )}
        </div>
      </div>
    </div>
  )
}
