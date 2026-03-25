"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
// import { DesertDrift } from "@/components/ui/desert-drift"

const StarfieldBg = dynamic(
  () => import("@/components/ui/starfield-bg"),
  { ssr: false }
)

const HorizonHero = dynamic(
  () => import("@/components/ui/horizon-hero-section").then((m) => m.Component),
  { ssr: false }
)

// ─── Constants ───

const NAV_LINKS = [
  { id: "hero", label: "Inicio" },
  { id: "features", label: "Producto" },
  { id: "how-it-works", label: "Cómo funciona" },
  { id: "testimonials", label: "Reviews" },
  { id: "faq", label: "FAQ" },
]

const FEATURES = [
  {
    icon: "auto_awesome",
    title: "Itinerarios con IA",
    desc: "Planes día a día con actividades reales, horarios y URLs. No es un listado genérico — es accionable.",
    color: "#0A84FF",
  },
  {
    icon: "map",
    title: "Mapa interactivo",
    desc: "Ruta visual con marcadores emoji por tipo, popups dark y animaciones fly-to.",
    color: "#5856D6",
  },
  {
    icon: "psychology",
    title: "Aprende de ti",
    desc: "Recuerda tus gustos, feedback y viajes anteriores para mejorar cada plan.",
    color: "#FF9F0A",
  },
  {
    icon: "edit_note",
    title: "Diario de viaje",
    desc: "Captura tu día con conversación natural. Mood, energía y opiniones alimentan recomendaciones futuras.",
    color: "#30D158",
  },
  {
    icon: "thumb_up",
    title: "Feedback en vivo",
    desc: "Más de esto, menos de aquello. Tu feedback adapta el itinerario sobre la marcha.",
    color: "#FF453A",
  },
  {
    icon: "lock",
    title: "Fija lo esencial",
    desc: "Bloquea actividades que no quieres que cambien. El resto se ajusta alrededor.",
    color: "#BF5AF2",
  },
]

const STEPS = [
  { num: "01", title: "Cuéntanos tu viaje", desc: "Destino, fechas, estilo, presupuesto y preferencias en un wizard rápido." },
  { num: "02", title: "La IA planifica", desc: "Gemini genera un itinerario detallado con actividades, restaurantes y timings reales." },
  { num: "03", title: "Vive y adapta", desc: "Usa el plan, da feedback, fija favoritos — el itinerario evoluciona contigo." },
]

const REVIEWS = [
  { name: "Laura M.", location: "Madrid → Tokyo", text: "Me ahorró horas de planificación. El mapa con los marcadores emoji es genial para orientarte sobre la marcha.", stars: 5 },
  { name: "Carlos R.", location: "Barcelona → Roma", text: "Lo mejor es el feedback: le dije 'menos museos' y el día siguiente tenía más gastronomía. Impresionante.", stars: 5 },
  { name: "Ana P.", location: "Valencia → París", text: "El diario de viaje es adictivo. Al volver a París, la app ya sabía mis sitios favoritos.", stars: 5 },
]

const FAQS = [
  { q: "¿Es gratis?", a: "Puedes planificar tu primer viaje completamente gratis. Funciones avanzadas como adaptación ilimitada y diario están en el plan premium." },
  { q: "¿Qué destinos cubre?", a: "Cualquier destino del mundo. La IA genera planes con lugares, restaurantes y actividades verificables de cualquier ciudad." },
  { q: "¿Funciona sin conexión?", a: "El plan se guarda localmente. Puedes consultar tu itinerario completo sin conexión — solo necesitas internet para generar o adaptar." },
  { q: "¿Mis datos están seguros?", a: "Tus datos se almacenan en Supabase con cifrado en tránsito y en reposo. No vendemos ni compartimos información personal." },
]

// ─── Loader ───

function Loader({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const duration = 2200
    let raf: number

    function tick() {
      const elapsed = Date.now() - start
      const p = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - p, 3)
      setProgress(eased * 100)

      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setTimeout(onDone, 300)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0c] flex flex-col items-center justify-center gap-6 transition-opacity duration-500">
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(10,132,255,0.3), rgba(88,86,214,0.3))",
            border: "1px solid rgba(10,132,255,0.25)",
          }}
        >
          <span className="text-[28px]">✈️</span>
        </div>
        <span className="text-[24px] font-bold text-white tracking-tight">Viaje360</span>
      </div>

      <div className="w-48 h-[2px] bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #0A84FF, #5856D6)",
          }}
        />
      </div>

      <p className="text-[12px] text-[#666] font-medium tracking-widest uppercase">
        {progress < 50 ? "Cargando experiencia" : progress < 90 ? "Casi listo" : "¡Listo!"}
      </p>
    </div>
  )
}

// ─── Scroll-driven Video Hero ───
// The video is much taller than the viewport. As the user scrolls through the
// hero section (which is tall), the sticky viewport pans from the top third
// to the bottom third of the video, while also advancing video.currentTime.

function useScrollHero(sectionRef: React.RefObject<HTMLElement | null>) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const video = videoRef.current
    const section = sectionRef.current
    const wrap = videoWrapRef.current
    if (!video || !section || !wrap) return

    function sync() {
      if (!video || !section || !wrap) return

      const rect = section.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      const scrolled = -rect.top
      const progress = Math.max(0, Math.min(1, scrolled / scrollable))

      // Advance video time
      if (video.duration && isFinite(video.duration)) {
        video.currentTime = progress * video.duration
      }

      // Pan the video: at progress=0 show top third, progress=1 show bottom third
      // The video wrapper is ~180vh tall, viewport is 100vh, so we can shift
      // by up to -(180vh - 100vh) = -80vh
      const maxShift = wrap.offsetHeight - window.innerHeight
      wrap.style.transform = `translateY(${-progress * maxShift}px)`
    }

    let ticking = false
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        sync()
        ticking = false
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    video.addEventListener("loadedmetadata", sync)
    sync()

    return () => {
      window.removeEventListener("scroll", onScroll)
      video.removeEventListener("loadedmetadata", sync)
    }
  }, [sectionRef])

  return { videoRef, videoWrapRef }
}

// ─── Parallax Section ───

function useParallax(speed = 0.3) {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    let ticking = false

    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect()
          const center = rect.top + rect.height / 2 - window.innerHeight / 2
          setOffset(center * speed)
        }
        ticking = false
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [speed])

  return { ref, offset }
}

// ─── FAQ Item ───

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left p-5 rounded-2xl transition-all"
      style={{
        background: open ? "rgba(28,28,30,0.8)" : "rgba(28,28,30,0.4)",
        border: `1px solid ${open ? "rgba(10,132,255,0.15)" : "rgba(255,255,255,0.04)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-[15px] font-semibold">{q}</span>
        <span
          className="material-symbols-outlined text-[20px] text-[#0A84FF] transition-transform"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0)" }}
        >
          add
        </span>
      </div>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "200px" : "0", opacity: open ? 1 : 0, marginTop: open ? "12px" : "0" }}
      >
        <p className="text-[13px] text-[#9ca3af] leading-relaxed">{a}</p>
      </div>
    </button>
  )
}

// ─── Reveal on scroll ───

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.05, rootMargin: '0px 0px -30px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

// ─── Main Landing ───

export default function LandingPage() {
  const [loaded, setLoaded] = useState(false)
  const [activeSection, setActiveSection] = useState("hero")
  const [navSolid, setNavSolid] = useState(false)

  const handleLoaded = useCallback(() => setLoaded(true), [])


  // Override body overflow-hidden from root layout (required for sticky + GSAP ScrollTrigger)
  useEffect(() => {
    const body = document.body
    const html = document.documentElement
    body.style.overflow = "auto"
    body.style.height = "auto"
    body.style.overflowX = "hidden"
    html.style.height = "auto"
    html.style.overflow = "auto"
    html.style.overflowX = "hidden"
    return () => {
      body.style.overflow = ""
      body.style.height = ""
      body.style.overflowX = ""
      html.style.height = ""
      html.style.overflow = ""
      html.style.overflowX = ""
    }
  }, [])

  // Track active section + navbar background
  useEffect(() => {
    function onScroll() {
      setNavSolid(window.scrollY > 60)

      const sections = NAV_LINKS.map((l) => document.getElementById(l.id)).filter(Boolean) as HTMLElement[]
      for (let i = sections.length - 1; i >= 0; i--) {
        if (sections[i].getBoundingClientRect().top <= 120) {
          setActiveSection(NAV_LINKS[i].id)
          break
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const heroParallax = useParallax(0.25)

  if (!loaded) {
    return <Loader onDone={handleLoaded} />
  }

  return (
    <div className="text-[#e4e2e4] min-h-screen overflow-x-hidden scroll-smooth" style={{ background: 'transparent' }}>
      {/* ─── Fixed starfield background — stays behind everything ─── */}
      <StarfieldBg />

      {/* ─── Sticky Nav ─── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: navSolid ? "rgba(10,10,12,0.92)" : "transparent",
          backdropFilter: navSolid ? "blur(20px)" : "none",
          borderBottom: navSolid ? "1px solid rgba(255,255,255,0.04)" : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(10,132,255,0.3), rgba(88,86,214,0.3))",
                border: "1px solid rgba(10,132,255,0.25)",
              }}
            >
              <span className="text-[22px]">✈️</span>
            </div>
            <span className="text-[17px] font-bold tracking-tight text-white">Viaje360</span>
          </div>

          {/* Nav links — hidden on mobile */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className="px-3 py-2 rounded-lg text-[13px] font-medium transition-all"
                style={{
                  color: activeSection === link.id ? "#0A84FF" : "#9ca3af",
                  background: activeSection === link.id ? "rgba(10,132,255,0.08)" : "transparent",
                }}
              >
                {link.label}
              </a>
            ))}
          </div>

          <Link
            href="/login"
            className="px-5 py-2.5 rounded-full text-[13px] font-semibold text-white transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)" }}
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* ─── Hero — Three.js cinematic starfield ─── */}
      <section id="hero">
        <HorizonHero />
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="relative pt-8 pb-12 px-6 z-[1]">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-8">
            <p className="text-[12px] font-semibold tracking-widest uppercase text-[#0A84FF] mb-3">Producto</p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight">
              Todo para viajar mejor
            </h2>
            <p className="mt-4 text-[16px] text-[#9ca3af] max-w-lg mx-auto">
              Herramientas diseñadas para viajeros que quieren más que un listado de TripAdvisor.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <div
                  className="p-7 rounded-3xl h-full transition-all hover:scale-[1.02] hover:border-white/10"
                  style={{
                    background: "rgba(20,20,22,0.8)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
                    style={{
                      background: `${f.color}18`,
                      border: `1px solid ${f.color}25`,
                    }}
                  >
                    <span className="material-symbols-outlined text-[22px]" style={{ color: f.color }}>
                      {f.icon}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-bold mb-2">{f.title}</h3>
                  <p className="text-[14px] text-[#9ca3af] leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Phone showcase with second video ─── */}
      <section className="relative pt-8 pb-12 px-6 overflow-hidden z-[1]">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-10">
          {/* Video in phone frame */}
          <Reveal className="flex-1 flex justify-center">
            <div className="relative">
              <div
                className="w-[280px] rounded-[3rem] overflow-hidden"
                style={{
                  border: "4px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 40px 100px rgba(10,132,255,0.15), 0 0 60px rgba(88,86,214,0.08)",
                }}
              >
                <video autoPlay loop muted playsInline className="w-full block">
                  <source src="/hero-video2.mp4" type="video/mp4" />
                </video>
              </div>
              {/* Glow */}
              <div
                className="absolute -inset-20 -z-10 rounded-full opacity-30 blur-3xl"
                style={{ background: "radial-gradient(circle, rgba(10,132,255,0.3) 0%, transparent 70%)" }}
              />
            </div>
          </Reveal>

          {/* Text */}
          <div className="flex-1 space-y-6">
            <Reveal>
              <p className="text-[12px] font-semibold tracking-widest uppercase text-[#5856D6] mb-2">Experiencia móvil</p>
              <h2 className="text-[clamp(1.6rem,3vw,2.5rem)] font-bold tracking-tight leading-tight">
                Diseñado para usarse{" "}
                <span className="text-[#0A84FF]">sobre la marcha</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-[15px] text-[#9ca3af] leading-relaxed">
                Mapa interactivo con marcadores emoji, popups detallados y navegación fluida. Todo lo que necesitas mientras caminas por una ciudad nueva.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="flex flex-wrap gap-3 pt-2">
                {["Mapa dark", "Markers emoji", "Popups detallados", "Fly-to animado", "Offline ready"].map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 rounded-full text-[12px] font-medium text-[#c0c6d6]"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how-it-works" className="pt-8 pb-12 px-6 z-[1]">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-8">
            <p className="text-[12px] font-semibold tracking-widest uppercase text-[#30D158] mb-3">Cómo funciona</p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight">
              Tres pasos. Cero estrés.
            </h2>
          </Reveal>

          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <Reveal key={step.num} delay={i * 0.1}>
                <div
                  className="flex items-start gap-6 p-8 rounded-3xl"
                  style={{ background: "rgba(20,20,22,0.6)", border: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <span className="text-[48px] font-black bg-gradient-to-b from-[#0A84FF] to-[#5856D6] bg-clip-text text-transparent leading-none shrink-0">
                    {step.num}
                  </span>
                  <div>
                    <h3 className="text-[18px] font-bold mb-2">{step.title}</h3>
                    <p className="text-[14px] text-[#9ca3af] leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Reviews ─── */}
      <section id="testimonials" className="pt-8 pb-12 px-6 z-[1]">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-8">
            <p className="text-[12px] font-semibold tracking-widest uppercase text-[#FF9F0A] mb-3">Reviews</p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight">
              Lo que dicen los viajeros
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {REVIEWS.map((r, i) => (
              <Reveal key={r.name} delay={i * 0.1}>
                <div
                  className="p-7 rounded-3xl h-full"
                  style={{ background: "rgba(20,20,22,0.6)", border: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: r.stars }).map((_, j) => (
                      <span key={j} className="text-[#FF9F0A] text-[16px]">★</span>
                    ))}
                  </div>
                  <p className="text-[14px] text-[#c0c6d6] leading-relaxed mb-5 italic">
                    &ldquo;{r.text}&rdquo;
                  </p>
                  <div>
                    <p className="text-[14px] font-semibold">{r.name}</p>
                    <p className="text-[12px] text-[#666]">{r.location}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="pt-8 pb-12 px-6 z-[1]">
        <div className="max-w-2xl mx-auto">
          <Reveal className="text-center mb-8">
            <p className="text-[12px] font-semibold tracking-widest uppercase text-[#BF5AF2] mb-3">FAQ</p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight">
              Preguntas frecuentes
            </h2>
          </Reveal>

          <div className="space-y-3">
            {FAQS.map((faq) => (
              <Reveal key={faq.q}>
                <FaqItem q={faq.q} a={faq.a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="pt-8 pb-16 px-6 z-[1]">
        <Reveal>
          <div
            className="max-w-3xl mx-auto text-center p-14 rounded-[2rem] relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(10,132,255,0.1), rgba(88,86,214,0.1))",
              border: "1px solid rgba(10,132,255,0.15)",
            }}
          >
            {/* Glow */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] -z-10 opacity-40 blur-3xl"
              style={{ background: "radial-gradient(ellipse, rgba(10,132,255,0.4) 0%, transparent 70%)" }}
            />

            <h2 className="text-[clamp(1.6rem,4vw,2.5rem)] font-bold mb-4">
              ¿Listo para tu próximo viaje?
            </h2>
            <p className="text-[15px] text-[#9ca3af] mb-10 max-w-md mx-auto">
              Empieza a planificar gratis. Sin tarjeta. Sin compromisos.
            </p>
            <Link
              href="/onboarding"
              className="inline-block px-10 py-4.5 rounded-full text-[16px] font-bold text-white transition-all hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg, #0A84FF, #5856D6)", boxShadow: "0 8px 40px rgba(10,132,255,0.35)" }}
            >
              Empieza ahora →
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-10 px-6 border-t border-white/[0.03]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[18px]">✈️</span>
            <span className="text-[14px] font-semibold text-[#666]">Viaje360</span>
          </div>
          <p className="text-[12px] text-[#444]">
            © {new Date().getFullYear()} Viaje360. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
