"use client"

import { useCallback, useState } from "react"

interface PaywallModalProps {
  destination: string
  onClose: () => void
  onPaymentComplete: () => void
}

type PaywallView = "options" | "pay-trip" | "pay-annual"

export function PaywallModal({ destination, onClose }: PaywallModalProps) {
  const [view, setView] = useState<PaywallView>("options")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !loading) onClose()
    },
    [onClose, loading]
  )

  async function startStripeCheckout(kind: "trip" | "annual") {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, destination }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "No se pudo iniciar Stripe Checkout")
      }

      const url = payload?.data?.url
      if (!url) {
        throw new Error("Stripe no devolvió una URL de checkout")
      }

      window.location.href = url
    } catch (err: any) {
      setLoading(false)
      setError(err.message ?? "Error iniciando pago con Stripe")
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={handleBackdrop}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #1c1c1e 0%, #0f1117 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {view === "options" && (
          <>
            <div className="px-6 pt-8 pb-4 text-center">
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(10,132,255,0.2), rgba(88,86,214,0.2))",
                }}
              >
                <span className="text-[36px]">💳</span>
              </div>
              <h2 className="text-[22px] font-bold text-white mb-2">
                Tu trial para {destination} ha terminado
              </h2>
              <p className="text-[14px] text-[#9ca3af] leading-relaxed">
                Has disfrutado de 14 días gratis con acceso completo.
                Desbloquea para seguir usando la IA, adaptación y diario.
              </p>
            </div>

            <div className="px-6 pb-6 space-y-3">
              <button
                onClick={() => setView("pay-trip")}
                className="w-full p-4 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: "rgba(42,42,44,0.8)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="flex items-center justify-between mb-2 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[20px] shrink-0">🎫</span>
                    <span className="text-[15px] font-semibold text-white truncate">
                      Solo {destination}
                    </span>
                  </div>
                  <span className="text-[18px] font-bold text-white shrink-0">€4.99</span>
                </div>
                <p className="text-[12px] text-[#888]">
                  Pago único · Acceso permanente a este destino
                </p>
              </button>

              <button
                onClick={() => setView("pay-annual")}
                className="w-full p-4 rounded-2xl text-left overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: "linear-gradient(135deg, rgba(10,132,255,0.15), rgba(88,86,214,0.15))",
                  border: "1px solid rgba(10,132,255,0.3)",
                }}
              >
                <div className="flex justify-end mb-2">
                  <div
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white whitespace-nowrap"
                    style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
                  >
                    AHORRA 60%
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[20px] shrink-0">🌍</span>
                    <span className="text-[15px] font-semibold text-white leading-tight">
                      Todos los destinos
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[18px] font-bold text-white block leading-none">€29.99</span>
                    <span className="text-[11px] text-[#888] block mt-1">/año</span>
                  </div>
                </div>
                <p className="text-[12px] text-[#0A84FF] pr-2">
                  Viajes ilimitados · Sin trials · IA completa siempre
                </p>
              </button>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={onClose}
                className="w-full py-3 text-[13px] text-[#666] hover:text-[#999] transition-colors"
                disabled={loading}
              >
                Seguir en modo gratuito
              </button>
            </div>
          </>
        )}

        {(view === "pay-trip" || view === "pay-annual") && (
          <div className="px-6 py-8">
            <button
              onClick={() => {
                setView("options")
                setError(null)
              }}
              className="flex items-center gap-1 text-[13px] text-[#0A84FF] mb-6 hover:underline"
              disabled={loading}
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Volver
            </button>

            <div className="text-center mb-6">
              <span className="text-[32px]">{view === "pay-trip" ? "🎫" : "🌍"}</span>
              <h3 className="text-[18px] font-bold text-white mt-2">
                {view === "pay-trip"
                  ? `${destination} — €4.99`
                  : "Todos los destinos — €29.99/año"}
              </h3>
              <p className="text-[12px] text-[#888] mt-1">
                {view === "pay-trip"
                  ? "Pago único con Stripe Checkout"
                  : "Suscripción anual con Stripe Checkout"}
              </p>
            </div>

            {error && (
              <div
                className="mb-4 p-3 rounded-xl text-[12px] text-[#FF453A]"
                style={{
                  background: "rgba(255,69,58,0.1)",
                  border: "1px solid rgba(255,69,58,0.2)",
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={() => startStripeCheckout(view === "pay-trip" ? "trip" : "annual")}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #635BFF, #0A84FF)" }}
            >
              {loading
                ? "Abriendo Stripe…"
                : view === "pay-trip"
                ? "Pagar con Stripe"
                : "Suscribirme con Stripe"}
            </button>

            <p className="text-[11px] text-[#666] text-center mt-4 leading-relaxed">
              Checkout seguro alojado por Stripe. Podrás pagar con tarjeta,
              Apple Pay o Google Pay según disponibilidad.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
