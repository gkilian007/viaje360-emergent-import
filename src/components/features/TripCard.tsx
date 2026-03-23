"use client"

import { useAppStore } from "@/store/useAppStore"
import { WeatherChip } from "./WeatherChip"
import { BentoStats } from "./BentoStats"

export function TripCard() {
  const { currentTrip } = useAppStore()

  if (!currentTrip) return null

  const next = currentTrip.nextActivity

  return (
    <div
      className="rounded-t-[2rem] px-5 pt-5 pb-6 flex flex-col gap-4"
      style={{
        background: "rgba(19, 19, 21, 0.96)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "none",
        boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
      }}
    >
      {/* Pull handle */}
      <div className="flex justify-center">
        <div className="w-10 h-1 rounded-full bg-white/20" />
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#0A84FF] pulse-blue" />
          <span className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium">
            Estado del Viaje
          </span>
        </div>
        {currentTrip.weather && <WeatherChip weather={currentTrip.weather} />}
      </div>

      {/* Main heading */}
      <div>
        <h1 className="text-[22px] font-bold text-white leading-tight">
          {currentTrip.name ?? `Explorando ${currentTrip.destination}`}
        </h1>
        <p className="text-[13px] text-[#c0c6d6] mt-0.5">
          {currentTrip.destination}{currentTrip.country ? `, ${currentTrip.country}` : ""}
        </p>
      </div>

      {/* Up next card */}
      {next && (
        <div
          className="p-4 rounded-2xl flex items-center gap-3"
          style={{
            background: "rgba(42, 42, 44, 0.8)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(10, 132, 255, 0.15)", border: "1px solid rgba(10,132,255,0.2)" }}
          >
            <span
              className="material-symbols-outlined text-[20px] text-[#0A84FF]"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
            >
              account_balance
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] uppercase tracking-widest text-[#c0c6d6] font-medium">
                Siguiente
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(10, 132, 255, 0.15)", color: "#0A84FF" }}
              >
                {next.time}
              </span>
            </div>
            <p className="text-[14px] font-semibold text-white truncate">{next.name}</p>
            <p className="text-[11px] text-[#c0c6d6] truncate">{next.location}</p>
          </div>
          {/* Friend avatars */}
          {next.friendAvatars && next.friendAvatars.length > 0 && (
            <div className="flex -space-x-1.5 shrink-0">
              {next.friendAvatars.slice(0, 3).map((letter, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{
                    background: `hsl(${i * 80 + 200}, 70%, 50%)`,
                    border: "1.5px solid rgba(19,19,21,0.8)",
                  }}
                >
                  {letter}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bento stats */}
      <BentoStats />
    </div>
  )
}
