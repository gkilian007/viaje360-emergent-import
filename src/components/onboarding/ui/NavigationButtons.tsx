"use client"

import { motion } from "framer-motion"

interface NavigationButtonsProps {
  onNext: () => void
  onBack?: () => void
  isNextValid: boolean
  isFirstStep: boolean
  isLastStep: boolean
  nextLabel?: string
}

export function NavigationButtons({
  onNext,
  onBack,
  isNextValid,
  isFirstStep,
  isLastStep,
  nextLabel,
}: NavigationButtonsProps) {
  return (
    <div className="flex items-center gap-3 mt-6">
      {!isFirstStep && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="flex-shrink-0 w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-[#c0c6d6] hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </motion.button>
      )}
      <motion.button
        data-onboarding-next
        whileTap={{ scale: isNextValid ? 0.97 : 1 }}
        onClick={isNextValid ? onNext : undefined}
        className={`
          flex-1 h-12 rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2
          ${isNextValid
            ? "bg-[#0A84FF] text-white glow-blue hover:bg-[#1a8fff]"
            : "bg-white/8 text-[#c0c6d6]/50 cursor-not-allowed"
          }
        `}
      >
        {isLastStep ? (
          <>
            {nextLabel || "Generar mi itinerario"}
            <span className="material-symbols-outlined text-lg">auto_awesome</span>
          </>
        ) : (
          <>
            {nextLabel || "Continuar"}
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </>
        )}
      </motion.button>
    </div>
  )
}
