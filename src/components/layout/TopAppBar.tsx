"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAppStore } from "@/store/useAppStore"
import { isSupabaseBrowserConfigured, createClient } from "@/lib/supabase/client"

interface TopAppBarProps {
  title?: string
  showBack?: boolean
  onShare?: () => void
  onCalendarExport?: () => void
}

export function TopAppBar({ title, showBack = false, onShare, onCalendarExport }: TopAppBarProps) {
  const { currentTrip, user } = useAppStore()
  const router = useRouter()
  const displayTitle = title ?? currentTrip?.name ?? "Viaje360"
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [menuOpen])

  async function handleLogout() {
    if (isSupabaseBrowserConfigured()) {
      const supabase = createClient()
      await supabase.auth.signOut()
    }
    router.replace("/login")
  }

  return (
    <div className="absolute top-0 left-0 right-0 z-20 px-4 safe-area-top">
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
            <img src="/logo.svg" alt="Viaje360" className="w-8 h-8 rounded-xl"/>
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

        {/* Right: share + notifications + avatar */}
        <div className="flex items-center gap-2">
          {onCalendarExport && (
            <button
              onClick={onCalendarExport}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[#c0c6d6] hover:text-white hover:bg-white/10 transition-all"
              title="Exportar a calendario"
            >
              <span className="material-symbols-outlined text-[20px]">calendar_month</span>
            </button>
          )}
          {onShare && (
            <button
              onClick={onShare}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[#c0c6d6] hover:text-white hover:bg-white/10 transition-all"
              title="Compartir itinerario"
            >
              <span className="material-symbols-outlined text-[20px]">share</span>
            </button>
          )}
          <button className="w-9 h-9 flex items-center justify-center rounded-full text-[#c0c6d6] hover:text-white hover:bg-white/10 transition-all relative">
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#0A84FF] rounded-full pulse-blue" />
          </button>

          {/* Avatar with menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white cursor-pointer hover:ring-2 hover:ring-[#0A84FF]/50 transition-all"
              style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
              title="Cuenta"
            >
              {user.name.charAt(0)}
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-[calc(100%+8px)] w-48 py-1 rounded-xl overflow-hidden z-50"
                style={{
                  background: "rgba(30, 30, 34, 0.98)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                <div className="px-3 py-2 border-b border-white/5">
                  <p className="text-[13px] font-medium text-white truncate">{user.name || "Viajero"}</p>
                  <p className="text-[11px] text-[#888] truncate">{user.email || ""}</p>
                </div>
                <Link
                  href="/home"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-[#c0c6d6] hover:bg-white/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  Mi perfil
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-[13px] text-[#FF453A] hover:bg-white/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
