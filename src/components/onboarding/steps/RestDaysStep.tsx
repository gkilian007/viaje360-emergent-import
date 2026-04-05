"use client"

import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"
import type { RestDayFrequency } from "@/lib/onboarding-types"

const freqOptions: { id: RestDayFrequency; label: string }[] = [
  { id: "un-dia", label: "Solo un día libre" },
  { id: "cada-2", label: "Cada 2 días" },
  { id: "cada-3", label: "Cada 3 días" },
  { id: "ultimo", label: "El último día" },
]

export function RestDaysStep() {
  const { data, setField } = useOnboardingStore()

  return (
    <div>
      <StepHeader
        title="¿Días de descanso?"
        subtitle="Los días libres son perfectos para explorar sin agenda"
        emoji="😴"
      />

      <div className="glass-card p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-[color:var(--on-surface)]">¿Quieres días libres intercalados?</p>
            <p className="text-xs text-[color:var(--on-surface-variant)] mt-0.5">Sin planificar — solo explorar</p>
          </div>
          <button
            onClick={() => setField("wantsRestDays", !data.wantsRestDays)}
            className={`
              relative w-12 h-6 rounded-full transition-all duration-200
              ${data.wantsRestDays ? "bg-[#0A84FF]" : "bg-white/15"}
            `}
          >
            <div
              className={`
                absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200
                ${data.wantsRestDays ? "left-6.5" : "left-0.5"}
              `}
            />
          </button>
        </div>
      </div>

      {data.wantsRestDays && (
        <div className="flex flex-col gap-2">
          {freqOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setField("restDayFrequency", opt.id)}
              className={`
                w-full p-4 rounded-2xl border text-left text-sm font-medium transition-all duration-200
                ${data.restDayFrequency === opt.id
                  ? "border-[#0A84FF] bg-[#0A84FF]/10 text-[#0A84FF]"
                  : "border-white/6 bg-[var(--surface-container)] text-[color:var(--on-surface-variant)] hover:border-white/15"
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
