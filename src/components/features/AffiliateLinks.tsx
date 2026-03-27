"use client"

import { useMemo } from "react"
import { buildAffiliateLinks } from "@/lib/affiliate"

interface AffiliateLinksProps {
  activityName: string
  activityType: string
  destination: string
  cost?: number
  onLinkClick?: (provider: string) => void
}

export function AffiliateLinks({
  activityName,
  activityType,
  destination,
  cost = 0,
  onLinkClick,
}: AffiliateLinksProps) {
  const links = useMemo(
    () => buildAffiliateLinks({ name: activityName, type: activityType, destination, cost }),
    [activityName, activityType, destination, cost]
  )

  if (links.length === 0) return null

  return (
    <div className="mt-3">
      <p className="text-[10px] text-[#555] uppercase tracking-wider font-medium mb-2 px-1">
        Reservar directamente
      </p>
      <div className="flex flex-col gap-2">
        {links.map(link => (
          <a
            key={link.provider}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => onLinkClick?.(link.provider)}
            className="flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <span className="text-[20px] shrink-0">{link.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white">{link.cta}</p>
              <p className="text-[10px] text-[#666]">via {link.label}</p>
            </div>
            <span className="material-symbols-outlined text-[16px] text-[#444]">open_in_new</span>
          </a>
        ))}
      </div>
      <p className="text-[9px] text-[#333] mt-2 px-1">
        * Viaje360 puede recibir una pequeña comisión si reservas a través de estos enlaces, sin coste adicional para ti.
      </p>
    </div>
  )
}
