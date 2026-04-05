"use client"

import { motion } from "framer-motion"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"

export function FirstTimeStep() {
  const { data, setField } = useOnboardingStore()

  return (
    <div>
      <StepHeader
        title="¿Es tu primera vez aquí?"
        subtitle="Adaptamos el nivel de profundidad y orientación"
        emoji="🌍"
      />

      <div className="flex flex-col gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setField("firstTime", true)}
          className={`
            w-full p-6 rounded-3xl border text-left transition-all duration-200
            ${data.firstTime === true
              ? "border-[#0A84FF] bg-[#0A84FF]/10 glow-blue"
              : "border-white/6 bg-[var(--surface-container)] hover:border-white/15"
            }
          `}
        >
          <div className="text-3xl mb-2">🆕</div>
          <div className="font-semibold text-[color:var(--on-surface)]">Primera vez</div>
          <p className="text-sm text-[color:var(--on-surface-variant)] mt-1">
            Más highlights, orientación y contexto histórico
          </p>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setField("firstTime", false)}
          className={`
            w-full p-6 rounded-3xl border text-left transition-all duration-200
            ${data.firstTime === false
              ? "border-[#0A84FF] bg-[#0A84FF]/10 glow-blue"
              : "border-white/6 bg-[var(--surface-container)] hover:border-white/15"
            }
          `}
        >
          <div className="text-3xl mb-2">🔄</div>
          <div className="font-semibold text-[color:var(--on-surface)]">Ya conozco el destino</div>
          <p className="text-sm text-[color:var(--on-surface-variant)] mt-1">
            Más joyitas, lugares profundos y fuera de ruta
          </p>
        </motion.button>
      </div>
    </div>
  )
}
