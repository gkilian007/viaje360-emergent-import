"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useOnboardingStore } from "@/store/useOnboardingStore"
import { ProgressBar } from "./ui/ProgressBar"
import { NavigationButtons } from "./ui/NavigationButtons"
import { DestinationStep } from "./steps/DestinationStep"
import { CompanionsStep } from "./steps/CompanionsStep"
import { KidsPetsStep } from "./steps/KidsPetsStep"
import { MobilityStep } from "./steps/MobilityStep"
import { AccommodationStep } from "./steps/AccommodationStep"
import { InterestsStep } from "./steps/InterestsStep"
import { TravelerStyleStep } from "./steps/TravelerStyleStep"
import { FamousLocalStep } from "./steps/FamousLocalStep"
import { PaceStep } from "./steps/PaceStep"
import { RestDaysStep } from "./steps/RestDaysStep"
import { DayStyleStep } from "./steps/DayStyleStep"
import { BudgetStep } from "./steps/BudgetStep"
import { SplurgeStep } from "./steps/SplurgeStep"
import { DietaryStep } from "./steps/DietaryStep"
import { TransportStep } from "./steps/TransportStep"
import { WeatherStep } from "./steps/WeatherStep"
import { FirstTimeStep } from "./steps/FirstTimeStep"
import { MustSeeStep } from "./steps/MustSeeStep"
import { GeneratingStep } from "./steps/GeneratingStep"
import type { StepId } from "@/lib/onboarding-types"

function StepContent({ stepId }: { stepId: StepId }) {
  switch (stepId) {
    case "destination": return <DestinationStep />
    case "companions": return <CompanionsStep />
    case "kids-pets": return <KidsPetsStep />
    case "mobility": return <MobilityStep />
    case "accommodation": return <AccommodationStep />
    case "interests": return <InterestsStep />
    case "traveler-style": return <TravelerStyleStep />
    case "famous-local": return <FamousLocalStep />
    case "pace": return <PaceStep />
    case "rest-days": return <RestDaysStep />
    case "day-style": return <DayStyleStep />
    case "budget": return <BudgetStep />
    case "splurge": return <SplurgeStep />
    case "dietary": return <DietaryStep />
    case "transport": return <TransportStep />
    case "weather": return <WeatherStep />
    case "first-time": return <FirstTimeStep />
    case "must-see": return <MustSeeStep />
    default: return null
  }
}

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
    nextStep,
    prevStep,
  } = useOnboardingStore()

  const [generating, setGenerating] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  if (!hydrated) {
    return (
      <div className="min-h-screen map-bg flex items-center justify-center">
        <div className="text-[#c0c6d6] text-sm">Cargando...</div>
      </div>
    )
  }

  const progress = getProgress()
  const currentIndex = getCurrentStepIndex()
  const totalSteps = getTotalSteps()
  const isFirstStep = currentIndex === 0
  const isLastStep = currentIndex === totalSteps - 1

  const handleNext = () => {
    if (isLastStep) {
      setGenerating(true)
    } else {
      nextStep()
    }
  }

  if (generating) {
    return <GeneratingStep />
  }

  return (
    <div className="min-h-screen map-bg flex flex-col">
      {/* Top bar: progress + step count */}
      <div className="safe-area-top px-5 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-[#c0c6d6]">Viaje360</span>
          <span className="text-xs text-[#c0c6d6]">
            {currentIndex + 1} / {totalSteps}
          </span>
        </div>
        <ProgressBar progress={progress} />
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
      <div className="safe-area-bottom px-5 pb-6 flex-shrink-0">
        <NavigationButtons
          onNext={handleNext}
          onBack={prevStep}
          isNextValid={isStepValid()}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
        />
      </div>
    </div>
  )
}
