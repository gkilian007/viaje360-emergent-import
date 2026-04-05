"use client"

import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"
import { GlassSlider } from "../ui/GlassSlider"

export function DayStyleStep() {
  const { data, setField } = useOnboardingStore()

  return (
    <div>
      <StepHeader
        title="¿Cómo es tu día ideal?"
        subtitle="Organizamos las actividades según tu ritmo circadiano"
        emoji="🕐"
      />

      <div className="glass-card p-6 mb-4">
        <p className="text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-4">
          ¿A qué hora empiezas el día?
        </p>
        <GlassSlider
          value={data.wakeTime}
          onChange={(v) => setField("wakeTime", v)}
          leftLabel="Madrugador (7am)"
          rightLabel="Noctámbulo (11am)"
          leftEmoji="☀️"
          rightEmoji="🌙"
          gradient="from-[#ffdb3c] to-[#0A84FF]"
          liveValueFn={(v) => {
            // 0 = 7:00, 100 = 11:00 → 4 hour range = 240 min
            const totalMinutes = Math.round((v / 100) * 240)
            const hours = 7 + Math.floor(totalMinutes / 60)
            const mins = totalMinutes % 60
            const ampm = hours < 12 ? "AM" : "PM"
            const displayHours = hours > 12 ? hours - 12 : hours
            return mins === 0 ? `${displayHours}:00 ${ampm}` : `${displayHours}:${String(mins).padStart(2, "0")} ${ampm}`
          }}
        />
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-[color:var(--on-surface)]">¿Siesta a mediodía?</p>
            <p className="text-xs text-[color:var(--on-surface-variant)] mt-0.5">Bloqueamos 1-2h tras el almuerzo</p>
          </div>
          <button
            onClick={() => setField("wantsSiesta", !data.wantsSiesta)}
            className={`
              relative w-12 h-6 rounded-full transition-all duration-200
              ${data.wantsSiesta ? "bg-[#0A84FF]" : "bg-white/15"}
            `}
          >
            <div
              className={`
                absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200
                ${data.wantsSiesta ? "left-6.5" : "left-0.5"}
              `}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
