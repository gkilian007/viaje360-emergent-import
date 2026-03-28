"use client"

import Link from "next/link"
import { motion } from "framer-motion"

const plans = [
  {
    name: "Gratis",
    price: "€0",
    description: "2 días gratis al llegar",
    features: ["Itinerario con IA", "Adaptación al clima", "Mapa interactivo"],
    cta: "Empezar gratis",
    href: "/onboarding",
    popular: false,
    gradient: false,
  },
  {
    name: "Por destino",
    price: "€4.99",
    description: "Pago único",
    features: [
      "Todo lo del plan Gratis",
      "Diario de viaje",
      "Momentos mágicos",
      "Sin límite de días",
    ],
    cta: "Elegir destino",
    href: "/onboarding",
    popular: false,
    gradient: false,
  },
  {
    name: "Anual",
    price: "€29.99",
    period: "/año",
    description: "Más popular",
    features: [
      "Todo incluido",
      "Viajes ilimitados",
      "Soporte prioritario",
    ],
    cta: "Suscribirse",
    href: "/onboarding",
    popular: true,
    gradient: true,
  },
]

export function PricingSection() {
  return (
    <section className="py-24 px-6 bg-[#131315]">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Planes para cada viajero
          </h2>
          <p className="text-gray-400 text-xl">Comienza gratis, mejora cuando quieras</p>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative rounded-3xl p-8 flex flex-col"
              style={{
                background: plan.popular
                  ? "rgba(10, 132, 255, 0.1)"
                  : "rgba(255,255,255,0.04)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: plan.popular
                  ? "1px solid rgba(10, 132, 255, 0.4)"
                  : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5856D6] text-white text-xs font-semibold whitespace-nowrap">
                    ✨ Más popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-400 mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  {plan.period && (
                    <span className="text-gray-400">{plan.period}</span>
                  )}
                </div>
                <p className="text-gray-500 text-sm">{plan.description}</p>
              </div>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-gray-300">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5856D6] flex items-center justify-center flex-shrink-0 text-xs">
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`w-full py-3 rounded-xl text-center font-semibold transition-all ${
                  plan.gradient
                    ? "bg-gradient-to-r from-[#0A84FF] to-[#5856D6] text-white hover:opacity-90 shadow-lg shadow-blue-500/20"
                    : "border border-white/20 text-white hover:bg-white/10"
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
