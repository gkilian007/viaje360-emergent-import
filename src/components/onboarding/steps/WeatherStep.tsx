"use client"

import { motion } from "framer-motion"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"

export function WeatherStep() {
  const { data, setField } = useOnboardingStore()

  return (
    <div>
      <StepHeader
        title="¿Adaptamos al tiempo?"
        subtitle="Si llueve o hace +35°C, replanificamos actividades al aire libre"
        emoji="⛅"
      />

      <div className="flex flex-col gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setField("weatherAdaptation", true)}
          className={`
            w-full p-5 rounded-3xl border text-left transition-all duration-200
            ${data.weatherAdaptation
              ? "border-[#0A84FF] bg-[#0A84FF]/10 glow-blue"
              : "border-white/6 bg-[var(--surface-container)] hover:border-white/15"
            }
          `}
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">🔄</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[color:var(--on-surface)]">Sí, adapta mi plan</span>
                <span className="text-[10px] bg-[#30D158]/20 text-[#30D158] px-2 py-0.5 rounded-full font-medium">Recomendado</span>
              </div>
              <p className="text-sm text-[color:var(--on-surface-variant)] mt-1">Si cambia el tiempo, reorganizamos actividades al aire libre</p>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setField("weatherAdaptation", false)}
          className={`
            w-full p-5 rounded-3xl border text-left transition-all duration-200
            ${!data.weatherAdaptation
              ? "border-[#0A84FF] bg-[#0A84FF]/10 glow-blue"
              : "border-white/6 bg-[var(--surface-container)] hover:border-white/15"
            }
          `}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">📌</span>
            <div>
              <div className="font-semibold text-[color:var(--on-surface)]">No, mantén el plan original</div>
              <p className="text-sm text-[color:var(--on-surface-variant)] mt-0.5">Sin cambios aunque llueva</p>
            </div>
          </div>
        </motion.button>
      </div>
    </div>
  )
}
