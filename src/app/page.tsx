"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client"

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    async function check() {
      if (!isSupabaseBrowserConfigured()) {
        // No Supabase → go straight to onboarding (dev mode)
        router.replace("/home")
        return
      }

      const supabase = createClient()
      const { data } = await supabase.auth.getUser()

      if (data.user) {
        router.replace("/home")
      } else {
        router.replace("/login")
      }
    }

    void check()
  }, [router])

  // Brief loading state while checking auth
  return (
    <div className="min-h-screen bg-[#131315] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#0A84FF] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
