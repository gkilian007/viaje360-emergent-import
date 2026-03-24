"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function BillingSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"confirming" | "success" | "error">("confirming")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sessionId = searchParams.get("session_id")
    if (!sessionId) {
      setStatus("error")
      setError("Missing Stripe session")
      return
    }

    async function confirm() {
      try {
        const res = await fetch("/api/stripe/confirm-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })

        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          throw new Error(payload?.error?.message ?? "No se pudo confirmar el pago")
        }

        setStatus("success")
        setTimeout(() => router.replace("/plan"), 1200)
      } catch (err: any) {
        setStatus("error")
        setError(err.message ?? "Error confirmando el pago")
      }
    }

    void confirm()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        {status === "confirming" && (
          <>
            <div className="w-10 h-10 border-2 border-[#0A84FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h1 className="text-[22px] font-bold text-white mb-2">Confirmando pago…</h1>
            <p className="text-[#c0c6d6] text-sm">Estamos activando tu acceso en Viaje360.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-[52px] mb-4">🎉</div>
            <h1 className="text-[22px] font-bold text-white mb-2">Pago confirmado</h1>
            <p className="text-[#c0c6d6] text-sm">Tu acceso ya está activo. Volviendo al plan…</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-[52px] mb-4">⚠️</div>
            <h1 className="text-[22px] font-bold text-white mb-2">No se pudo confirmar</h1>
            <p className="text-[#c0c6d6] text-sm mb-6">{error}</p>
            <button
              onClick={() => router.replace("/plan")}
              className="px-5 py-3 rounded-2xl font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
            >
              Volver al plan
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-[#0A84FF] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <BillingSuccessContent />
    </Suspense>
  )
}
