"use client"

import { useEffect, useRef, useState } from "react"
import IPhoneMockup from "./IPhoneMockup"

const features = [
  { emoji: "🤖", title: "IA Personalizada", desc: "Itinerarios que se adaptan a ti en tiempo real" },
  { emoji: "🗺️", title: "Mapa Interactivo", desc: "Visualiza todo tu viaje con markers inteligentes" },
  { emoji: "📔", title: "Diario de Viaje", desc: "La IA captura tus experiencias automáticamente" },
  { emoji: "⭐", title: "Recomendaciones", desc: "Aprende de tus gustos para mejorar cada viaje" },
  { emoji: "🔄", title: "Adaptación Live", desc: "Cambia planes sobre la marcha sin perder el hilo" },
  { emoji: "💰", title: "Control de Gastos", desc: "Presupuesto inteligente por actividad y día" },
]

export default function ParallaxHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [motionOk, setMotionOk] = useState(true)
  const [motionEnabled, setMotionEnabled] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setMotionOk(!mq.matches)
    const handler = (e: MediaQueryListEvent) => setMotionOk(!e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const shouldAnimate = motionOk && motionEnabled

  useEffect(() => {
    if (!shouldAnimate || !containerRef.current) return

    let ctx: ReturnType<typeof import("gsap").gsap.context> | undefined

    Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
    ]).then(([gsapMod, stMod]) => {
      const gsap = gsapMod.gsap
      const ScrollTrigger = stMod.ScrollTrigger
      gsap.registerPlugin(ScrollTrigger)

      ctx = gsap.context(() => {
        const master = gsap.timeline({
          scrollTrigger: {
            trigger: ".parallax-stage",
            start: "top top",
            end: "+=200%",
            scrub: 1,
            pin: true,
          },
        })

        // === PHASE 1: Hero (scroll 0–33%) ===
        master
          .from(".phone-1", {
            rotateY: 45, rotateX: 12, scale: 0.8,
            duration: 0.8, ease: "power2.out",
          }, 0)
          .from(".hero-title", {
            y: 60, opacity: 0, duration: 0.5, ease: "power2.out",
          }, 0)
          .from(".hero-subtitle", {
            y: 40, opacity: 0, duration: 0.5, ease: "power2.out",
          }, 0.15)

        // === Crossfade 1→2 ===
          .to(".phase-1", {
            opacity: 0, scale: 0.95, duration: 0.3, ease: "power1.in",
          }, 0.9)
          .to(".phase-2", {
            opacity: 1, duration: 0.3, ease: "power1.out",
          }, 1.0)
          .from(".phone-2", {
            rotateY: 15, scale: 0.92,
            duration: 0.5, ease: "power3.out",
          }, 1.0)
          .from(".mid-text", {
            y: 25, opacity: 0, duration: 0.4, ease: "power2.out",
          }, 1.15)

        // === Crossfade 2→3 ===
          .to(".phase-2", {
            opacity: 0, scale: 0.95, duration: 0.3, ease: "power1.in",
          }, 1.8)
          .to(".phase-3", {
            opacity: 1, duration: 0.3, ease: "power1.out",
          }, 1.9)
          .from(".phone-3", {
            scale: 0.88, y: 30,
            duration: 0.4, ease: "power2.out",
          }, 1.9)
          .from(".feature-card", {
            scale: 0.2, opacity: 0, y: 50,
            stagger: 0.04, duration: 0.3, ease: "back.out(1.7)",
          }, 2.05)
          .from(".feature-glow", {
            opacity: 0, duration: 0.3,
          }, 2.05)

      }, containerRef)
    })

    return () => { ctx?.revert() }
  }, [shouldAnimate])

  return (
    <div ref={containerRef} className="parallax-container relative bg-[#0a0a1a]">
      {/* Motion toggle — WCAG SC 2.2.2 */}
      <button
        onClick={() => setMotionEnabled((v) => !v)}
        className="fixed top-4 right-4 z-50 bg-white/10 backdrop-blur-md text-white/80 text-xs px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/20 transition-colors"
        aria-label={motionEnabled ? "Pausar animaciones" : "Activar animaciones"}
      >
        {motionEnabled ? "⏸ Pausar motion" : "▶ Activar motion"}
      </button>

      {/* Background */}
      <div className="bg-gradient-layer fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a] via-[#131325] to-[#0a0a1a]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(99,102,241,0.08),transparent_70%)]" />
      </div>

      {/* ============ SINGLE PINNED STAGE ============ */}
      <div className="parallax-stage relative h-screen overflow-hidden">

        {/* --- Phase 1: Hero --- */}
        <div className="phase-1 absolute inset-0 flex items-center justify-center">
          <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <h1 className="hero-title text-5xl md:text-7xl font-bold text-white leading-tight">
                Tu viaje perfecto,
                <br />
                <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                  planificado por IA
                </span>
              </h1>
              <p className="hero-subtitle mt-6 text-lg md:text-xl text-white/60 max-w-md">
                Viaje360 crea itinerarios personalizados que se adaptan en tiempo
                real a tus gustos, tu ritmo y tus descubrimientos.
              </p>
            </div>
            <div
              className="phone-1 flex-1 flex justify-center"
              style={{ perspective: "1200px", transformStyle: "preserve-3d" }}
            >
              <IPhoneMockup
                src="/parallax/screen-plan.jpg"
                alt="Viaje360 — Plan Tokyo"
                width={300}
              />
            </div>
          </div>
        </div>

        {/* --- Phase 2: Transition --- */}
        <div className="phase-2 absolute inset-0 flex items-center justify-center opacity-0">
          <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-8">
            <div
              className="phone-2"
              style={{ perspective: "1200px", transformStyle: "preserve-3d" }}
            >
              <IPhoneMockup
                src="/parallax/screen-plan.jpg"
                alt="Viaje360 — Plan Tokyo"
                width={320}
              />
            </div>
            <div className="mid-text text-center max-w-lg">
              <h2 className="text-3xl md:text-5xl font-bold text-white">
                Todo para viajar{" "}
                <span className="text-cyan-400">mejor</span>
              </h2>
              <p className="mt-4 text-white/50 text-lg">
                Un asistente que aprende contigo, viaje tras viaje.
              </p>
            </div>
          </div>
        </div>

        {/* --- Phase 3: Features pop out --- */}
        <div className="phase-3 absolute inset-0 flex items-center justify-center opacity-0">
          <div className="feature-glow absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(99,102,241,0.15),transparent_60%)] pointer-events-none" />
          <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-6">
            <div className="phone-3">
              <IPhoneMockup
                src="/parallax/screen-plan.jpg"
                alt="Viaje360 — Vista completa"
                width={240}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 w-full max-w-2xl">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="feature-card bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center hover:bg-white/10 transition-colors"
                >
                  <div className="text-2xl mb-2">{f.emoji}</div>
                  <h3 className="text-white font-semibold text-sm">{f.title}</h3>
                  <p className="text-white/40 text-xs mt-1">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ CTA Final ============ */}
      <section className="relative h-[50vh] flex items-center justify-center bg-[#0a0a1a]">
        <div className="text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Empieza tu aventura
          </h2>
          <a
            href="/onboarding"
            className="inline-block bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold text-lg px-10 py-4 rounded-full hover:shadow-lg hover:shadow-indigo-500/30 transition-all hover:scale-105"
          >
            Crear mi primer viaje →
          </a>
        </div>
      </section>
    </div>
  )
}
