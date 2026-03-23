"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { TimelineActivity } from "@/lib/types"
import { MoodSelector } from "./MoodSelector"
import { EnergyPaceSlider } from "./EnergyPaceSlider"
import { ActivityFeedbackCard } from "./ActivityFeedbackCard"

interface DiaryMessage {
  id: string
  role: "assistant" | "user"
  content: string
  type?: "text" | "mood" | "energy" | "activities" | "summary"
}

interface ActivityFeedback {
  activityId: string
  liked: boolean | null
  wouldRepeat: boolean | null
  notes: string
}

interface DiaryState {
  mood: string | null
  energyScore: number
  paceScore: number
  activityFeedback: ActivityFeedback[]
  freeTextSummary: string
  wouldRepeat: boolean | null
}

interface DiaryConversationProps {
  dayNumber: number
  date: string
  activities: TimelineActivity[]
  onComplete: (data: DiaryState & { conversation: DiaryMessage[] }) => void
  onCancel: () => void
  isLoading?: boolean
}

const DIARY_STEPS = [
  { id: "greeting", type: "text" },
  { id: "mood", type: "mood" },
  { id: "energy", type: "energy" },
  { id: "activities", type: "activities" },
  { id: "summary", type: "summary" },
  { id: "complete", type: "text" },
] as const

export function DiaryConversation({
  dayNumber,
  date,
  activities,
  onComplete,
  onCancel,
  isLoading = false,
}: DiaryConversationProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [messages, setMessages] = useState<DiaryMessage[]>([])
  const [diaryState, setDiaryState] = useState<DiaryState>({
    mood: null,
    energyScore: 3,
    paceScore: 3,
    activityFeedback: [],
    freeTextSummary: "",
    wouldRepeat: null,
  })
  const [showInput, setShowInput] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const formattedDate = new Date(date).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, currentStep])

  // Initialize conversation
  useEffect(() => {
    // Avoid duplicate initialization
    if (messages.length > 0) return
    
    const greeting: DiaryMessage = {
      id: "greeting",
      role: "assistant",
      content: `¡Hola! ¿Cómo ha ido el Día ${dayNumber}? (${formattedDate})\n\nCuéntame cómo te ha ido hoy y te ayudaré a guardar tus impresiones para mejorar futuros viajes.`,
      type: "text",
    }
    setMessages([greeting])

    // Auto advance to mood after short delay
    setTimeout(() => {
      setMessages((prev) => {
        // Prevent duplicate mood prompts
        if (prev.some(m => m.id === "mood-prompt")) return prev
        const moodPrompt: DiaryMessage = {
          id: "mood-prompt",
          role: "assistant",
          content: "Primero, ¿cómo te sientes después del día de hoy?",
          type: "mood",
        }
        return [...prev, moodPrompt]
      })
      setCurrentStep(1)
    }, 1500)
  }, [dayNumber, formattedDate, messages.length])

  const handleMoodSelect = (mood: string) => {
    setDiaryState((prev) => ({ ...prev, mood }))
    
    const userMsg: DiaryMessage = {
      id: `user-mood-${Date.now()}`,
      role: "user",
      content: getMoodLabel(mood),
      type: "text",
    }
    setMessages((prev) => [...prev, userMsg])

    setTimeout(() => {
      const energyPrompt: DiaryMessage = {
        id: "energy-prompt",
        role: "assistant",
        content: "¿Cómo ha sido tu energía y el ritmo del día?",
        type: "energy",
      }
      setMessages((prev) => [...prev, energyPrompt])
      setCurrentStep(2)
    }, 800)
  }

  const handleEnergyConfirm = () => {
    const userMsg: DiaryMessage = {
      id: `user-energy-${Date.now()}`,
      role: "user",
      content: `Energía: ${diaryState.energyScore}/5, Ritmo: ${diaryState.paceScore}/5`,
      type: "text",
    }
    setMessages((prev) => [...prev, userMsg])

    setTimeout(() => {
      if (activities.length > 0) {
        const activitiesPrompt: DiaryMessage = {
          id: "activities-prompt",
          role: "assistant",
          content: "Ahora cuéntame sobre las actividades de hoy. ¿Qué te gustó y qué no tanto?",
          type: "activities",
        }
        setMessages((prev) => [...prev, activitiesPrompt])
        setCurrentStep(3)
      } else {
        advanceToSummary()
      }
    }, 800)
  }

  const handleActivitiesConfirm = () => {
    const feedbackCount = diaryState.activityFeedback.filter(f => f.liked !== null).length
    const userMsg: DiaryMessage = {
      id: `user-activities-${Date.now()}`,
      role: "user",
      content: `He dado feedback sobre ${feedbackCount} actividad${feedbackCount !== 1 ? "es" : ""}`,
      type: "text",
    }
    setMessages((prev) => [...prev, userMsg])
    advanceToSummary()
  }

  const advanceToSummary = () => {
    setTimeout(() => {
      const summaryPrompt: DiaryMessage = {
        id: "summary-prompt",
        role: "assistant",
        content: "Por último, ¿quieres añadir algo más sobre el día? Un momento especial, algo que descubriste, o algo que te gustaría recordar...",
        type: "summary",
      }
      setMessages((prev) => [...prev, summaryPrompt])
      setCurrentStep(4)
      setShowInput(true)
    }, 800)
  }

  const handleSummarySubmit = () => {
    if (diaryState.freeTextSummary.trim()) {
      const userMsg: DiaryMessage = {
        id: `user-summary-${Date.now()}`,
        role: "user",
        content: diaryState.freeTextSummary,
        type: "text",
      }
      setMessages((prev) => [...prev, userMsg])
    }

    setTimeout(() => {
      const completeMsg: DiaryMessage = {
        id: "complete",
        role: "assistant",
        content: "¡Perfecto! He guardado todas tus impresiones del día. Esta información me ayudará a darte mejores recomendaciones en el futuro. ¡Descansa bien! 🌙",
        type: "text",
      }
      setMessages((prev) => [...prev, completeMsg])
      setCurrentStep(5)
      setShowInput(false)
    }, 800)
  }

  const handleComplete = () => {
    onComplete({
      ...diaryState,
      conversation: messages,
    })
  }

  const getMoodLabel = (mood: string) => {
    const labels: Record<string, string> = {
      amazing: "🤩 Me siento increíble",
      happy: "😊 Estoy feliz",
      neutral: "😐 Un día normal",
      tired: "😴 Estoy cansado",
      disappointed: "😔 Un poco decepcionado",
    }
    return labels[mood] || mood
  }

  const handleActivityFeedback = (feedback: ActivityFeedback) => {
    setDiaryState((prev) => ({
      ...prev,
      activityFeedback: [
        ...prev.activityFeedback.filter((f) => f.activityId !== feedback.activityId),
        feedback,
      ],
    }))
  }

  const currentStepData = DIARY_STEPS[currentStep]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4 shrink-0"
        style={{
          background: "rgba(19, 19, 21, 0.95)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #5856D6, #AF52DE)" }}
          >
            <span className="material-symbols-outlined text-[20px] text-white">auto_stories</span>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-white">Diario del día</p>
            <p className="text-[11px] text-[#c0c6d6]">Día {dayNumber} · {formattedDate}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
          data-testid="diary-close-btn"
        >
          <span className="material-symbols-outlined text-[20px] text-[#c0c6d6]">close</span>
        </button>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 flex gap-1">
        {DIARY_STEPS.slice(0, -1).map((step, i) => (
          <div
            key={step.id}
            className="flex-1 h-1 rounded-full transition-all"
            style={{
              background: i <= currentStep ? "#5856D6" : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-4`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-start gap-2 max-w-[85%]">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, #5856D6, #AF52DE)" }}
                  >
                    <span className="material-symbols-outlined text-[14px] text-white">auto_stories</span>
                  </div>
                  <div
                    className="px-4 py-3 rounded-2xl rounded-tl-sm"
                    style={{
                      background: "rgba(42, 42, 44, 0.9)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p className="text-[14px] text-[#e4e2e4] leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              )}
              {msg.role === "user" && (
                <div
                  className="px-4 py-3 rounded-2xl rounded-tr-sm max-w-[75%]"
                  style={{ background: "linear-gradient(135deg, #5856D6, #AF52DE)" }}
                >
                  <p className="text-[14px] text-white leading-relaxed">{msg.content}</p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Interactive elements based on current step */}
        {currentStepData?.type === "mood" && !diaryState.mood && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <MoodSelector value={diaryState.mood} onChange={handleMoodSelect} />
          </motion.div>
        )}

        {currentStepData?.type === "energy" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-4"
          >
            <EnergyPaceSlider
              energyValue={diaryState.energyScore}
              paceValue={diaryState.paceScore}
              onEnergyChange={(v) => setDiaryState((prev) => ({ ...prev, energyScore: v }))}
              onPaceChange={(v) => setDiaryState((prev) => ({ ...prev, paceScore: v }))}
            />
            <button
              onClick={handleEnergyConfirm}
              className="w-full py-3 rounded-2xl font-semibold text-[14px] text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #5856D6, #AF52DE)" }}
              data-testid="diary-energy-confirm"
            >
              Continuar
            </button>
          </motion.div>
        )}

        {currentStepData?.type === "activities" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-3"
          >
            {activities.map((activity) => (
              <ActivityFeedbackCard
                key={activity.id}
                activity={activity}
                feedback={diaryState.activityFeedback.find((f) => f.activityId === activity.id)}
                onFeedbackChange={handleActivityFeedback}
              />
            ))}
            <button
              onClick={handleActivitiesConfirm}
              className="w-full py-3 rounded-2xl font-semibold text-[14px] text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #5856D6, #AF52DE)" }}
              data-testid="diary-activities-confirm"
            >
              Continuar
            </button>
          </motion.div>
        )}

        {currentStep === 5 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <button
              onClick={handleComplete}
              disabled={isLoading}
              className="w-full py-4 rounded-2xl font-semibold text-[14px] text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #30D158, #00C853)" }}
              data-testid="diary-complete-btn"
            >
              {isLoading ? "Guardando..." : "Guardar diario del día"}
            </button>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area for summary */}
      {showInput && currentStep === 4 && (
        <div
          className="px-4 py-3 shrink-0"
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
            <textarea
              value={diaryState.freeTextSummary}
              onChange={(e) => setDiaryState((prev) => ({ ...prev, freeTextSummary: e.target.value }))}
              placeholder="Escribe tus pensamientos del día..."
              rows={2}
              className="flex-1 bg-transparent text-[14px] text-[#e4e2e4] placeholder:text-[#c0c6d6]/50 resize-none leading-relaxed py-1.5"
              style={{ maxHeight: "120px" }}
              data-testid="diary-summary-input"
            />
            <button
              onClick={handleSummarySubmit}
              className="w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-all hover:scale-105 active:scale-95"
              style={{ background: "#5856D6" }}
              data-testid="diary-summary-submit"
            >
              <span className="material-symbols-outlined text-[18px] text-white">send</span>
            </button>
          </div>
          <button
            onClick={handleSummarySubmit}
            className="w-full mt-2 py-2 text-[12px] text-[#c0c6d6] hover:text-white transition-all"
          >
            Saltar este paso
          </button>
        </div>
      )}
    </div>
  )
}
