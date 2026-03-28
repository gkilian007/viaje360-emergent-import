"use client"

import { useRef, useState, useEffect } from "react"
import Image from "next/image"
import { motion, useScroll, useTransform, useInView } from "framer-motion"

const destinations = [
  { name: "Tokyo", src: "/landing/tokyo.jpg", speed: 1.0 },
  { name: "Barcelona", src: "/landing/barcelona.jpg", speed: 1.08 },
  { name: "París", src: "/landing/paris.jpg", speed: 1.05 },
  { name: "Roma", src: "/landing/roma.jpg", speed: 1.12 },
]

const stats = [
  { value: 500, suffix: "+", label: "destinos" },
  { value: 10000, suffix: "+", label: "actividades" },
  { value: 4.8, suffix: "★", label: "valoración" },
]

function AnimatedCounter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.5 })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!isInView) return
    const isDecimal = value % 1 !== 0
    const duration = 1500
    const steps = 40
    const stepTime = duration / steps
    let current = 0
    const increment = value / steps

    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setDisplay(value)
        clearInterval(timer)
      } else {
        setDisplay(isDecimal ? Math.round(current * 10) / 10 : Math.floor(current))
      }
    }, stepTime)

    return () => clearInterval(timer)
  }, [isInView, value])

  const formatted = value >= 1000 ? display.toLocaleString("es-ES") : display

  return (
    <div ref={ref} className="flex flex-col items-center">
      <span className="text-4xl sm:text-5xl font-bold text-white">
        {formatted}
        {suffix}
      </span>
      <span className="text-gray-400 mt-1">{label}</span>
    </div>
  )
}

function DestinationCard({ dest, index }: { dest: typeof destinations[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const y = useTransform(scrollYProgress, [0, 1], ["-5%", `${(dest.speed - 1) * 100 + 5}%`])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      whileHover={{ scale: 1.03 }}
      className="relative overflow-hidden rounded-2xl aspect-[4/3] cursor-pointer group"
    >
      <motion.div
        className="absolute inset-0 w-full h-[115%] -top-[7.5%]"
        style={{ y, willChange: "transform" }}
      >
        <Image
          src={dest.src}
          alt={dest.name}
          fill
          className="object-cover transition-all duration-500 group-hover:brightness-110"
          loading="lazy"
          quality={80}
        />
      </motion.div>
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      {/* Name */}
      <div className="absolute bottom-4 left-4">
        <h3 className="text-2xl font-bold text-white">{dest.name}</h3>
      </div>
    </motion.div>
  )
}

export function Destinations() {
  return (
    <section className="py-24 px-6 bg-[#0a0a0c]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Donde quieras ir</h2>
          <p className="text-gray-400 text-xl">Desde capitales europeas hasta islas del Pacífico</p>
        </motion.div>

        {/* Grid 2x2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-20">
          {destinations.map((dest, i) => (
            <DestinationCard key={dest.name} dest={dest} index={i} />
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 py-12 border-t border-white/10">
          {stats.map((stat, i) => (
            <AnimatedCounter key={i} {...stat} />
          ))}
        </div>
      </div>
    </section>
  )
}
