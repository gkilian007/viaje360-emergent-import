"use client"

import type { ChatMessage as ChatMessageType } from "@/lib/types"
import { AISuggestionCard } from "./AISuggestionCard"

interface ChatMessageProps {
  message: ChatMessageType
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[78%]">
          <div
            className="px-4 py-3 rounded-2xl rounded-br-sm"
            style={{ background: "#0A84FF" }}
          >
            <p className="text-[14px] text-white leading-relaxed">{message.content}</p>
          </div>
          <p className="text-[10px] text-[var(--on-surface-variant)] text-right mt-1">{formatTime(message.timestamp)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 mb-4">
      {/* AI avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
      >
        <span
          className="material-symbols-outlined text-[14px] text-white"
          style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
        >
          smart_toy
        </span>
      </div>
      <div className="flex-1 max-w-[85%]">
        {/* Text bubble */}
        <div
          className="px-4 py-3 rounded-2xl rounded-tl-sm"
          style={{
            background: "var(--surface-container)",
            border: "1px solid var(--border-color)",
          }}
        >
          <p className="text-[14px] text-[var(--on-surface)] leading-relaxed">{message.content}</p>
        </div>
        {/* Suggestion cards */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1 no-scrollbar">
            {message.suggestions.map((sug) => (
              <AISuggestionCard key={sug.id} suggestion={sug} />
            ))}
          </div>
        )}
        <p className="text-[10px] text-[var(--on-surface-variant)] mt-1">{formatTime(message.timestamp)}</p>
      </div>
    </div>
  )
}
