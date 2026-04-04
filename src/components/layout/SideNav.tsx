"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { NAV_TABS } from "@/lib/constants"
import { useAppStore } from "@/store/useAppStore"
import { isSupabaseBrowserConfigured, createClient } from "@/lib/supabase/client"

export function SideNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAppStore()
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
    <div
      className="hidden lg:flex flex-col items-center py-6 w-[72px] shrink-0 h-full"
      style={{
        background: "rgba(19, 19, 21, 0.95)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Logo */}
      <div className="w-10 h-10 rounded-xl bg-[#0A84FF] flex items-center justify-center mb-8">
        <span className="material-symbols-outlined text-white text-[20px] filled"
          style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
          flight_takeoff
        </span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-2 flex-1">
        {NAV_TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/")
          return (
            <Link
              key={tab.id}
              href={tab.href}
              title={tab.label}
              className={`w-12 h-12 flex flex-col items-center justify-center rounded-xl transition-all duration-200 group ${
                isActive ? "bg-[#0A84FF]/20 nav-active-glow" : "hover:bg-white/5"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] transition-all ${
                  isActive ? "text-[#0A84FF]" : "text-[#c0c6d6] group-hover:text-white"
                }`}
                style={
                  isActive
                    ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
                    : {}
                }
              >
                {tab.icon}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Avatar + menu at bottom */}
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
            className="absolute left-[calc(100%+8px)] bottom-0 w-48 py-1 rounded-xl overflow-hidden z-50"
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
  )
}
