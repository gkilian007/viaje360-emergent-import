"use client"

import { useState, useEffect, useRef } from "react"
import { useAnalytics } from "@/lib/analytics/useAnalytics"
import { AnimatePresence, motion } from "framer-motion"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { ProgressBar } from "./ui/ProgressBar"
import { NavigationButtons } from "./ui/NavigationButtons"
// Core new steps
import { CoreDestinationStep } from "./steps/CoreDestinationStep"
import { CoreCompanionsStep } from "./steps/CoreCompanionsStep"
import { CoreFinalizeStep } from "./steps/CoreFinalizeStep"
// Reused steps (core)
import { InterestsStep } from "./steps/InterestsStep"
import { BudgetStep } from "./steps/BudgetStep"
// Advanced (optional) steps
import { AccommodationStep } from "./steps/AccommodationStep"
import { TravelerStyleStep } from "./steps/TravelerStyleStep"
import { FamousLocalStep } from "./steps/FamousLocalStep"
import { PaceStep } from "./steps/PaceStep"
import { RestDaysStep } from "./steps/RestDaysStep"
import { DayStyleStep } from "./steps/DayStyleStep"
import { SplurgeStep } from "./steps/SplurgeStep"
import { DietaryStep } from "./steps/DietaryStep"
import { TransportStep } from "./steps/TransportStep"
import { WeatherStep } from "./steps/WeatherStep"
import { MobilityStep } from "./steps/MobilityStep"
// Legacy steps (kept for backward compat)
import { DestinationStep } from "./steps/DestinationStep"
import { CompanionsStep } from "./steps/CompanionsStep"
import { KidsPetsStep } from "./steps/KidsPetsStep"
import { FirstTimeStep } from "./steps/FirstTimeStep"
import { MustSeeStep } from "./steps/MustSeeStep"
import { GeneratingStep } from "./steps/GeneratingStep"
import type { StepId } from "@/lib/onboarding-types"

function StepContent({ stepId }: { stepId: StepId }) {
  switch (stepId) {
    // Core 5-step flow
    case "core-destination": return <CoreDestinationStep />
    case "core-companions": return <CoreCompanionsStep />
    case "interests": return <InterestsStep />
    case "budget": return <BudgetStep />
    case "core-finalize": return <CoreFinalizeStep />
    // Advanced optional steps
    case "accommodation": return <AccommodationStep />
    case "traveler-style": return <TravelerStyleStep />
    case "famous-local": return <FamousLocalStep />
    case "pace": return <PaceStep />
    case "rest-days": return <RestDaysStep />
    case "day-style": return <DayStyleStep />
    case "splurge": return <SplurgeStep />
    case "dietary": return <DietaryStep />
    case "transport": return <TransportStep />
    case "weather": return <WeatherStep />
    case "mobility": return <MobilityStep />
    // Legacy (kept for backward compat)
    case "destination": return <DestinationStep />
    case "companions": return <CompanionsStep />
    case "kids-pets": return <KidsPetsStep />
    case "first-time": return <FirstTimeStep />
    case "must-see": return <MustSeeStep />
    default: return null
  }
}

const CORE_STEP_COUNT = 5

const slideVariants = {
  enterFromRight: { x: "100%", opacity: 0 },
  enterFromLeft: { x: "-100%", opacity: 0 },
  center: { x: 0, opacity: 1 },
  exitToLeft: { x: "-60%", opacity: 0 },
  exitToRight: { x: "60%", opacity: 0 },
}

export function OnboardingWizard() {
  const {
    currentStepId,
    direction,
    getProgress,
    getCurrentStepIndex,
    getTotalSteps,
    isStepValid,
    isInAdvanced,
    nextStep,
    prevStep,
    advancedExpanded,
    getVisibleSteps,
  } = useOnboardingStore()

  const [generating, setGenerating] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [honeypot, setHoneypot] = useState("")
  const { track } = useAnalytics()
  const startTracked = useRef(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && !startTracked.current) {
      startTracked.current = true
      track("onboarding_started")
    }
  }, [hydrated, track])

  if (!hydrated) {
    return (
      <div className="min-h-screen map-bg flex items-center justify-center">
        <div className="text-[#c0c6d6] text-sm">Cargando...</div>
      </div>
    )
  }

  const progress = getProgress()
  const currentIndex = getCurrentStepIndex()
  const visibleSteps = getVisibleSteps()
  const isFirstStep = currentIndex === 0
  const isLastStep = currentIndex === visibleSteps.length - 1
  const inAdvanced = isInAdvanced()

  // Step 5 (core-finalize) without advanced expanded = last step → trigger generation
  const isCoreLastStep = currentStepId === "core-finalize" && !advancedExpanded

  const handleNext = () => {
    if (isLastStep || isCoreLastStep) {
      if (honeypot) return // bot detected — silently drop
      track("onboarding_completed")
      setGenerating(true)
    } else {
      nextStep()
    }
  }

  if (generating) {
    return <GeneratingStep />
  }

  // Display step counter
  const coreIndex = ["core-destination", "core-companions", "interests", "budget", "core-finalize"].indexOf(currentStepId)
  const displayStep = inAdvanced
    ? `Avanzado ${visibleSteps.indexOf(currentStepId) - CORE_STEP_COUNT + 1}/${visibleSteps.length - CORE_STEP_COUNT}`
    : `${coreIndex + 1} / ${CORE_STEP_COUNT}`

  return (
    <div className="h-dvh map-bg flex flex-col overflow-hidden lg:items-center lg:justify-center">
    <div className="flex flex-col h-full lg:h-auto lg:max-h-[90vh] lg:w-full lg:max-w-[540px] lg:rounded-3xl lg:border lg:border-white/10 lg:bg-[#131315]/95 lg:backdrop-blur-xl lg:shadow-2xl lg:overflow-hidden">
      {/* Honeypot: hidden from real users, catches bots that autofill */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 0, height: 0, opacity: 0 }}
        autoComplete="off"
      />
      {/* Top bar: progress + step count */}
      <div className="safe-area-top px-5 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <img src="/logo.svg" alt="Viaje360" className="w-5 h-5 rounded-md"/>
            <span className="text-xs text-[#c0c6d6]">Viaje360</span>
          </div>
          <span className="text-xs text-[#c0c6d6]">
            {displayStep}
          </span>
        </div>
        <ProgressBar progress={progress} />
        {inAdvanced && (
          <p className="text-[10px] text-[#c0c6d6]/50 text-center mt-1">Personalización avanzada</p>
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStepId}
            custom={direction}
            variants={slideVariants}
            initial={direction > 0 ? "enterFromRight" : "enterFromLeft"}
            animate="center"
            exit={direction > 0 ? "exitToLeft" : "exitToRight"}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="pt-4"
          >
            <StepContent stepId={currentStepId} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="px-5 pb-8 pt-4 flex-shrink-0" style={{ background: "linear-gradient(to top, #131315 70%, transparent)" }}>
        <NavigationButtons
          onNext={handleNext}
          onBack={prevStep}
          isNextValid={isStepValid()}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep || isCoreLastStep}
        />
      </div>
    </div>
    </div>
  )
}
