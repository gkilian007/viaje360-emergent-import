"use client"

import { SideNav } from "./SideNav"

interface DesktopLayoutProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  /** Optional companion sidebar (budget, packing, tips, diary, etc.) */
  companionPanel?: React.ReactNode
}

export function DesktopLayout({ leftPanel, rightPanel, companionPanel }: DesktopLayoutProps) {
  return (
    <div className="hidden lg:flex h-full w-full">
      <SideNav />
      {/* Left panel: itinerary timeline */}
      <div className="flex flex-col w-[35%] min-w-[360px] max-w-[480px] h-full overflow-y-auto border-r border-white/5">
        {leftPanel}
      </div>
      {/* Center: interactive map */}
      <div className="flex-1 h-full relative min-w-[300px]">
        {rightPanel}
      </div>
      {/* Right panel: companion sidebar */}
      {companionPanel && (
        <div className="w-[320px] xl:w-[360px] h-full overflow-y-auto border-l border-white/5 bg-[#0f1117]/80 backdrop-blur-xl">
          {companionPanel}
        </div>
      )}
    </div>
  )
}
