"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { NAV_TABS } from "@/lib/constants"

export function BottomNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[2000] lg:hidden px-4 pb-4 safe-area-bottom">
      <div
        className="flex items-center justify-around px-2 py-2 rounded-2xl"
        style={{
          background: "rgba(19, 19, 21, 0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 -4px 40px rgba(0,0,0,0.5)",
        }}
      >
        {NAV_TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/")
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className="flex flex-col items-center gap-0.5 min-w-0 flex-1 py-1.5 rounded-xl transition-all duration-200 group"
            >
              <div
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-[#0A84FF]/20 nav-active-glow"
                    : "group-hover:bg-white/5"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] transition-all duration-200 ${
                    isActive ? "text-[#0A84FF]" : "text-[#c0c6d6]"
                  }`}
                  style={
                    isActive
                      ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
                      : {}
                  }
                >
                  {tab.icon}
                </span>
              </div>
              <span
                className={`text-[9px] font-medium tracking-wide transition-all truncate ${
                  isActive ? "text-[#0A84FF]" : "text-[#c0c6d6]"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
