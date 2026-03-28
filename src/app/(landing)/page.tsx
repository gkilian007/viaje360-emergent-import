"use client"

import { useEffect, useState } from "react"
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client"
import { HeroSection } from "@/components/landing/HeroSection"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { FeaturesCarousel } from "@/components/landing/FeaturesCarousel"
import { Destinations } from "@/components/landing/Destinations"
import { PricingSection } from "@/components/landing/PricingSection"
import { FooterCTA } from "@/components/landing/FooterCTA"

export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      if (!isSupabaseBrowserConfigured()) {
        setChecked(true)
        return
      }
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        setIsAuthenticated(!!data.user)
      } catch {
        // ignore
      } finally {
        setChecked(true)
      }
    }
    void checkAuth()
  }, [])

  // Avoid layout shift — render immediately with unauthenticated state,
  // then swap CTA copy once auth check resolves (checked = true).
  return (
    <main className="bg-[#0a0a0c] text-white overflow-x-hidden">
      <HeroSection isAuthenticated={checked ? isAuthenticated : false} />
      <HowItWorks />
      <FeaturesCarousel />
      <Destinations />
      <PricingSection />
      <FooterCTA isAuthenticated={checked ? isAuthenticated : false} />
    </main>
  )
}
