"use client"

import { motion } from "framer-motion"

const MOODS = [
  { id: "amazing", emoji: "🤩", label: "Increíble", color: "#30D158" },
  { id: "happy", emoji: "😊", label: "Feliz", color: "#0A84FF" },
  { id: "neutral", emoji: "😐", label: "Normal", color: "#c0c6d6" },
  { id: "tired", emoji: "😴", label: "Cansado", color: "#FF9F0A" },
  { id: "disappointed", emoji: "😔", label: "Decepcionado", color: "#FF453A" },
] as const

interface MoodSelectorProps {
  value: string | null
  onChange: (mood: string) => void
}

export function MoodSelector({ value, onChange }: MoodSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-[#c0c6d6] font-medium">¿Cómo te sientes hoy?</p>
      <div className="flex justify-between gap-2">
        {MOODS.map((mood) => {
          const isSelected = value === mood.id
          return (
            <motion.button
              key={mood.id}
              onClick={() => onChange(mood.id)}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 flex-1 py-3 rounded-2xl transition-all"
              style={{
                background: isSelected ? `${mood.color}15` : "rgba(42,42,44,0.6)",
                border: `2px solid ${isSelected ? mood.color : "transparent"}`,
              }}
              data-testid={`mood-${mood.id}`}
            >
              <span className="text-2xl">{mood.emoji}</span>
              <span
                className="text-[10px] font-medium"
                style={{ color: isSelected ? mood.color : "#c0c6d6" }}
              >
                {mood.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
