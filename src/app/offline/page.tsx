"use client"

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#131315] flex flex-col items-center justify-center px-6 text-center">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span className="material-symbols-outlined text-[40px] text-[#c0c6d6]">wifi_off</span>
      </div>
      <h1 className="text-[24px] font-bold text-white mb-3">Sin conexión</h1>
      <p className="text-[15px] text-[#9ca3af] max-w-sm leading-relaxed">
        Tus datos se sincronizarán cuando vuelvas a tener conexión.
        Tu itinerario guardado sigue disponible en{" "}
        <a href="/plan" className="text-[#0A84FF] font-medium">Mi plan</a>.
      </p>
      <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
        <a
          href="/plan"
          className="px-5 py-3 rounded-2xl font-semibold text-white text-[14px] transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
        >
          Ver mi itinerario
        </a>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-3 rounded-2xl text-[14px] font-medium text-[#c0c6d6] transition-all active:scale-95"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
