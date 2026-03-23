"use client"

import { motion } from "framer-motion"
import Link from "next/link"

interface DiaryPromptCardProps {
  dayNumber: number
  hasExistingDiary?: boolean
}

export function DiaryPromptCard({ dayNumber, hasExistingDiary = false }: DiaryPromptCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-5 mb-4 p-4 rounded-2xl relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(88,86,214,0.15), rgba(175,82,222,0.1))",
        border: "1px solid rgba(88,86,214,0.3)",
      }}
    >
      {/* Decorative elements */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-30"
        style={{ background: "radial-gradient(circle, #5856D6, transparent)" }}
      />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #5856D6, #AF52DE)" }}
          >
            <span className="material-symbols-outlined text-[20px] text-white">auto_stories</span>
          </div>
          <div>
            <p className="text-[14px] font-semibold text-white">
              {hasExistingDiary ? "Diario del día" : "¿Cómo ha ido el día?"}
            </p>
            <p className="text-[11px] text-[#c0c6d6]">
              {hasExistingDiary 
                ? "Ya tienes una entrada para hoy" 
                : "Guarda tus impresiones del Día " + dayNumber
              }
            </p>
          </div>
        </div>
        
        <p className="text-[13px] text-[#c0c6d6] mb-4 leading-relaxed">
          {hasExistingDiary
            ? "Puedes editar o revisar lo que escribiste sobre tus experiencias de hoy."
            : "Cuéntame qué te gustó, qué no tanto, y guarda momentos especiales. Esto me ayudará a mejorar tus futuras recomendaciones."
          }
        </p>

        <Link
          href={`/plan/diary?day=${dayNumber}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-[14px] text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #5856D6, #AF52DE)" }}
          data-testid="diary-prompt-btn"
        >
          <span className="material-symbols-outlined text-[18px]">
            {hasExistingDiary ? "edit" : "edit_note"}
          </span>
          {hasExistingDiary ? "Ver / Editar diario" : "Escribir diario del día"}
        </Link>
      </div>
    </motion.div>
  )
}
