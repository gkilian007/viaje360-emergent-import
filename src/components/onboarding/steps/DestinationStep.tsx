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

function TimeChips({
  value,
  onChange,
}: {
  value: ArrivalTime | null
  onChange: (v: ArrivalTime) => void
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {timeChips.map((chip) => (
        <button
          key={chip.id}
          onClick={() => onChange(chip.id)}
          className={`
            px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200 flex items-center gap-1.5
            ${value === chip.id
              ? "border-[#0A84FF] bg-[#0A84FF]/15 text-[#0A84FF]"
              : "border-white/8 bg-[var(--surface-container)] text-[color:var(--on-surface-variant)] hover:border-white/20"
            }
          `}
        >
          {chip.emoji} {chip.label}
        </button>
      ))}
    </div>
  )
}

export function DestinationStep() {
  const { data, setField } = useOnboardingStore()

  return (
    <div>
      <StepHeader
        title="¿A dónde vas?"
        subtitle="Cuéntanos sobre tu viaje para personalizar cada detalle"
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
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
              Llegada
            </label>
            <div className="glass-panel px-4 py-3">
              <input
                type="date"
                value={data.startDate}
                onChange={(e) => setField("startDate", e.target.value)}
                className="w-full bg-transparent text-[color:var(--on-surface)] text-sm [color-scheme:dark]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
              Salida
            </label>
            <div className="glass-panel px-4 py-3">
              <input
                type="date"
                value={data.endDate}
                onChange={(e) => setField("endDate", e.target.value)}
                className="w-full bg-transparent text-[color:var(--on-surface)] text-sm [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Arrival time */}
        <div>
          <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
            Hora de llegada
          </label>
          <TimeChips
            value={data.arrivalTime}
            onChange={(v) => setField("arrivalTime", v)}
          />
        </div>

        {/* Departure time */}
        <div>
          <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
            Hora de salida
          </label>
          <TimeChips
            value={data.departureTime}
            onChange={(v) => setField("departureTime", v)}
          />
        </div>
      </div>
    </div>
  )
}
