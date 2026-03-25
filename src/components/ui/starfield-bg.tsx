"use client"

import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * StarfieldBg — Fixed parallax background with 3-tier depth system.
 *
 * Architecture (per Technical Standards):
 *   Back  layer (stars far)   → 15% scroll speed, slowest rotation
 *   Mid   layer (stars mid)   → 40% scroll speed
 *   Front layer (stars near)  → 0% scroll (fixed parity)
 *   Nebula                    → 20% scroll speed
 *
 * Accessibility:
 *   - aria-hidden="true" (decorative, no semantic content)
 *   - Respects prefers-reduced-motion: disables rotation + scroll parallax
 *   - GPU-only transforms (no layout recalculations)
 *   - will-change: transform on canvas
 *   - Mobile: reduced star count + disabled scroll parallax
 *
 * Performance:
 *   - powerPreference: 'high-performance'
 *   - Smooth scroll interpolation (lerp 0.08) prevents jitter
 *   - Only transform/opacity composited
 */
export default function StarfieldBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // ── Accessibility: detect reduced motion preference ────────────────
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = window.innerWidth < 768

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
    camera.position.set(0, 20, 100)

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: !isMobile, // save GPU on mobile
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.5

    // ── Layer config: back → mid → front ──────────────────────────────
    // Mobile: halved star counts for battery/GPU
    const mobileMult = isMobile ? 0.5 : 1
    const layerConfig = [
      { count: Math.floor(5000 * mobileMult), radiusMin: 400, radiusMax: 1000, scrollSpeed: 0.15, rotSpeed: prefersReducedMotion ? 0 : 0.02, sizeBase: 1.0, sizeVar: 1.5 },
      { count: Math.floor(4000 * mobileMult), radiusMin: 200, radiusMax: 600,  scrollSpeed: 0.40, rotSpeed: prefersReducedMotion ? 0 : 0.04, sizeBase: 1.5, sizeVar: 2.0 },
      { count: Math.floor(2000 * mobileMult), radiusMin: 80,  radiusMax: 300,  scrollSpeed: 0.00, rotSpeed: prefersReducedMotion ? 0 : 0.06, sizeBase: 2.0, sizeVar: 3.0 },
    ]

    const starLayers: { points: THREE.Points; scrollSpeed: number }[] = []

    layerConfig.forEach((cfg, i) => {
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array(cfg.count * 3)
      const col = new Float32Array(cfg.count * 3)
      const sz  = new Float32Array(cfg.count)

      for (let j = 0; j < cfg.count; j++) {
        const r     = cfg.radiusMin + Math.random() * (cfg.radiusMax - cfg.radiusMin)
        const theta = Math.random() * Math.PI * 2
        const phi   = Math.acos(Math.random() * 2 - 1)
        pos[j * 3]     = r * Math.sin(phi) * Math.cos(theta)
        pos[j * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        pos[j * 3 + 2] = r * Math.cos(phi)

        const c   = new THREE.Color()
        const rnd = Math.random()
        if (rnd < 0.6)       c.setHSL(0,    0,   0.75 + Math.random() * 0.25)
        else if (rnd < 0.8)  c.setHSL(0.08, 0.6, 0.85)
        else if (rnd < 0.95) c.setHSL(0.6,  0.5, 0.85)
        else                 c.setHSL(0.75, 0.4, 0.8)
        col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b
        sz[j] = cfg.sizeBase + Math.random() * cfg.sizeVar
      }

      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3))
      geo.setAttribute('size',     new THREE.BufferAttribute(sz, 1))

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          time:     { value: 0 },
          depth:    { value: i },
          rotSpeed: { value: cfg.rotSpeed },
          scrollY:  { value: 0 },
        },
        vertexShader: `
          attribute float size;
          attribute vec3 color;
          varying vec3 vColor;
          varying float vAlpha;
          uniform float time;
          uniform float rotSpeed;
          uniform float scrollY;

          void main() {
            vColor = color;
            vec3 p = position;

            // Differential rotation per layer
            float angle = time * rotSpeed;
            mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
            p.xz = rot * p.xz;

            // Parallax vertical drift from scroll
            p.y += scrollY;

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float dist = -mv.z;

            gl_PointSize = size * (350.0 / dist);

            // Depth-based alpha
            vAlpha = clamp(1.0 - (dist - 100.0) / 900.0, 0.2, 1.0);

            // Subtle twinkle
            vAlpha *= 0.85 + 0.15 * sin(time * 3.0 + position.x * 0.1 + position.y * 0.1);

            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vAlpha;

          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float glow = 1.0 - smoothstep(0.0, 0.5, d);
            glow = pow(glow, 1.5);
            gl_FragColor = vec4(vColor, glow * vAlpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })

      const points = new THREE.Points(geo, mat)
      scene.add(points)
      starLayers.push({ points, scrollSpeed: cfg.scrollSpeed })
    })

    // ── Nebula ─────────────────────────────────────────────────────────
    const nebMat = new THREE.ShaderMaterial({
      uniforms: {
        time:    { value: 0 },
        c1:      { value: new THREE.Color(0x0022aa) },
        c2:      { value: new THREE.Color(0x5500bb) },
        scrollY: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv; uniform float time; uniform float scrollY;
        void main() {
          vUv = uv; vec3 p = position;
          p.z += sin(p.x * 0.008 + time) * cos(p.y * 0.008 + time * 0.7) * 25.0;
          p.y += scrollY;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 c1; uniform vec3 c2; uniform float time; varying vec2 vUv;
        void main() {
          float n1 = sin(vUv.x * 6.0 + time * 0.8) * cos(vUv.y * 6.0 + time * 0.5);
          float n2 = sin(vUv.x * 12.0 - time * 0.3) * cos(vUv.y * 8.0 + time * 0.6);
          float mix_f = n1 * 0.6 + n2 * 0.4;
          vec3 c = mix(c1, c2, mix_f * 0.5 + 0.5);
          float radial = 1.0 - smoothstep(0.2, 0.7, length(vUv - 0.5));
          gl_FragColor = vec4(c, 0.15 * radial);
        }
      `,
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    })
    const nebula = new THREE.Mesh(new THREE.PlaneGeometry(7000, 3500, 80, 80), nebMat)
    nebula.position.z = -700
    scene.add(nebula)

    // ── Scroll tracking (passive listener — off main thread) ──────────
    let scrollNorm   = 0
    let scrollSmooth = 0
    const scrollDamping = 0.08

    // Reduced motion: disable scroll parallax entirely
    const scrollParallaxEnabled = !prefersReducedMotion && !isMobile

    const onScroll = () => {
      if (!scrollParallaxEnabled) return
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      scrollNorm = maxScroll > 0 ? window.scrollY / maxScroll : 0
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    // ── Reduced motion listener (live toggle) ─────────────────────────
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotionChange = (e: MediaQueryListEvent) => {
      starLayers.forEach(({ points }) => {
        const mat = points.material as THREE.ShaderMaterial
        mat.uniforms.rotSpeed.value = e.matches ? 0 : layerConfig[starLayers.indexOf({ points } as any)]?.rotSpeed ?? 0.04
      })
    }
    motionQuery.addEventListener('change', onMotionChange)

    // ── Animate ────────────────────────────────────────────────────────
    const clock = new THREE.Clock()
    let animId: number

    const animate = () => {
      const t = clock.getElapsedTime()

      // Smooth scroll interpolation
      if (scrollParallaxEnabled) {
        scrollSmooth += (scrollNorm - scrollSmooth) * scrollDamping
      }

      // Camera: subtle float + scroll-driven vertical pan
      const floatX = prefersReducedMotion ? 0 : Math.sin(t * 0.06) * 5
      const floatY = prefersReducedMotion ? 0 : Math.cos(t * 0.09) * 3
      camera.position.x = floatX
      camera.position.y = 20 + floatY - scrollSmooth * 40
      camera.lookAt(0, -scrollSmooth * 20, -50)

      // Update layers with differential scroll
      starLayers.forEach(({ points, scrollSpeed }) => {
        const mat = points.material as THREE.ShaderMaterial
        mat.uniforms.time.value = t
        mat.uniforms.scrollY.value = scrollSmooth * scrollSpeed * 80
      })

      // Nebula
      ;(nebula.material as THREE.ShaderMaterial).uniforms.time.value = prefersReducedMotion ? 0 : t * 0.25
      ;(nebula.material as THREE.ShaderMaterial).uniforms.scrollY.value = scrollSmooth * 0.2 * 80

      renderer.render(scene, camera)
      animId = requestAnimationFrame(animate)
    }
    animate()

    // ── Resize ─────────────────────────────────────────────────────────
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
      motionQuery.removeEventListener('change', onMotionChange)
      cancelAnimationFrame(animId)
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, willChange: 'transform' }}
    />
  )
}
