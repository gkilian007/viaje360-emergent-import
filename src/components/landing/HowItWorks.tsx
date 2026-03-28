"use client"

import { motion } from "framer-motion"

const steps = [
  {
    emoji: "🎯",
    title: "Dinos tu destino y fechas",
    description: "Elige a dónde quieres ir, cuántos días y qué te gusta. La IA hace el resto.",
  },
  {
    emoji: "🤖",
    title: "Tu itinerario en segundos",
    description: "Recibe un plan día a día con horarios, rutas y recomendaciones locales.",
  },
  {
    emoji: "✨",
    title: "Adáptalo sobre la marcha",
    description: "¿Llueve? ¿Quieres cambiar algo? La IA se adapta en tiempo real.",
  },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative py-32 px-6 bg-[#0a0a0c]">
      <div className="max-w-6xl mx-auto">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Así de fácil</h2>
          <p className="text-gray-400 text-xl">Tres pasos para tu próxima aventura</p>
        </motion.div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="flex flex-col items-center text-center px-6"
            >
              <div className="text-7xl mb-6">{step.emoji}</div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5856D6] flex items-center justify-center text-white font-bold text-sm mb-4">
                {i + 1}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-gray-400 leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
