"use client"

import { useOnboardingStore } from "@/store/useOnboardingStore"
import { StepHeader } from "../ui/StepHeader"

export function MustSeeStep() {
  const { data, setField } = useOnboardingStore()

  return (
    <div>
      <StepHeader
        title="Los detalles finales"
        subtitle="Cuéntanos lo que no podemos ignorar"
        emoji="📝"
      />

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
            ¿Lugares que no te puedes perder?
          </label>
          <div className="glass-panel p-4">
            <textarea
              rows={3}
              placeholder="Ej: La Sagrada Familia, el Mercado de la Boqueria, el barrio gótico..."
              value={data.mustSee}
              onChange={(e) => setField("mustSee", e.target.value)}
              className="w-full bg-transparent text-[color:var(--on-surface)] placeholder:text-[color:var(--on-surface-variant)] text-sm resize-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
            ¿Algo que prefieras evitar?
          </label>
          <div className="glass-panel p-4">
            <textarea
              rows={3}
              placeholder="Ej: Sitios muy masificados, museos, comida picante..."
              value={data.mustAvoid}
              onChange={(e) => setField("mustAvoid", e.target.value)}
              className="w-full bg-transparent text-[color:var(--on-surface)] placeholder:text-[color:var(--on-surface-variant)] text-sm resize-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[color:var(--on-surface-variant)] uppercase tracking-wider mb-2">
            Entradas ya compradas
          </label>
          <div className="glass-panel p-4">
            <textarea
              rows={3}
              placeholder="Ej: Sagrada Familia 11:30 martes, Casa Batlló 16:00 miércoles..."
              value={data.alreadyBooked}
              onChange={(e) => setField("alreadyBooked", e.target.value)}
              className="w-full bg-transparent text-[color:var(--on-surface)] placeholder:text-[color:var(--on-surface-variant)] text-sm resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
