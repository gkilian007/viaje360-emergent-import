"use client"

import { SideNav } from "./SideNav"
import { BottomNav } from "./BottomNav"

interface AppShellProps {
  children: React.ReactNode
  /** Hide bottom nav on mobile (e.g., for fullscreen pages) */
  hideBottomNav?: boolean
  /** Max width for centered content on desktop (default: none) */
  maxWidth?: string
}

/**
 * Unified app shell: SideNav on desktop (lg+), BottomNav on mobile.
 * Wraps any page content and ensures consistent navigation across all screens.
 */
export function AppShell({ children, hideBottomNav, maxWidth }: AppShellProps) {
  return (
    <>
      {/* Desktop: SideNav + content */}
      <div className="hidden lg:flex h-screen w-full">
        <SideNav />
        <div className={`flex-1 h-full overflow-y-auto ${maxWidth ? "" : ""}`}>
          {maxWidth ? (
            <div className="mx-auto h-full" style={{ maxWidth }}>
              {children}
            </div>
          ) : (
            children
          )}
        </div>
      </div>

      {/* Mobile: content + BottomNav */}
      <div className="lg:hidden flex flex-col h-screen">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        {!hideBottomNav && <BottomNav />}
      </div>
    </>
  )
}
