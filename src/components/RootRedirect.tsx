"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useOnboardingStore } from "@/store/useOnboardingStore"

export function RootRedirect() {
  const router = useRouter()
  const onboardingComplete = useOnboardingStore((s) => s.onboardingComplete)

  useEffect(() => {
    if (onboardingComplete) {
      router.replace("/home")
    } else {
      router.replace("/onboarding")
    }
  }, [onboardingComplete, router])

  return null
}
