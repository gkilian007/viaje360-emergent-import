"use client"

import { useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useScroll, useTransform, useSpring } from "framer-motion"

interface FooterCTAProps {
  isAuthenticated?: boolean
}

export function FooterCTA({ isAuthenticated = false }: FooterCTAProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const rawY = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"])
  const imgY = useSpring(rawY, { stiffness: 100, damping: 30 })

  return (
    <section ref={ref} className="relative min-h-[70vh] overflow-hidden flex flex-col items-center justify-center">
      {/* Parallax background */}
      <motion.div
        className="absolute inset-0 w-full h-[130%] -top-[15%]"
        style={{ y: imgY, willChange: "transform" }}
      >
        <Image
          src="/landing/hero-santorini.jpg"
          alt="Santorini"
          fill
          className="object-cover"
          loading="lazy"
          quality={80}
        />
      </motion.div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 py-20">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
          className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-8 leading-tight max-w-4xl"
        >
          Tu próximo viaje empieza aquí
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <Link
            href={isAuthenticated ? "/home" : "/onboarding"}
            prefetch
            className="px-10 py-5 rounded-2xl bg-gradient-to-r from-[#0A84FF] to-[#5856D6] text-white font-bold text-xl hover:opacity-90 transition-opacity shadow-2xl shadow-blue-500/30 inline-block"
          >
            {isAuthenticated ? "Ir a mi viaje →" : "Planifica gratis →"}
          </Link>
        </motion.div>

        {/* Footer links */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-4 text-gray-400 text-sm"
        >
          <Link href="/privacidad" className="hover:text-white transition-colors">
            Privacidad
          </Link>
          <span>·</span>
          <Link href="/terminos" className="hover:text-white transition-colors">
            Términos
          </Link>
          <span>·</span>
          <Link href="/contacto" className="hover:text-white transition-colors">
            Contacto
          </Link>
          <span>·</span>
          <span>© 2026 Viaje360</span>
        </motion.div>
      </div>
    </section>
  )
}
