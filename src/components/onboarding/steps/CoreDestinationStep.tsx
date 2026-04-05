"use client"

import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"
import type { ArrivalTime } from "@/lib/onboarding-types"

const timeChips: { id: ArrivalTime; label: string; emoji: string }[] = [
  { id: "morning", label: "Mañana", emoji: "🌅" },
  { id: "afternoon", label: "Tarde", emoji: "☀️" },
  { id: "evening", label: "Noche", emoji: "🌆" },
  { id: "night", label: "Madrugada", emoji: "🌙" },
]

function isValidDestination(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length < 3) return false
  if (/^\d+$/.test(trimmed)) return false // solo números
  if (/^[^a-zA-ZáéíóúàèìòùäëïöüÁÉÍÓÚÀÈÌÒÙÄËÏÖÜñÑçÇ\s-]+$/.test(trimmed)) return false
  return true
}

export function CoreDestinationStep() {
  const { data, setField } = useOnboardingStore()
  const today = new Date().toISOString().split("T")[0]

  return (
    <div>
      <StepHeader
        title="¿A dónde vas?"
        subtitle="Destino, fechas y tamaño del grupo"
        emoji="✈️"
      />

      <div className="space-y-5">
        {/* Destination */}
        <div>
          <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
            Destino
          </label>
          <div className="glass-pill px-4 py-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#0A84FF] text-xl">location_on</span>
            <input
              type="text"
              placeholder="Ciudad, país o región..."
              value={data.destination}
              onChange={(e) => setField("destination", e.target.value)}
              className="flex-1 bg-transparent text-[color:var(--on-surface)] placeholder:text-[color:var(--on-surface-variant)] text-sm"
            />
          </div>
          {data.destination.trim().length > 2 && !isValidDestination(data.destination) && (
            <p className="text-[12px] text-[#FF453A] mt-1">
              Introduce el nombre de una ciudad o destino real
            </p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#c0c6d6] uppercase tracking-wider mb-2">
              Llegada
            </label>
            <div className="glass-panel px-4 py-3">
              <input
                type="date"
                value={data.startDate}
                min={today}
                onChange={(e) => setField("startDate", e.target.value)}
                className="w-full bg-transparent text-[color:var(--on-surface)] text-sm [color-scheme:dark]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#c0c6d6] uppercase tracking-wider mb-2">
              Salida
            </label>
            <div className="glass-panel px-4 py-3">
              <input
                type="date"
                value={data.endDate}
                min={data.startDate || today}
                onChange={(e) => setField("endDate", e.target.value)}
                className="w-full bg-transparent text-[color:var(--on-surface)] text-sm [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Group size */}
        <div>
          <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
            ¿Cuántas personas?
          </label>
          <div className="glass-panel p-4 flex items-center justify-between">
            <button
              onClick={() => setField("groupSize", Math.max(1, data.groupSize - 1))}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-[color:var(--on-surface)] hover:bg-white/20 transition-colors text-xl font-light"
            >
              −
            </button>
            <div className="text-center">
              <span className="text-2xl font-bold text-[color:var(--on-surface)]">{data.groupSize}</span>
              <p className="text-xs text-[color:var(--on-surface-variant)] mt-0.5">
                {data.groupSize === 1 ? "viajero" : "viajeros"}
              </p>
            </div>
            <button
              onClick={() => setField("groupSize", Math.min(20, data.groupSize + 1))}
              className="w-10 h-10 rounded-full bg-[#0A84FF]/20 flex items-center justify-center text-[#0A84FF] hover:bg-[#0A84FF]/30 transition-colors text-xl"
            >
              +
            </button>
          </div>
        </div>

        {/* Optional arrival time */}
        <div>
          <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
            Hora de llegada <span className="text-[color:var(--on-surface)]/30 normal-case font-normal">(opcional)</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {timeChips.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setField("arrivalTime", data.arrivalTime === chip.id ? null : chip.id)}
                className={`
                  px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200 flex items-center gap-1.5
                  ${data.arrivalTime === chip.id
                    ? "border-[#0A84FF] bg-[#0A84FF]/15 text-[#0A84FF]"
                    : "border-white/8 bg-[var(--surface-container)] text-[color:var(--on-surface-variant)] hover:border-white/20"
                  }
                `}
              >
                {chip.emoji} {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
