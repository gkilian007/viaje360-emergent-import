"use client"

interface WalkingChipProps {
  walkingMinutes: number
  distanceMeters: number
  mapsUrl: string
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)}km`
}

export function WalkingChip({ walkingMinutes, distanceMeters, mapsUrl }: WalkingChipProps) {
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 py-1.5 px-3 mx-auto my-1 rounded-full text-[11px] transition-colors hover:bg-white/[0.06] w-fit"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        color: "#888",
      }}
    >
      <span className="text-[13px]">🚶</span>
      <span className="font-medium">{walkingMinutes} min</span>
      <span className="text-[#555]">·</span>
      <span>{formatDistance(distanceMeters)}</span>
      <span className="material-symbols-outlined text-[12px] text-[#555] ml-0.5">directions_walk</span>
    </a>
  )
}
