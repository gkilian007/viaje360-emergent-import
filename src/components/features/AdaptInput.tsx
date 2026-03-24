"use client"

import { useState, useRef, useCallback } from "react"

interface AdaptInputProps {
  tripId: string
  onAdapted: (days: any[]) => void
  disabled?: boolean
}

type AdaptState = "idle" | "adapting" | "success" | "error"

export function AdaptInput({ tripId, onAdapted, disabled }: AdaptInputProps) {
  const [value, setValue] = useState("")
  const [state, setState] = useState<AdaptState>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(async () => {
    const reason = value.trim()
    if (!reason || state === "adapting" || !tripId) return

    setState("adapting")
    setErrorMsg("")

    try {
      const res = await fetch("/api/itinerary/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          reason,
          source: "manual",
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? `Error ${res.status}`)
      }

      const payload = await res.json()
      const adapted = payload.data?.itinerary

      if (adapted?.days) {
        // Clear localStorage so AppBootstrap re-fetches from Supabase
        localStorage.removeItem("viaje360-app-store")

        // Re-fetch the updated trip from Supabase
        const tripRes = await fetch("/api/trips/active", { cache: "no-store" })
        if (tripRes.ok) {
          const tripPayload = await tripRes.json()
          if (tripPayload.data?.days) {
            onAdapted(tripPayload.data.days)
          }
        }
      }

      setState("success")
      setValue("")

      // Reload to fully hydrate from Supabase with adapted data
      setTimeout(() => window.location.reload(), 1200)
    } catch (err: any) {
      setState("error")
      setErrorMsg(err.message ?? "No se pudo adaptar el itinerario")
      setTimeout(() => setState("idle"), 4000)
    }
  }, [value, state, tripId, onAdapted])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const placeholder =
    state === "adapting"
      ? "Adaptando itinerario con IA..."
      : state === "success"
      ? "✓ Itinerario adaptado"
      : state === "error"
      ? errorMsg
      : "Cambia tu plan: \"quita el museo, añade tapas\"…"

  const accentColor =
    state === "adapting"
      ? "#5856D6"
      : state === "success"
      ? "#30D158"
      : state === "error"
      ? "#FF453A"
      : "#0A84FF"

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-full transition-all duration-300"
      style={{
        background: "rgba(19, 19, 21, 0.9)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${state === "idle" ? "rgba(255,255,255,0.08)" : `${accentColor}40`}`,
        boxShadow: state === "adapting"
          ? `0 4px 24px rgba(0,0,0,0.3), 0 0 16px ${accentColor}20`
          : "0 4px 24px rgba(0,0,0,0.3)",
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      {/* AI icon */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: `linear-gradient(135deg, ${accentColor}, #5856D6)`,
          transition: "background 0.3s ease",
        }}
      >
        {state === "adapting" ? (
          <div
            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
          />
        ) : (
          <span
            className="material-symbols-outlined text-[15px] text-white"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
          >
            {state === "success" ? "check" : state === "error" ? "error" : "smart_toy"}
          </span>
        )}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={state === "adapting"}
        className="flex-1 bg-transparent text-[13px] text-[#e5e7eb] placeholder-[#666] outline-none"
        style={{
          color: state === "success" ? "#30D158" : state === "error" ? "#FF453A" : undefined,
        }}
      />

      {/* Send button */}
      <button
        onClick={handleSubmit}
        disabled={!value.trim() || state === "adapting"}
        className="transition-all duration-200"
        style={{
          opacity: value.trim() && state === "idle" ? 1 : 0.3,
          cursor: value.trim() && state === "idle" ? "pointer" : "default",
        }}
      >
        <span
          className="material-symbols-outlined text-[18px]"
          style={{ color: accentColor }}
        >
          send
        </span>
      </button>
    </div>
  )
}
