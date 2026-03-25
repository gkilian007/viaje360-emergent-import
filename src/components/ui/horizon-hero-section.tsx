"use client"

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { gsap } from 'gsap'

export const Component = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)
  const phoneVideoRef = useRef<HTMLVideoElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)

  const threeRefs = useRef<{
    scene: THREE.Scene | null
    camera: THREE.PerspectiveCamera | null
    renderer: THREE.WebGLRenderer | null
    stars: THREE.Points[]
    nebula: THREE.Mesh | null
    mountains: THREE.Mesh[]
    animationId: number | null
  }>({ scene: null, camera: null, renderer: null, stars: [], nebula: null, mountains: [], animationId: null })

  useEffect(() => {
    if (!canvasRef.current) return
    const { current: refs } = threeRefs

    refs.scene = new THREE.Scene()
    refs.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
    refs.camera.position.set(0, 20, 100)

    refs.renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true })
    refs.renderer.setSize(window.innerWidth, window.innerHeight)
    refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    refs.renderer.toneMapping = THREE.ACESFilmicToneMapping
    refs.renderer.toneMappingExposure = 0.5

    // Stars
    for (let i = 0; i < 3; i++) {
      const count = 4000
      const geo = new THREE.BufferGeometry()
      const positions = new Float32Array(count * 3)
      const colors = new Float32Array(count * 3)
      const sizes = new Float32Array(count)
      for (let j = 0; j < count; j++) {
        const r = 200 + Math.random() * 800
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(Math.random() * 2 - 1)
        positions[j * 3] = r * Math.sin(phi) * Math.cos(theta)
        positions[j * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        positions[j * 3 + 2] = r * Math.cos(phi)
        const c = new THREE.Color()
        const rnd = Math.random()
        if (rnd < 0.7) c.setHSL(0, 0, 0.8 + Math.random() * 0.2)
        else if (rnd < 0.9) c.setHSL(0.08, 0.5, 0.8)
        else c.setHSL(0.6, 0.5, 0.8)
        colors[j * 3] = c.r; colors[j * 3 + 1] = c.g; colors[j * 3 + 2] = c.b
        sizes[j] = Math.random() * 2 + 0.5
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
      const mat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, depth: { value: i } },
        vertexShader: `attribute float size; attribute vec3 color; varying vec3 vColor; uniform float time; uniform float depth;
          void main() { vColor=color; vec3 p=position; float a=time*0.05*(1.0-depth*0.3); mat2 rot=mat2(cos(a),-sin(a),sin(a),cos(a)); p.xy=rot*p.xy; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=size*(300.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `varying vec3 vColor; void main(){ float d=length(gl_PointCoord-vec2(0.5)); if(d>0.5)discard; gl_FragColor=vec4(vColor,1.0-smoothstep(0.0,0.5,d)); }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      })
      const stars = new THREE.Points(geo, mat)
      refs.scene!.add(stars); refs.stars.push(stars)
    }

    // Nebula
    const nebGeo = new THREE.PlaneGeometry(6000, 3000, 60, 60)
    const nebMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, color1: { value: new THREE.Color(0x0033ff) }, color2: { value: new THREE.Color(0xff0066) } },
      vertexShader: `varying vec2 vUv; uniform float time; void main(){ vUv=uv; vec3 p=position; p.z+=sin(p.x*0.01+time)*cos(p.y*0.01+time)*20.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
      fragmentShader: `uniform vec3 color1; uniform vec3 color2; uniform float time; varying vec2 vUv; void main(){ float m=sin(vUv.x*10.0+time)*cos(vUv.y*10.0+time); vec3 c=mix(color1,color2,m*0.5+0.5); float a=0.2*(1.0-length(vUv-0.5)*2.0); gl_FragColor=vec4(c,a); }`,
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    })
    const nebula = new THREE.Mesh(nebGeo, nebMat)
    nebula.position.z = -600
    refs.scene!.add(nebula); refs.nebula = nebula

    // Mountains
    ;[
      { z: -80, op: 0.9, color: 0x0a0a1a, s: 1.4 },
      { z: -50, op: 0.85, color: 0x0d0d22, s: 1.2 },
      { z: -20, op: 0.95, color: 0x111130, s: 1.0 },
    ].forEach(({ z, op, color, s }) => {
      const pts: THREE.Vector2[] = []
      const seg = 100, w = 600 * s, base = -30
      pts.push(new THREE.Vector2(-w / 2, base))
      for (let k = 0; k <= seg; k++) {
        const x = -w / 2 + (w * k) / seg
        const y = base + Math.sin(k * 0.08) * 25 * s + Math.sin(k * 0.15 + 1.3) * 18 * s + Math.sin(k * 0.32 + 0.7) * 10 * s
        pts.push(new THREE.Vector2(x, y))
      }
      pts.push(new THREE.Vector2(w / 2, base)); pts.push(new THREE.Vector2(-w / 2, base))
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(new THREE.Shape(pts)),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.FrontSide })
      )
      mesh.position.z = z; refs.scene!.add(mesh); refs.mountains.push(mesh)
    })

    // Atmosphere glow
    const atmMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0x0a2fff) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; varying vec2 vUv; void main(){ float a=smoothstep(0.0,0.5,vUv.y)*(1.0-vUv.y)*0.6; gl_FragColor=vec4(color,a); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
    const atm = new THREE.Mesh(new THREE.PlaneGeometry(800, 60), atmMat)
    atm.position.set(0, -20, -10); refs.scene!.add(atm)

    // Animate
    const clock = new THREE.Clock()
    const animate = () => {
      const t = clock.getElapsedTime()
      refs.camera!.position.x = Math.sin(t * 0.08) * 5
      refs.camera!.position.y = 20 + Math.cos(t * 0.12) * 3
      refs.camera!.lookAt(0, 0, -50)
      refs.stars.forEach(s => { (s.material as THREE.ShaderMaterial).uniforms.time.value = t })
      if (refs.nebula) (refs.nebula.material as THREE.ShaderMaterial).uniforms.time.value = t * 0.3
      refs.mountains.forEach((m, i) => { m.position.x = Math.sin(t * 0.05 + i) * (2 + i * 1.5) })
      refs.renderer!.render(refs.scene!, refs.camera!)
      refs.animationId = requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => {
      refs.camera!.aspect = window.innerWidth / window.innerHeight
      refs.camera!.updateProjectionMatrix()
      refs.renderer!.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    if (phoneVideoRef.current) phoneVideoRef.current.play().catch(() => {})
    setIsReady(true)

    return () => {
      window.removeEventListener('resize', onResize)
      if (refs.animationId) cancelAnimationFrame(refs.animationId)
      refs.renderer?.dispose()
    }
  }, [])

  // Intro animations
  useEffect(() => {
    if (!isReady) return
    const tl = gsap.timeline()
    if (phoneRef.current) gsap.set(phoneRef.current, { scale: 0.85, opacity: 0, y: 30 })
    if (titleRef.current) tl.fromTo(titleRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' })
    if (subtitleRef.current) tl.fromTo(subtitleRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.7')
    if (ctaRef.current) tl.fromTo(ctaRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.5')
    if (phoneRef.current) tl.to(phoneRef.current, { scale: 1, opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }, '-=0.4')
    return () => { tl.kill() }
  }, [isReady])

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Three.js starfield background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 20%, rgba(0,0,0,0.45) 100%)' }} />

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none z-10" style={{ background: 'linear-gradient(to bottom, transparent, #0a0a0c)' }} />

      {/* Phone video — right side, mix-blend-mode removes black bg */}
      <div className="absolute inset-0 flex items-center justify-end pr-[4vw] pointer-events-none z-10 hidden md:flex">
        <div ref={phoneRef} className="relative opacity-0" style={{ width: 'clamp(260px, 28vw, 420px)' }}>
          <video
            ref={phoneVideoRef}
            muted autoPlay loop playsInline preload="auto"
            className="w-full h-auto"
            style={{ mixBlendMode: 'lighten' }}
          >
            <source src="/hero-video1.mp4" type="video/mp4" />
          </video>
        </div>
      </div>

      {/* Hero text — left side */}
      <div className="absolute inset-0 flex flex-col justify-center pl-[8vw] pr-4 md:pr-[35vw] z-20 pointer-events-none">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-semibold tracking-widest uppercase text-[#0A84FF] mb-6 w-fit" style={{ background: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.2)', backdropFilter: 'blur(10px)' }}>
          ✦ Impulsado por IA
        </div>

        <h1 ref={titleRef} className="text-[clamp(2rem,5vw,4rem)] font-extrabold leading-[1.05] tracking-tight max-w-xl opacity-0">
          Tu viaje perfecto,{' '}
          <span className="bg-gradient-to-r from-[#0A84FF] via-[#5856D6] to-[#BF5AF2] bg-clip-text text-transparent">
            planificado por IA
          </span>
        </h1>

        <p ref={subtitleRef} className="mt-5 text-[clamp(0.9rem,1.6vw,1.1rem)] text-[#c0c6d6] max-w-sm leading-relaxed opacity-0">
          Itinerarios cinematográficos que se adaptan a ti en tiempo real.
        </p>

        <div ref={ctaRef} className="mt-8 flex flex-col sm:flex-row gap-3 pointer-events-auto opacity-0">
          <a href="/onboarding" className="px-7 py-3.5 rounded-full text-[14px] font-semibold text-white transition-all hover:scale-[1.03] w-fit" style={{ background: 'linear-gradient(135deg, #0A84FF, #5856D6)', boxShadow: '0 8px 32px rgba(10,132,255,0.3)' }}>
            Planifica gratis →
          </a>
          <a href="#features" className="px-7 py-3.5 rounded-full text-[14px] font-medium text-[#c0c6d6] transition-all hover:text-white w-fit" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
            Descubre más
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce pointer-events-none z-20">
        <span className="text-[10px] text-[#555] uppercase tracking-widest">Scroll</span>
        <div className="w-[1px] h-8 bg-gradient-to-b from-[#555] to-transparent" />
      </div>
    </div>
  )
}
