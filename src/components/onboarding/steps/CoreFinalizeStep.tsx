"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"

export function CoreFinalizeStep() {
  const { data, setField, advancedExpanded, setAdvancedExpanded } = useOnboardingStore()

  return (
    <div>
      <StepHeader
        title="¿Algo más?"
        subtitle="Cuéntanos lo que no podemos ignorar"
        emoji="📝"
      />

      <div className="space-y-4">
        {/* First time toggle */}
        <div>
          <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-3">
            ¿Es tu primera vez en el destino?
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setField("firstTime", true)}
              className={`
                flex-1 py-3 px-4 rounded-2xl border text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
                ${data.firstTime === true
                  ? "border-[#0A84FF] bg-[#0A84FF]/15 text-[#0A84FF]"
                  : "border-white/8 bg-[var(--surface-container)] text-[color:var(--on-surface-variant)] hover:border-white/20"
                }
              `}
            >
              🆕 Primera vez
            </button>
            <button
              onClick={() => setField("firstTime", false)}
              className={`
                flex-1 py-3 px-4 rounded-2xl border text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
                ${data.firstTime === false
                  ? "border-[#0A84FF] bg-[#0A84FF]/15 text-[#0A84FF]"
                  : "border-white/8 bg-[var(--surface-container)] text-[color:var(--on-surface-variant)] hover:border-white/20"
                }
              `}
            >
              🔄 Ya conozco
            </button>
          </div>
        </div>

        {/* Must see */}
        <div>
          <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
            Lugares imprescindibles <span className="text-[color:var(--on-surface)]/30 normal-case font-normal">(opcional)</span>
          </label>
          <div className="glass-panel p-4">
            <textarea
              rows={2}
              placeholder="Ej: La Sagrada Familia, el barrio gótico..."
              value={data.mustSee}
              onChange={(e) => setField("mustSee", e.target.value)}
              className="w-full bg-transparent text-[color:var(--on-surface)] placeholder:text-[color:var(--on-surface-variant)] text-sm resize-none"
            />
          </div>
        </div>

        {/* Must avoid */}
        <div>
          <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
            ¿Algo que prefieras evitar? <span className="text-[color:var(--on-surface)]/30 normal-case font-normal">(opcional)</span>
          </label>
          <div className="glass-panel p-4">
            <textarea
              rows={2}
              placeholder="Ej: Sitios masificados, museos, comida picante..."
              value={data.mustAvoid}
              onChange={(e) => setField("mustAvoid", e.target.value)}
              className="w-full bg-transparent text-[color:var(--on-surface)] placeholder:text-[color:var(--on-surface-variant)] text-sm resize-none"
            />
          </div>
        </div>


      </div>
    </div>
  )
}
