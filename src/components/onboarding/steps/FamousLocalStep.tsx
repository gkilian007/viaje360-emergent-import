"use client"

import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"
import { GlassSlider } from "../ui/GlassSlider"

export function FamousLocalStep() {
  const { data, setField } = useOnboardingStore()

  return (
    <div>
      <StepHeader
        title="¿Turístico o auténtico?"
        subtitle="Ajusta el equilibrio entre lo imprescindible y lo local"
        emoji="🗼"
      />

      <div className="glass-card p-6 mt-4">
        <GlassSlider
          value={data.famousLocal}
          onChange={(v) => setField("famousLocal", v)}
          leftLabel="Lo imprescindible"
          rightLabel="Lo auténtico"
          leftEmoji="🗼"
          rightEmoji="🏘️"
          gradient="from-[#ffdb3c] to-[#0A84FF]"
        />

        <div className="mt-5 text-center">
          {data.famousLocal <= 25 && (
            <p className="text-sm text-[color:var(--on-surface-variant)]">Principalmente <span className="text-[#ffdb3c] font-medium">highlights turísticos</span></p>
          )}
          {data.famousLocal > 25 && data.famousLocal <= 50 && (
            <p className="text-sm text-[color:var(--on-surface-variant)]">Mezcla con <span className="text-[color:var(--on-surface)] font-medium">más turístico</span></p>
          )}
          {data.famousLocal > 50 && data.famousLocal <= 75 && (
            <p className="text-sm text-[color:var(--on-surface-variant)]">Mezcla con <span className="text-[#0A84FF] font-medium">más local</span></p>
          )}
          {data.famousLocal > 75 && (
            <p className="text-sm text-[color:var(--on-surface-variant)]">Principalmente <span className="text-[#0A84FF] font-medium">joyitas locales</span></p>
          )}
        </div>
      </div>
    </div>
  )
}
