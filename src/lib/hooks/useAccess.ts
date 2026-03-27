"use client"

import { useState, useEffect, useCallback } from "react"

export interface AccessState {
  hasAccess: boolean
  reason: string
  plan: string
  trialExpiresAt: string | null
  daysRemaining: number | null
  canAdapt: boolean
  canGenerate: boolean
  canDiary: boolean
  loading: boolean
}

const DEFAULT_ACCESS: AccessState = {
  hasAccess: true,
  reason: "loading",
  plan: "free",
  trialExpiresAt: null,
  daysRemaining: null,
  canAdapt: true,
  canGenerate: true,
  canDiary: true,
  loading: true,
}

export function useAccess(
  destination: string | null | undefined,
  tripStartDate?: string | null
) {
  const [access, setAccess] = useState<AccessState>(DEFAULT_ACCESS)

  const refresh = useCallback(async () => {
    if (!destination) {
      setAccess({ ...DEFAULT_ACCESS, loading: false })
      return
    }

    try {
      const params = new URLSearchParams({ destination })
      if (tripStartDate) params.set("tripStartDate", tripStartDate)
      const res = await fetch(
        `/api/access?${params}`,
        { cache: "no-store" }
      )

      if (!res.ok) {
        setAccess({ ...DEFAULT_ACCESS, loading: false })
        return
      }

      const payload = await res.json()
      const data = payload.data ?? payload

      setAccess({
        hasAccess: data.hasAccess ?? true,
        reason: data.reason ?? "unknown",
        plan: data.plan ?? "free",
        trialExpiresAt: data.trialExpiresAt ?? null,
        daysRemaining: data.daysRemaining ?? null,
        canAdapt: data.canAdapt ?? true,
        canGenerate: data.canGenerate ?? true,
        canDiary: data.canDiary ?? true,
        loading: false,
      })
    } catch {
      // On error, grant access to avoid blocking
      setAccess({ ...DEFAULT_ACCESS, loading: false })
    }
  }, [destination, tripStartDate])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { ...access, refresh }
}
