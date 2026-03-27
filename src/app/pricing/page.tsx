"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const FEATURES_FREE = [
  "14 días de prueba gratis por destino",
  "Itinerario generado por IA",
  "Mapa interactivo",
]

const FEATURES_TRIP = [
  "Acceso permanente a un destino",
  "IA de adaptación proactiva",
  "Diario visual del viaje",
  "Sin anuncios",
]

const FEATURES_ANNUAL = [
  "Todos los destinos ilimitados",
  "IA completa sin restricciones",
  "Adaptación proactiva en tiempo real",
  "Diario visual y recap automático",
  "Sin anuncios",
  "Acceso anticipado a nuevas funciones",
]

function FeatureItem({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2 text-[13px] text-[#c0c6d6]">
      <span className="text-[#30D158] mt-0.5 shrink-0">✓</span>
      {label}
    </li>
  )
}

export default function PricingPage() {
  const [loading, setLoading] = useState<"trip" | "annual" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function startCheckout(kind: "trip" | "annual") {
    setLoading(kind)
    setError(null)
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, destination: "Todos los destinos" }),
      })
      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "No se pudo iniciar el pago")
      }

      const url = payload?.data?.url
      if (!url) throw new Error("No se recibió URL de Stripe")
      window.location.href = url
    } catch (err: unknown) {
      setLoading(null)
      setError(err instanceof Error ? err.message : "Error iniciando pago")
    }
  }

  return (
    <div className="min-h-screen pb-28 px-4" style={{ background: "#131315" }}>
      {/* Header */}
      <div className="pt-16 pb-6 text-center">
        <button
          onClick={() => router.back()}
          className="absolute left-4 top-14 flex items-center gap-1 text-[13px] text-[#0A84FF]"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>

        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(10,132,255,0.2), rgba(88,86,214,0.2))",
          }}
        >
          <span className="text-[32px]">✈️</span>
        </div>
        <h1 className="text-[26px] font-bold text-white mb-2">Viaje360 Premium</h1>
        <p className="text-[14px] text-[#9ca3af] leading-relaxed max-w-sm mx-auto">
          Tu compañero de viaje con IA. Itinerarios personalizados, adaptación en tiempo real y recuerdos para siempre.
        </p>
      </div>

      {error && (
        <div
          className="mb-4 p-3 rounded-xl text-[13px] text-[#FF453A] text-center"
          style={{ background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.2)" }}
        >
          {error}
        </div>
      )}

      {/* Free tier */}
      <div
        className="rounded-2xl p-4 mb-3"
        style={{
          background: "rgba(30,30,32,0.9)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Gratis</h3>
            <p className="text-[12px] text-[#9ca3af]">Para explorar</p>
          </div>
          <span className="text-[20px] font-bold text-white">€0</span>
        </div>
        <ul className="space-y-1.5">
          {FEATURES_FREE.map((f) => (
            <FeatureItem key={f} label={f} />
          ))}
        </ul>
      </div>

      {/* Trip plan */}
      <div
        className="rounded-2xl p-4 mb-3"
        style={{
          background: "rgba(30,30,32,0.9)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Por destino</h3>
            <p className="text-[12px] text-[#9ca3af]">Pago único</p>
          </div>
          <span className="text-[20px] font-bold text-white">€4.99</span>
        </div>
        <ul className="space-y-1.5 mb-4">
          {FEATURES_TRIP.map((f) => (
            <FeatureItem key={f} label={f} />
          ))}
        </ul>
        <button
          onClick={() => startCheckout("trip")}
          disabled={loading !== null}
          className="w-full py-3 rounded-xl text-[14px] font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {loading === "trip" ? "Abriendo Stripe…" : "Comprar destino — €4.99"}
        </button>
      </div>

      {/* Annual plan */}
      <div
        className="rounded-2xl p-4 mb-3 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(10,132,255,0.12), rgba(88,86,214,0.12))",
          border: "1px solid rgba(10,132,255,0.3)",
        }}
      >
        <div
          className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
        >
          MÁS POPULAR
        </div>

        <div className="flex items-center justify-between mb-3 pr-16">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Anual</h3>
            <p className="text-[12px] text-[#9ca3af]">Todos los destinos · Ahorra 60%</p>
          </div>
          <div className="text-right">
            <span className="text-[20px] font-bold text-white">€29.99</span>
            <span className="text-[11px] text-[#9ca3af] block">/año</span>
          </div>
        </div>
        <ul className="space-y-1.5 mb-4">
          {FEATURES_ANNUAL.map((f) => (
            <FeatureItem key={f} label={f} />
          ))}
        </ul>
        <button
          onClick={() => startCheckout("annual")}
          disabled={loading !== null}
          className="w-full py-3 rounded-xl text-[14px] font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
        >
          {loading === "annual" ? "Abriendo Stripe…" : "Suscribirme — €29.99/año"}
        </button>
      </div>

      <p className="text-[11px] text-[#666] text-center mt-4 leading-relaxed">
        Checkout seguro alojado por Stripe. Puedes cancelar en cualquier momento.
      </p>
    </div>
  )
}
