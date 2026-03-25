"use client"

import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Hero — single viewport, spring physics entrance, scroll-driven parallax.
 *
 * Accessibility:
 *   - prefers-reduced-motion: disables all animation, shows static state
 *   - Keyboard focus indicators preserved (pointer-events-auto on CTAs)
 *   - Semantic structure: h1, p, nav-like links
 *   - No re-animation on up-scroll (static final states)
 *
 * Performance:
 *   - Only transform + opacity animated (GPU composited)
 *   - will-change hints on animated elements
 *   - GSAP scrub uses passive scroll listener internally
 */
export const Component = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoWrapRef = useRef<HTMLDivElement>(null)
  const badgeRef     = useRef<HTMLDivElement>(null)
  const titleRef     = useRef<HTMLHeadingElement>(null)
  const subtitleRef  = useRef<HTMLParagraphElement>(null)
  const ctaRef       = useRef<HTMLDivElement>(null)
  const scrollRef    = useRef<HTMLDivElement>(null)

  // ── Entrance animations ─────────────────────────────────────────────
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      // Show everything immediately — no animation
      ;[badgeRef, titleRef, subtitleRef, ctaRef, videoWrapRef, scrollRef].forEach(r => {
        if (r.current) {
          r.current.style.opacity = '1'
          r.current.style.transform = 'none'
          r.current.style.filter = 'none'
        }
      })
      return
    }

    const springEase = 'elastic.out(1, 0.75)'
    const smoothEase = 'power4.out'
    const tl = gsap.timeline({ delay: 0.4 })

    if (badgeRef.current)
      tl.fromTo(badgeRef.current,
        { opacity: 0, y: 24, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 1, ease: springEase })

    if (titleRef.current)
      tl.fromTo(titleRef.current,
        { opacity: 0, y: 50, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: smoothEase }, '-=0.6')

    if (subtitleRef.current)
      tl.fromTo(subtitleRef.current,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.8, ease: smoothEase }, '-=0.7')

    if (ctaRef.current)
      tl.fromTo(ctaRef.current,
        { opacity: 0, y: 20, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: springEase }, '-=0.5')

    if (videoWrapRef.current)
      tl.fromTo(videoWrapRef.current,
        { opacity: 0, scale: 0.8, x: 60 },
        { opacity: 1, scale: 1, x: 0, duration: 1.4, ease: springEase }, '-=1.0')

    if (scrollRef.current)
      tl.fromTo(scrollRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'power2.out' }, '-=0.3')

    return () => { tl.kill() }
  }, [])

  // ── Scroll-driven parallax ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return // No scroll animation

    const ctx = gsap.context(() => {
      // Front layer: text moves up faster
      const textEls = [badgeRef.current, titleRef.current, subtitleRef.current, ctaRef.current].filter(Boolean)
      textEls.forEach((el, i) => {
        gsap.to(el!, {
          y: -(60 + i * 15),
          ease: 'none',
          scrollTrigger: { trigger: containerRef.current, start: 'top top', end: 'bottom top', scrub: 0.8 },
        })
      })

      // Mid layer: phone drifts slower (60% speed)
      if (videoWrapRef.current) {
        gsap.to(videoWrapRef.current, {
          y: -30,
          ease: 'none',
          scrollTrigger: { trigger: containerRef.current, start: 'top top', end: 'bottom top', scrub: 0.8 },
        })
      }

      // Scroll indicator fades
      if (scrollRef.current) {
        gsap.to(scrollRef.current, {
          opacity: 0, y: -10,
          scrollTrigger: { trigger: containerRef.current, start: '5% top', end: '15% top', scrub: true },
        })
      }
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} className="relative w-full h-screen z-[1]" role="banner">

      {/* Phone video — right, mid-layer parallax */}
      <div className="absolute inset-0 flex items-center justify-end pr-[6vw] pointer-events-none hidden md:flex">
        <div ref={videoWrapRef} style={{ width: 'clamp(240px, 24vw, 380px)', opacity: 0, willChange: 'transform, opacity' }}>
          <video
            muted autoPlay loop playsInline preload="auto"
            aria-hidden="true"
            className="w-full h-auto"
            style={{ mixBlendMode: 'lighten', filter: 'drop-shadow(0 20px 60px rgba(10,132,255,0.15))' }}
          >
            <source src="/hero-video1.mp4" type="video/mp4" />
          </video>
        </div>
      </div>

      {/* Hero text — left, front-layer parallax */}
      <div className="absolute inset-0 flex flex-col justify-center pl-[8vw] pr-4 md:pr-[38vw] pointer-events-none">
        <div ref={badgeRef}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-semibold tracking-widest uppercase text-[#0A84FF] mb-6 w-fit pointer-events-auto"
          style={{ background: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.2)', backdropFilter: 'blur(10px)', opacity: 0, willChange: 'transform, opacity' }}
        >
          ✦ Impulsado por IA
        </div>

        <h1 ref={titleRef}
          className="text-[clamp(2rem,5vw,4rem)] font-extrabold leading-[1.05] tracking-tight max-w-xl"
          style={{ opacity: 0, willChange: 'transform, opacity, filter' }}
        >
          Tu viaje perfecto,{' '}
          <span className="bg-gradient-to-r from-[#0A84FF] via-[#5856D6] to-[#BF5AF2] bg-clip-text text-transparent">
            planificado por IA
          </span>
        </h1>

        <p ref={subtitleRef}
          className="mt-5 text-[clamp(0.9rem,1.6vw,1.1rem)] text-[#c0c6d6] max-w-sm leading-relaxed"
          style={{ opacity: 0, willChange: 'transform, opacity' }}
        >
          Itinerarios cinematográficos que se adaptan a ti en tiempo real.
        </p>

        <div ref={ctaRef}
          className="mt-8 flex flex-col sm:flex-row gap-3 pointer-events-auto"
          style={{ opacity: 0, willChange: 'transform, opacity' }}
        >
          <a href="/onboarding"
            className="px-7 py-3.5 rounded-full text-[14px] font-semibold text-white transition-all hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A84FF] w-fit"
            style={{ background: 'linear-gradient(135deg, #0A84FF, #5856D6)', boxShadow: '0 8px 32px rgba(10,132,255,0.3)' }}>
            Planifica gratis →
          </a>
          <a href="#features"
            className="px-7 py-3.5 rounded-full text-[14px] font-medium text-[#c0c6d6] transition-all hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5856D6] w-fit"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
            Descubre más
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div ref={scrollRef} className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none" aria-hidden="true">
        <span className="text-[10px] text-[#555] uppercase tracking-widest">Scroll</span>
        <div className="w-[1px] h-8 bg-gradient-to-b from-[#555] to-transparent animate-bounce" />
      </div>
    </div>
  )
}
