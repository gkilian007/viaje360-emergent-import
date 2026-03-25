"use client"

import Image from "next/image"

interface IPhoneMockupProps {
  src: string
  alt?: string
  width?: number
  className?: string
}

/**
 * Pure CSS iPhone 16 Pro mockup frame.
 * Renders the screenshot inside a realistic device bezel with Dynamic Island.
 */
export default function IPhoneMockup({
  src,
  alt = "App screenshot",
  width = 280,
  className = "",
}: IPhoneMockupProps) {
  // iPhone 16 Pro aspect ratio: ~393x852 (≈1:2.168)
  const height = Math.round(width * 2.168)
  const bezelRadius = Math.round(width * 0.155) // ~17% corner radius
  const innerRadius = Math.round(width * 0.13)
  const bezelWidth = Math.round(width * 0.018) // thin bezel
  const dynamicIslandW = Math.round(width * 0.295)
  const dynamicIslandH = Math.round(width * 0.09)
  const dynamicIslandTop = Math.round(width * 0.035)
  const buttonR = Math.round(width * 0.008) // side button width
  const powerTop = Math.round(height * 0.22)
  const powerH = Math.round(height * 0.09)
  const volTopU = Math.round(height * 0.18)
  const volTopD = Math.round(height * 0.26)
  const volH = Math.round(height * 0.055)

  return (
    <div
      className={`iphone-mockup relative ${className}`}
      style={{ width, height }}
    >
      {/* Outer frame — titanium bezel */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#2a2a2e] via-[#1c1c1e] to-[#2a2a2e] shadow-2xl"
        style={{ borderRadius: bezelRadius }}
      >
        {/* Subtle titanium edge highlight */}
        <div
          className="absolute inset-0 border border-white/[0.08]"
          style={{ borderRadius: bezelRadius }}
        />

        {/* Inner screen area */}
        <div
          className="absolute overflow-hidden bg-black"
          style={{
            top: bezelWidth,
            left: bezelWidth,
            right: bezelWidth,
            bottom: bezelWidth,
            borderRadius: innerRadius,
          }}
        >
          {/* Screenshot */}
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            className="w-full h-full object-cover"
            priority
          />

          {/* Dynamic Island */}
          <div
            className="absolute bg-black rounded-full z-10"
            style={{
              width: dynamicIslandW,
              height: dynamicIslandH,
              top: dynamicIslandTop,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          />

          {/* Top screen fade (status bar blend) */}
          <div
            className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/40 to-transparent pointer-events-none z-[5]"
            style={{ borderRadius: `${innerRadius}px ${innerRadius}px 0 0` }}
          />
        </div>
      </div>

      {/* Power button (right side) */}
      <div
        className="absolute bg-[#3a3a3e] rounded-l-sm"
        style={{
          right: -buttonR,
          top: powerTop,
          width: buttonR + 1,
          height: powerH,
        }}
      />

      {/* Volume up (left side) */}
      <div
        className="absolute bg-[#3a3a3e] rounded-r-sm"
        style={{
          left: -buttonR,
          top: volTopU,
          width: buttonR + 1,
          height: volH,
        }}
      />

      {/* Volume down (left side) */}
      <div
        className="absolute bg-[#3a3a3e] rounded-r-sm"
        style={{
          left: -buttonR,
          top: volTopD,
          width: buttonR + 1,
          height: volH,
        }}
      />

      {/* Screen gloss reflection */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{ borderRadius: bezelRadius }}
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent"
          style={{ borderRadius: bezelRadius }}
        />
      </div>
    </div>
  )
}
