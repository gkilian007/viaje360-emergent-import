"use client"

import { motion } from "framer-motion"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"
import type { BudgetLevel } from "@/lib/onboarding-types"

const budgets: { id: BudgetLevel; emoji: string; label: string; range: string; color: string; glowColor: string }[] = [
  { id: "economico", emoji: "💚", label: "Económico", range: "€50-100/día", color: "#30D158", glowColor: "rgba(48,209,88,0.2)" },
  { id: "moderado", emoji: "💛", label: "Moderado", range: "€100-200/día", color: "#ffdb3c", glowColor: "rgba(255,219,60,0.2)" },
  { id: "premium", emoji: "💎", label: "Premium", range: "€200+/día", color: "#0A84FF", glowColor: "rgba(10,132,255,0.2)" },
]

export function BudgetStep() {
  const { data, setField } = useOnboardingStore()

  return (
    <div>
      <StepHeader
        title="¿Cuál es tu presupuesto?"
        subtitle="Ajustamos restaurantes, tours y experiencias a tu bolsillo"
        emoji="💰"
      />

      <div className="flex flex-col gap-3">
        {budgets.map((budget) => {
          const isSelected = data.budget === budget.id
          return (
            <motion.button
              key={budget.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => setField("budget", budget.id)}
              className={`
                w-full p-5 rounded-3xl border text-left transition-all duration-200
                ${isSelected
                  ? "border-[#0A84FF] bg-[#0A84FF]/10"
                  : "border-white/6 bg-[var(--surface-container)] hover:border-white/15"
                }
              `}
              style={isSelected ? { boxShadow: `0 0 20px ${budget.glowColor}, 0 0 60px ${budget.glowColor}` } : {}}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{budget.emoji}</span>
                  <div>
                    <div className="font-semibold text-[color:var(--on-surface)]">{budget.label}</div>
                    <div className="text-sm text-[color:var(--on-surface-variant)] mt-0.5">{budget.range}</div>
                  </div>
                </div>
                {isSelected && (
                  <span className="material-symbols-outlined text-[#0A84FF] text-xl filled">check_circle</span>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
