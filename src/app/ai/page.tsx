"use client"

import { useState, useRef, useEffect } from "react"
import { useAppStore } from "@/store/useAppStore"
import { ChatMessage } from "@/components/features/ChatMessage"
import { BottomNav } from "@/components/layout/BottomNav"
import type { ChatMessage as ChatMessageType } from "@/lib/types"

export default function AIPage() {
  const { currentTrip, chatMessages, addChatMessage, isChatLoading, setChatLoading } = useAppStore()
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || isChatLoading) return
    setInput("")

    const userMsg: ChatMessageType = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    }
    addChatMessage(userMsg)
    setChatLoading(true)

    try {
      // Build history for Gemini
      const history = chatMessages.map((m) => ({
        role: m.role === "user" ? "user" as const : "model" as const,
        text: m.content,
      }))

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, tripId: currentTrip?.id }),
      })

      if (!res.ok) throw new Error("Request failed")
      const data = await res.json() as { response: string }

      const aiMsg: ChatMessageType = {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        content: data.response,
        timestamp: new Date().toISOString(),
      }
      addChatMessage(aiMsg)
    } catch {
      const errMsg: ChatMessageType = {
        id: `msg-${Date.now()}-err`,
        role: "assistant",
        content: "Lo siento, no pude conectarme. Inténtalo de nuevo.",
        timestamp: new Date().toISOString(),
      }
      addChatMessage(errMsg)
    } finally {
      setChatLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const QUICK_PROMPTS = [
    "¿Mejor restaurante cerca?",
    "Ruta alternativa",
    "Curiosidad cultural",
    "¿Qué ver hoy?",
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#131315" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-4 shrink-0"
        style={{
          background: "rgba(19, 19, 21, 0.95)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
        >
          <span
            className="material-symbols-outlined text-[20px] text-white"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
          >
            smart_toy
          </span>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-white">Viaje360 AI</p>
          <p className="text-[11px] text-[#30D158] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] inline-block pulse-blue" />
            Activo · Barcelona
          </p>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto shrink-0">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            className="shrink-0 px-3 py-1.5 rounded-full text-[12px] text-[#c0c6d6] whitespace-nowrap transition-all hover:text-white hover:bg-white/10"
            style={{
              background: "rgba(42, 42, 44, 0.8)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
            onClick={() => setInput(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {chatMessages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Loading indicator */}
        {isChatLoading && (
          <div className="flex items-start gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
            >
              <span
                className="material-symbols-outlined text-[14px] text-white"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                smart_toy
              </span>
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1"
              style={{
                background: "rgba(42, 42, 44, 0.9)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="w-2 h-2 rounded-full bg-[#c0c6d6] animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full bg-[#c0c6d6] animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-[#c0c6d6] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="px-4 py-3 pb-24 shrink-0"
        style={{
          background: "rgba(19, 19, 21, 0.95)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="flex items-end gap-2 px-3 py-2 rounded-2xl"
          style={{
            background: "rgba(42, 42, 44, 0.8)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Attachment */}
          <button className="w-8 h-8 flex items-center justify-center rounded-full text-[#c0c6d6] hover:text-white hover:bg-white/10 transition-all shrink-0">
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
          </button>
          {/* Text input */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta sobre Barcelona..."
            rows={1}
            className="flex-1 bg-transparent text-[14px] text-[#e4e2e4] placeholder:text-[#c0c6d6]/50 resize-none leading-relaxed py-1.5"
            style={{ maxHeight: "120px" }}
          />
          {/* Send button */}
          <button
            className="w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
            style={{ background: input.trim() ? "#0A84FF" : "rgba(10,132,255,0.2)" }}
            onClick={sendMessage}
            disabled={!input.trim() || isChatLoading}
          >
            <span
              className="material-symbols-outlined text-[18px] text-white"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}
            >
              send
            </span>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
