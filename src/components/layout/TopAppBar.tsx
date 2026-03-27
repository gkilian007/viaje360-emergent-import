"use client"

import Link from "next/link"
import { useAppStore } from "@/store/useAppStore"

interface TopAppBarProps {
  title?: string
  showBack?: boolean
}

export function TopAppBar({ title, showBack = false }: TopAppBarProps) {
  const { currentTrip, user } = useAppStore()
  const displayTitle = title ?? currentTrip?.name ?? "Viaje360"

  return (
    <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-safe-top">
      <div
        className="flex items-center justify-between px-4 py-3 mt-2 rounded-2xl"
        style={{
          background: "rgba(19, 19, 21, 0.8)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Left: back or trip icon */}
        <div className="flex items-center gap-2">
          {showBack ? (
            <Link
              href="/plan"
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#c0c6d6] hover:text-white hover:bg-white/10 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
          ) : (
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[#0A84FF]/20">
              <span className="material-symbols-outlined text-[18px] text-[#0A84FF]">
                flight_takeoff
              </span>
            </div>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#c0c6d6] font-medium leading-none">
              {currentTrip?.destination
                ? currentTrip.destination.charAt(0).toUpperCase() + currentTrip.destination.slice(1)
                : "Viaje360"}
            </p>
            <p className="text-[15px] font-semibold text-white leading-tight">{displayTitle}</p>
          </div>
        </div>

        {/* Right: notifications + avatar */}
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 flex items-center justify-center rounded-full text-[#c0c6d6] hover:text-white hover:bg-white/10 transition-all relative">
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#0A84FF] rounded-full pulse-blue" />
          </button>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
          >
            {user.name.charAt(0)}
          </div>
        </div>
      </div>
    </div>
  )
}
