"use client"

import { motion } from "framer-motion"

interface SliderProps {
  label: string
  icon: string
  value: number
  onChange: (value: number) => void
  lowLabel: string
  highLabel: string
  color: string
}

function Slider({ label, icon, value, onChange, lowLabel, highLabel, color }: SliderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]" style={{ color }}>
          {icon}
        </span>
        <span className="text-[13px] text-white font-medium">{label}</span>
      </div>
      
      <div className="relative">
        <div className="flex justify-between mb-2">
          {[1, 2, 3, 4, 5].map((level) => (
            <motion.button
              key={level}
              onClick={() => onChange(level)}
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-semibold transition-all"
              style={{
                background: value === level ? `${color}20` : "rgba(42,42,44,0.6)",
                border: `2px solid ${value === level ? color : "transparent"}`,
                color: value === level ? color : "#c0c6d6",
              }}
              data-testid={`${label.toLowerCase()}-level-${level}`}
            >
              {level}
            </motion.button>
          ))}
        </div>
        <div className="flex justify-between px-1">
          <span className="text-[10px] text-[#c0c6d6]">{lowLabel}</span>
          <span className="text-[10px] text-[#c0c6d6]">{highLabel}</span>
        </div>
      </div>
    </div>
  )
}

interface EnergyPaceSliderProps {
  energyValue: number
  paceValue: number
  onEnergyChange: (value: number) => void
  onPaceChange: (value: number) => void
}

export function EnergyPaceSlider({
  energyValue,
  paceValue,
  onEnergyChange,
  onPaceChange,
}: EnergyPaceSliderProps) {
  return (
    <div className="flex flex-col gap-5">
      <Slider
        label="Energía"
        icon="bolt"
        value={energyValue}
        onChange={onEnergyChange}
        lowLabel="Agotado"
        highLabel="Lleno de energía"
        color="#30D158"
      />
      <Slider
        label="Ritmo del día"
        icon="speed"
        value={paceValue}
        onChange={onPaceChange}
        lowLabel="Muy lento"
        highLabel="Muy intenso"
        color="#0A84FF"
      />
    </div>
  )
}
