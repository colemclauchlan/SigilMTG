// web/src/pages/Landing.tsx
// #84 — Faithful React port of Cole's original "Midnight Azure" landing (home.js).
//
// Structure:
//   1. Full-viewport Three.js hero canvas (dark azure fog, floating foil cards,
//      tumbling D6/D20 dice, rotating mana-pentad, dust sprites).
//   2. Hero overlay: foil "Sigil" title, tagline, CTA buttons, format chips.
//   3. Feature sections (three cards: Life/Decks/Tabletop).
//   4. Final CTA section.
//
// Three.js is dynamically imported so the bundle only loads it when Landing mounts.
// Dep required: `npm i three @types/three` inside web/ (not yet in package.json —
// see DEPLOY note below; code is written; add the dep before Vercel deploy).
//
// DEPLOY NOTE: `three` is NOT yet in web/package.json. Run:
//   cd web && npm i three @types/three
// before deploying. The import() below will fail at runtime without it.

import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, ArrowRight, CheckCircle2 } from 'lucide-react'
import SigilSeal from '../components/SigilSeal'

// ── Animation helpers ─────────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
})

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
}
const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
}

// ── Three.js scene ─────────────────────────────────────────────────────────────
// Ported faithfully from home.js: same geometry, lights, fog, textures.
// Uses dynamic import so three.js is a separate async chunk.
function useThreeScene(canvasRef: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    if (!canvasRef.current) return

    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
    const lowPower =
      coarse || (navigator.hardwareConcurrency ?? 8) <= 4 || window.innerWidth < 760

    if (reduceMotion) return // respect user preference

    let rafId = 0
    let destroyed = false

    // Dynamic import — fails gracefully if `three` not yet installed
    import('three').then((THREE) => {
      if (destroyed || !canvasRef.current) return

      const canvas = canvasRef.current

      // ── Renderer ──────────────────────────────────────────────────────────
      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: !lowPower,
          alpha: true,
          powerPreference: 'high-performance',
        })
      } catch {
        return // WebGL unavailable
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, lowPower ? 1.5 : 2))
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.1

      const scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x070d1a, 0.05)

      const sz = { w: canvas.clientWidth || window.innerWidth, h: canvas.clientHeight || window.innerHeight }
      const camera = new THREE.PerspectiveCamera(50, sz.w / sz.h, 0.1, 100)
      camera.position.set(0, 0, 6.6)

      // ── IBL from gradient canvas ──────────────────────────────────────────
      ;(() => {
        const c = document.createElement('canvas')
        c.width = 16; c.height = 128
        const ctx = c.getContext('2d')!
        const g = ctx.createLinearGradient(0, 0, 0, 128)
        g.addColorStop(0, '#34507e')
        g.addColorStop(0.5, '#13223e')
        g.addColorStop(1, '#0a1322')
        ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 128)
        const tex = new THREE.CanvasTexture(c)
        tex.mapping = THREE.EquirectangularReflectionMapping
        try {
          const pmrem = new THREE.PMREMGenerator(renderer)
          scene.environment = pmrem.fromEquirectangular(tex).texture
          pmrem.dispose()
        } catch { /* optional */ }
        tex.dispose()
      })()

      // ── Lights ────────────────────────────────────────────────────────────
      const key = new THREE.DirectionalLight(0xdce8ff, 1.6)
      key.position.set(4, 6, 6); scene.add(key)
      const fill = new THREE.PointLight(0x6fb0ff, 0.9, 40)
      fill.position.set(-6, -2, 4); scene.add(fill)
      scene.add(new THREE.AmbientLight(0x2a3550, 0.8))
      const shimmer = new THREE.PointLight(0xbcd8ff, 1.2, 30); scene.add(shimmer)

      const world = new THREE.Group(); scene.add(world)

      // ── Canvas texture helpers ────────────────────────────────────────────
      function roundRect(
        ctx: CanvasRenderingContext2D,
        x: number, y: number, ww: number, hh: number, r: number,
      ) {
        ctx.beginPath(); ctx.moveTo(x + r, y)
        ctx.arcTo(x + ww, y, x + ww, y + hh, r)
        ctx.arcTo(x + ww, y + hh, x, y + hh, r)
        ctx.arcTo(x, y + hh, x, y, r)
        ctx.arcTo(x, y, x + ww, y, r)
        ctx.closePath()
      }
      function hexCol(n: number) { return '#' + n.toString(16).padStart(6, '0') }
      function mkTex(c: HTMLCanvasElement) {
        const t = new THREE.CanvasTexture(c)
        t.anisotropy = renderer.capabilities.getMaxAnisotropy()
        return t
      }
      function lighten(intC: number, amt: number) {
        const r = ((intC >> 16) & 255), g = ((intC >> 8) & 255), b = intC & 255
        return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(g + (255 - g) * amt)},${Math.round(b + (255 - b) * amt)})`
      }

      const MANA: Record<string, number> = { W: 0xeef0ea, U: 0x4aa3e6, B: 0x9b86c4, R: 0xe0655c, G: 0x46b277 }
      const MANA_KEYS = ['W', 'U', 'B', 'R', 'G']

      function drawManaSymbol(ctx: CanvasRenderingContext2D, key: string, s: number, fill: string) {
        ctx.save()
        ctx.fillStyle = fill; ctx.strokeStyle = fill; ctx.lineJoin = 'round'; ctx.lineCap = 'round'
        if (key === 'W') {
          for (let i = 0; i < 8; i++) {
            ctx.save(); ctx.rotate(i / 8 * Math.PI * 2)
            ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.6); ctx.lineTo(s * 0.1, -s * 0.6); ctx.lineTo(0, -s * 0.95); ctx.closePath(); ctx.fill(); ctx.restore()
          }
          ctx.beginPath(); ctx.arc(0, 0, s * 0.46, 0, Math.PI * 2); ctx.fill()
        } else if (key === 'U') {
          ctx.beginPath(); ctx.moveTo(0, -s * 0.88); ctx.bezierCurveTo(s * 0.72, -s * 0.2, s * 0.6, s * 0.72, 0, s * 0.8); ctx.bezierCurveTo(-s * 0.6, s * 0.72, -s * 0.72, -s * 0.2, 0, -s * 0.88); ctx.closePath(); ctx.fill()
        } else if (key === 'B') {
          ctx.beginPath(); ctx.arc(0, -s * 0.12, s * 0.56, Math.PI, 0); ctx.lineTo(s * 0.4, s * 0.34); ctx.lineTo(s * 0.2, s * 0.34); ctx.lineTo(s * 0.2, s * 0.56); ctx.lineTo(-s * 0.2, s * 0.56); ctx.lineTo(-s * 0.2, s * 0.34); ctx.lineTo(-s * 0.4, s * 0.34); ctx.closePath(); ctx.fill()
          ctx.fillStyle = 'rgba(8,14,26,0.92)'
          ctx.beginPath(); ctx.arc(-s * 0.23, -s * 0.06, s * 0.17, 0, Math.PI * 2); ctx.fill()
          ctx.beginPath(); ctx.arc(s * 0.23, -s * 0.06, s * 0.17, 0, Math.PI * 2); ctx.fill()
        } else if (key === 'R') {
          ctx.beginPath(); ctx.moveTo(0, -s * 0.92); ctx.bezierCurveTo(s * 0.55, -s * 0.3, s * 0.22, -s * 0.08, s * 0.32, s * 0.2); ctx.bezierCurveTo(s * 0.55, s * 0.62, s * 0.1, s * 0.86, 0, s * 0.86); ctx.bezierCurveTo(-s * 0.5, s * 0.86, -s * 0.56, s * 0.3, -s * 0.26, 0); ctx.bezierCurveTo(-s * 0.1, -s * 0.16, -s * 0.2, -s * 0.5, 0, -s * 0.92); ctx.closePath(); ctx.fill()
        } else {
          ctx.fillRect(-s * 0.12, s * 0.1, s * 0.24, s * 0.62)
          ctx.beginPath(); ctx.arc(0, -s * 0.22, s * 0.5, 0, Math.PI * 2); ctx.fill()
          ctx.beginPath(); ctx.arc(-s * 0.36, s * 0.04, s * 0.32, 0, Math.PI * 2); ctx.fill()
          ctx.beginPath(); ctx.arc(s * 0.36, s * 0.04, s * 0.32, 0, Math.PI * 2); ctx.fill()
        }
        ctx.restore()
      }

      // Sigil mana-seal on canvas: glow + ring + pentagon + 5 WUBRG nodes
      function drawSigilSeal(
        ctx: CanvasRenderingContext2D, s: number, ringColor: string, withGlow: boolean,
      ) {
        ctx.save()
        if (withGlow) {
          const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.18)
          gl.addColorStop(0, 'rgba(77,163,255,0.34)'); gl.addColorStop(1, 'rgba(77,163,255,0)')
          ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, s * 1.18, 0, Math.PI * 2); ctx.fill()
        }
        ctx.strokeStyle = ringColor; ctx.lineWidth = s * 0.05; ctx.globalAlpha = 0.85
        ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke()
        const rr = s * 0.92
        const pts: [number, number][] = []
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + i * 2 * Math.PI / 5
          pts.push([Math.cos(a) * rr, Math.sin(a) * rr])
        }
        ctx.globalAlpha = 0.7; ctx.lineWidth = s * 0.04; ctx.beginPath()
        for (let j = 0; j < 5; j++) {
          const p = pts[j]; j === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])
        }
        ctx.closePath(); ctx.stroke()
        MANA_KEYS.forEach((mk, idx) => {
          ctx.globalAlpha = 1; ctx.fillStyle = hexCol(MANA[mk])
          ctx.beginPath(); ctx.arc(pts[idx][0], pts[idx][1], s * 0.15, 0, Math.PI * 2); ctx.fill()
          ctx.lineWidth = s * 0.025; ctx.strokeStyle = '#070d18'; ctx.stroke()
        })
        ctx.restore()
      }

      // ── Textures ──────────────────────────────────────────────────────────
      function cardFaceTexture(key: string) {
        const colInt = MANA[key], colorHex = hexCol(colInt), symCol = lighten(colInt, 0.42)
        const c = document.createElement('canvas'); c.width = 512; c.height = 716
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#0b1322'; roundRect(ctx, 8, 8, 496, 700, 40); ctx.fill()
        ctx.lineWidth = 12; ctx.strokeStyle = '#7fb4e6'; roundRect(ctx, 22, 22, 468, 672, 32); ctx.stroke()
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(159,208,255,0.6)'; roundRect(ctx, 34, 34, 444, 648, 26); ctx.stroke()
        ctx.fillStyle = 'rgba(14,26,46,0.92)'; roundRect(ctx, 46, 48, 420, 64, 18); ctx.fill()
        ctx.strokeStyle = 'rgba(120,170,230,0.5)'; ctx.lineWidth = 2; ctx.stroke()
        const ax = 46, ay = 128, aw = 420, ah = 360
        const g = ctx.createRadialGradient(ax + aw / 2, ay + ah / 2, 20, ax + aw / 2, ay + ah / 2, 300)
        g.addColorStop(0, colorHex); g.addColorStop(0.5, '#101d33'); g.addColorStop(1, '#070d18')
        ctx.fillStyle = g; roundRect(ctx, ax, ay, aw, ah, 16); ctx.fill()
        ctx.strokeStyle = 'rgba(120,170,230,0.5)'; ctx.lineWidth = 3; ctx.stroke()
        ctx.save(); ctx.translate(ax + aw / 2, ay + ah / 2)
        ctx.shadowColor = colorHex; ctx.shadowBlur = 28; ctx.globalAlpha = 0.96
        drawManaSymbol(ctx, key, 112, symCol)
        ctx.restore()
        ctx.fillStyle = 'rgba(14,26,46,0.92)'; roundRect(ctx, 46, 506, 420, 44, 12); ctx.fill()
        ctx.strokeStyle = 'rgba(120,170,230,0.45)'; ctx.lineWidth = 2; ctx.stroke()
        ctx.fillStyle = 'rgba(238,244,255,0.2)'
        for (let j = 0; j < 5; j++) { roundRect(ctx, 60, 576 + j * 22, 392 - (j === 4 ? 120 : 0), 9, 5); ctx.fill() }
        ctx.save(); ctx.translate(440, 80)
        ctx.fillStyle = 'rgba(8,16,30,0.92)'; ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill()
        ctx.lineWidth = 2.5; ctx.strokeStyle = symCol; ctx.stroke()
        drawManaSymbol(ctx, key, 13, symCol)
        ctx.restore()
        return mkTex(c)
      }

      function cardBackTexture() {
        const c = document.createElement('canvas'); c.width = 512; c.height = 716
        const ctx = c.getContext('2d')!
        const bg = ctx.createLinearGradient(0, 0, 512, 716)
        bg.addColorStop(0, '#142e4c'); bg.addColorStop(1, '#070d16')
        ctx.fillStyle = bg; roundRect(ctx, 8, 8, 496, 700, 40); ctx.fill()
        ctx.lineWidth = 10; ctx.strokeStyle = '#7fb4e6'; roundRect(ctx, 24, 24, 464, 668, 30); ctx.stroke()
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(159,208,255,0.45)'; roundRect(ctx, 38, 38, 436, 640, 24); ctx.stroke()
        ctx.save(); ctx.translate(256, 322); drawSigilSeal(ctx, 150, '#9fc4ec', true); ctx.restore()
        ctx.fillStyle = 'rgba(159,208,255,0.9)'; ctx.textAlign = 'center'
        ctx.font = "700 50px Cinzel, Georgia, 'Times New Roman', serif"
        ctx.fillText('SIGIL', 256, 612)
        return mkTex(c)
      }

      function dieFaceTexture(n: number) {
        const c = document.createElement('canvas'); c.width = c.height = 256
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#eef2f8'; roundRect(ctx, 6, 6, 244, 244, 44); ctx.fill()
        ctx.strokeStyle = '#7fb4e6'; ctx.lineWidth = 6; ctx.stroke()
        ctx.fillStyle = '#0e1a2e'
        const A = 70, B = 128, C = 186, r = 20
        function pip(x: number, y: number) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill() }
        const L: Record<number, [number, number][]> = {
          1: [[B, B]], 2: [[A, A], [C, C]], 3: [[A, A], [B, B], [C, C]],
          4: [[A, A], [C, A], [A, C], [C, C]], 5: [[A, A], [C, A], [B, B], [A, C], [C, C]],
          6: [[A, A], [C, A], [A, B], [C, B], [A, C], [C, C]],
        }
        ;(L[n] || []).forEach(([px, py]) => pip(px, py))
        return mkTex(c)
      }

      function dieSigilTexture() {
        const c = document.createElement('canvas'); c.width = c.height = 256
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#eef2f8'; roundRect(ctx, 6, 6, 244, 244, 44); ctx.fill()
        ctx.strokeStyle = '#7fb4e6'; ctx.lineWidth = 6; ctx.stroke()
        ctx.save(); ctx.translate(128, 128); drawSigilSeal(ctx, 88, '#2f6aa8', false); ctx.restore()
        return mkTex(c)
      }

      function glowSprite(colorInt: number, scale: number) {
        const sg = document.createElement('canvas'); sg.width = sg.height = 128
        const sx = sg.getContext('2d')!
        const rgb = [((colorInt >> 16) & 255), ((colorInt >> 8) & 255), colorInt & 255].join(',')
        const rg = sx.createRadialGradient(64, 64, 0, 64, 64, 64)
        rg.addColorStop(0, 'rgba(255,255,255,0.95)')
        rg.addColorStop(0.25, `rgba(${rgb},0.95)`)
        rg.addColorStop(0.6, `rgba(${rgb},0.35)`)
        rg.addColorStop(1, 'rgba(0,0,0,0)')
        sx.fillStyle = rg; sx.fillRect(0, 0, 128, 128)
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(sg),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }))
        sp.scale.setScalar(scale)
        return sp
      }

      // ── Build textures ─────────────────────────────────────────────────────
      const faceTextures = MANA_KEYS.map(k => cardFaceTexture(k))
      const backTexture = cardBackTexture()
      const edgeMat = new THREE.MeshStandardMaterial({ color: 0x4a6c92, metalness: 0.7, roughness: 0.4 })

      // ── Mana pentad (rotating central seal) ───────────────────────────────
      const pentad = new THREE.Group()
      world.add(pentad)
      // Central seal disc
      const sealC = document.createElement('canvas'); sealC.width = sealC.height = 512
      const sealCtx = sealC.getContext('2d')!
      sealCtx.translate(256, 256)
      drawSigilSeal(sealCtx, 220, '#8fd0ff', true)
      const sealTex = mkTex(sealC)
      const sealDisc = new THREE.Mesh(
        new THREE.CircleGeometry(1.2, 64),
        new THREE.MeshStandardMaterial({ map: sealTex, transparent: true, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide }),
      )
      sealDisc.position.set(0, 0, -1.5)
      pentad.add(sealDisc)
      // 5 mana node orbs orbiting the seal
      const pentadOrbs: InstanceType<typeof THREE.Mesh>[] = []
      const orbPositions: InstanceType<typeof THREE.Vector3>[] = []
      MANA_KEYS.forEach((mk, i) => {
        const a = -Math.PI / 2 + i * 2 * Math.PI / 5
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 24, 16),
          new THREE.MeshStandardMaterial({
            color: MANA[mk], metalness: 0.5, roughness: 0.3,
            emissive: MANA[mk], emissiveIntensity: 0.4,
          }),
        )
        orb.position.set(Math.cos(a) * 1.05, Math.sin(a) * 1.05, -1.5)
        orb.userData.pulse = i * 1.3
        pentad.add(orb); pentadOrbs.push(orb); orbPositions.push(orb.position.clone())
        const gs = glowSprite(MANA[mk], 0.55)
        gs.position.copy(orb.position)
        pentad.add(gs)
      })
      // Pentagram line connecting the orbs (star order)
      const starOrder = [0, 2, 4, 1, 3, 0]
      const starGeo = new THREE.BufferGeometry().setFromPoints(starOrder.map((idx) => orbPositions[idx]))
      pentad.add(new THREE.Line(starGeo, new THREE.LineBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.4 })))
      // Two counter-rotating torus rings around the seal
      const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.5 }))
      ringA.position.set(0, 0, -1.5); ringA.userData.ringSpin = 0.004; pentad.add(ringA)
      const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.46, 0.008, 8, 96), new THREE.MeshBasicMaterial({ color: 0xc6a8ff, transparent: true, opacity: 0.35 }))
      ringB.position.set(0, 0, -1.5); ringB.userData.ringSpin = -0.006; pentad.add(ringB)

      // ── Floating foil cards ────────────────────────────────────────────────
      const cardGeo = new THREE.BoxGeometry(1.0, 1.4, 0.03)
      const COUNT = lowPower ? 12 : 22
      const cards: InstanceType<typeof THREE.Mesh>[] = []
      for (let ci = 0; ci < COUNT; ci++) {
        const faceTex = faceTextures[ci % faceTextures.length]
        const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0.35, roughness: 0.4, emissive: 0x0a1626, emissiveIntensity: 0.3 })
        const backMat = new THREE.MeshStandardMaterial({ map: backTexture, metalness: 0.4, roughness: 0.4 })
        const mesh = new THREE.Mesh(cardGeo, [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, backMat])
        const radius = 3.3 + Math.random() * 3.2, ang = Math.random() * Math.PI * 2
        mesh.position.set(Math.cos(ang) * radius * 1.25, Math.sin(ang) * radius * 0.82, -2.6 + Math.random() * 3.8)
        mesh.rotation.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.5)
        const s = 0.66 + Math.random() * 0.5
        mesh.scale.setScalar(s)
        mesh.userData = {
          baseSpin: {
            x: (Math.random() - 0.5) * 0.006,
            y: (0.022 + Math.random() * 0.03) * (Math.random() > 0.5 ? 1 : -1),
            z: (Math.random() - 0.5) * 0.005,
          },
          bob: Math.random() * Math.PI * 2,
          bobAmp: 0.12 + Math.random() * 0.24,
          bobFreq: 0.4 + Math.random() * 0.4,
          home: mesh.position.clone(),
        }
        world.add(mesh); cards.push(mesh)
      }

      // ── Dice ──────────────────────────────────────────────────────────────
      function addD6(x: number, y: number, z: number, scl: number) {
        const mats = [1, 6, 2, 5, 3, 4].map(n =>
          new THREE.MeshStandardMaterial({ map: n === 1 ? dieSigilTexture() : dieFaceTexture(n), metalness: 0.1, roughness: 0.55 }),
        )
        const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats)
        m.position.set(x, y, z); m.scale.setScalar(scl)
        m.userData = {
          baseSpin: { x: (Math.random() - 0.5) * 0.018, y: (Math.random() - 0.5) * 0.018, z: (Math.random() - 0.5) * 0.018 },
          bob: Math.random() * 6, bobAmp: 0.2 + Math.random() * 0.2, bobFreq: 0.3 + Math.random() * 0.3,
        }
        world.add(m)
      }

      // Sigil-mark decal texture for d20 faces (drawn once, shared)
      const d20Logo = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 256
        const lctx = c.getContext('2d')!
        lctx.translate(128, 128)
        drawSigilSeal(lctx, 105, '#dbeaff', false)
        return mkTex(c)
      })()
      function addD20(x: number, y: number, z: number, scl: number) {
        const geo = new THREE.IcosahedronGeometry(0.62, 0)
        const mat = new THREE.MeshStandardMaterial({ color: 0x3a86d6, metalness: 0.45, roughness: 0.22, emissive: 0x12345e, emissiveIntensity: 0.7, flatShading: true })
        const m = new THREE.Mesh(geo, mat)
        m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: 0xdbeaff, transparent: true, opacity: 0.85 })))
        m.add(glowSprite(0x3a86d6, 1.7))
        // Sigil-mark decal aligned to one face
        {
          const pos = geo.getAttribute('position')
          const v0 = new THREE.Vector3().fromBufferAttribute(pos, 0)
          const v1 = new THREE.Vector3().fromBufferAttribute(pos, 1)
          const v2 = new THREE.Vector3().fromBufferAttribute(pos, 2)
          const fc = v0.clone().add(v1).add(v2).divideScalar(3)
          const fn = v1.clone().sub(v0).cross(v2.clone().sub(v0)).normalize()
          const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: d20Logo, transparent: true, opacity: 0.92, depthWrite: false }))
          decal.position.copy(fc).addScaledVector(fn, 0.012)
          decal.lookAt(fc.clone().addScaledVector(fn, 1))
          m.add(decal)
        }
        m.position.set(x, y, z); m.scale.setScalar(scl)
        m.userData = {
          baseSpin: { x: (Math.random() - 0.5) * 0.022, y: (Math.random() - 0.5) * 0.022, z: (Math.random() - 0.5) * 0.022 },
          bob: Math.random() * 6, bobAmp: 0.2 + Math.random() * 0.2, bobFreq: 0.35 + Math.random() * 0.35,
        }
        world.add(m)
      }

      addD6(-2.4, 1.0, 0.4, 0.52)
      addD6(2.8, -0.7, 0.2, 0.44)
      addD6(-1.0, -1.8, -0.3, 0.48)
      addD20(1.6, 1.4, 0.5, 0.7)
      addD20(-3.2, -0.2, -0.6, 0.6)

      // ── Dust sprites ──────────────────────────────────────────────────────
      let dust: InstanceType<typeof THREE.Points> | null = null
      if (!lowPower) {
        const DUST_COUNT = 220
        const dustPositions = new Float32Array(DUST_COUNT * 3)
        for (let i = 0; i < DUST_COUNT; i++) {
          dustPositions[i * 3] = (Math.random() - 0.5) * 14
          dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 8
          dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 10
        }
        const dustGeo = new THREE.BufferGeometry()
        dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
        // soft radial sprite for round, glowing motes
        const dc = document.createElement('canvas'); dc.width = dc.height = 64
        const dctx = dc.getContext('2d')!
        const grad = dctx.createRadialGradient(32, 32, 0, 32, 32, 32)
        grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(180,220,255,0.55)'); grad.addColorStop(1, 'rgba(180,220,255,0)')
        dctx.fillStyle = grad; dctx.fillRect(0, 0, 64, 64)
        const dustMat = new THREE.PointsMaterial({ color: 0x8fd0ff, size: 0.06, map: mkTex(dc), transparent: true, opacity: 0.5, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false })
        dust = new THREE.Points(dustGeo, dustMat)
        scene.add(dust)
      }

      // ── Hero interactivity: hover highlight + tap to flip cards / roll dice ─
      const interactive = world.children.filter((o) => o.userData.baseSpin)
      interactive.forEach((o) => { o.userData.baseScale = o.scale.x; o.userData.isCard = cards.includes(o as never) })
      const raycaster = new THREE.Raycaster()
      let hovered: InstanceType<typeof THREE.Object3D> | null = null
      // Grab-drag a hero card/die along a camera-facing plane; a click (no drag) flips/rolls it.
      const dragPlane = new THREE.Plane()
      let drag: { obj: InstanceType<typeof THREE.Object3D>; moved: boolean } | null = null
      function onHeroDown(e: PointerEvent) {
        raycaster.setFromCamera({ x: (e.clientX / window.innerWidth) * 2 - 1, y: -((e.clientY / window.innerHeight) * 2 - 1) } as InstanceType<typeof THREE.Vector2>, camera)
        const hits = raycaster.intersectObjects(interactive, false)
        if (!hits.length) return
        const obj = hits[0].object
        drag = { obj, moved: false }
        const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir)
        const wp = new THREE.Vector3(); obj.getWorldPosition(wp)
        dragPlane.setFromNormalAndCoplanarPoint(camDir, wp)
        canvas.style.cursor = 'grabbing'
      }
      function onHeroUp() {
        if (drag) {
          if (!drag.moved) {
            const ud = drag.obj.userData
            if (ud.isCard) ud.flipTo = (ud.flipTo ?? drag.obj.rotation.y) + Math.PI
            else ud.spinBoost = 0.45
          }
          drag = null
          canvas.style.cursor = ''
        }
      }
      canvas.addEventListener('pointerdown', onHeroDown)
      window.addEventListener('pointerup', onHeroUp)

      // ── Resize ────────────────────────────────────────────────────────────
      function onResize() {
        if (!canvas.parentElement) return
        const w = canvas.parentElement.clientWidth || window.innerWidth
        const h = canvas.parentElement.clientHeight || window.innerHeight
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      onResize()
      window.addEventListener('resize', onResize)

      // ── Pointer parallax + scroll-driven camera ──────────────────────────
      const ptr = { x: 0, y: 0, tx: 0, ty: 0 }
      function onPointerMove(e: PointerEvent) {
        ptr.tx = (e.clientX / window.innerWidth) * 2 - 1
        ptr.ty = (e.clientY / window.innerHeight) * 2 - 1
        if (drag) {
          raycaster.setFromCamera({ x: ptr.tx, y: -ptr.ty } as InstanceType<typeof THREE.Vector2>, camera)
          const hit = new THREE.Vector3()
          if (raycaster.ray.intersectPlane(dragPlane, hit)) {
            world.worldToLocal(hit)
            drag.obj.position.copy(hit)
            if (drag.obj.userData.home) drag.obj.userData.home.y = hit.y
            drag.moved = true
          }
        }
      }
      window.addEventListener('pointermove', onPointerMove)
      let scrollProg = 0
      function onScroll() {
        const h = canvas.parentElement?.clientHeight || window.innerHeight
        scrollProg = Math.max(0, Math.min(1.5, window.scrollY / (h || 1)))
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      onScroll()

      // ── Render loop ───────────────────────────────────────────────────────
      let t = 0
      function animate() {
        if (destroyed) return
        rafId = requestAnimationFrame(animate)
        t += 0.016

        // Pentad rotation
        pentad.rotation.z += 0.003
        pentad.rotation.x = Math.sin(t * 0.18) * 0.08
        // Counter-rotating rings + pulsing orbs
        pentad.children.forEach((ch) => { if (ch.userData.ringSpin) ch.rotation.z += ch.userData.ringSpin })
        pentadOrbs.forEach((orb) => {
          const pp = Math.sin(t * 2 + orb.userData.pulse)
          orb.scale.setScalar(1 + pp * 0.16)
          ;(orb.material as InstanceType<typeof THREE.MeshStandardMaterial>).emissiveIntensity = 0.4 + pp * 0.28
        })

        // Shimmer oscillation
        shimmer.position.set(Math.sin(t * 0.7) * 5, Math.cos(t * 0.5) * 4, 3)
        if (dust) { dust.rotation.y += 0.0006; dust.rotation.z += 0.0003 }

        // Cards/dice: idle spin + bob + hover scale + tap flip/roll
        world.children.forEach((obj) => {
          const ud = obj.userData
          if (!ud.baseSpin) return
          obj.rotation.x += ud.baseSpin.x
          obj.rotation.y += ud.baseSpin.y
          obj.rotation.z += ud.baseSpin.z
          if (ud.spinBoost) { obj.rotation.y += ud.spinBoost; ud.spinBoost *= 0.9; if (ud.spinBoost < 0.004) ud.spinBoost = 0 }
          if (ud.flipTo != null) { obj.rotation.y += (ud.flipTo - obj.rotation.y) * 0.16 }
          const target = (obj === hovered ? 1.16 : 1) * (ud.baseScale ?? 1)
          obj.scale.setScalar(obj.scale.x + (target - obj.scale.x) * 0.15)
          if (ud.home) {
            obj.position.y = ud.home.y + Math.sin(t * ud.bobFreq + ud.bob) * ud.bobAmp
          } else {
            obj.position.y += Math.sin(t * ud.bobFreq + ud.bob) * ud.bobAmp * 0.02
          }
        })
        // Hover raycast
        raycaster.setFromCamera({ x: ptr.tx, y: -ptr.ty } as InstanceType<typeof THREE.Vector2>, camera)
        const hits = raycaster.intersectObjects(interactive, false)
        const nh = hits.length ? hits[0].object : null
        if (nh !== hovered) { hovered = nh; canvas.style.cursor = nh ? 'pointer' : '' }

        // Pointer parallax: ease the whole scene + camera toward the cursor.
        ptr.x += (ptr.tx - ptr.x) * 0.05
        ptr.y += (ptr.ty - ptr.y) * 0.05
        world.rotation.y = ptr.x * 0.3
        world.rotation.x = -ptr.y * 0.18
        camera.position.x += (ptr.x * 0.5 - camera.position.x) * 0.04
        camera.position.y += (-ptr.y * 0.32 - camera.position.y) * 0.04
        // Scroll dollies the camera back as you read down the page.
        camera.position.z += ((6.6 + scrollProg * 4) - camera.position.z) * 0.05
        camera.lookAt(0, 0, 0)

        renderer.render(scene, camera)
      }
      animate()

      // ── Robustness: pause when tab hidden; survive WebGL context loss ─────
      function onVisibility() {
        cancelAnimationFrame(rafId)
        if (!document.hidden && !destroyed) { rafId = requestAnimationFrame(animate) }
      }
      document.addEventListener('visibilitychange', onVisibility)
      function onContextLost(e: Event) { e.preventDefault(); cancelAnimationFrame(rafId) }
      function onContextRestored() { if (!destroyed) rafId = requestAnimationFrame(animate) }
      canvas.addEventListener('webglcontextlost', onContextLost as EventListener)
      canvas.addEventListener('webglcontextrestored', onContextRestored)

      // ── Cleanup ───────────────────────────────────────────────────────────
      ;(canvasRef as React.MutableRefObject<HTMLCanvasElement & { _threeCleanup?: () => void }>).current!._threeCleanup = () => {
        destroyed = true
        cancelAnimationFrame(rafId)
        window.removeEventListener('resize', onResize)
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('scroll', onScroll)
        canvas.removeEventListener('pointerdown', onHeroDown)
        window.removeEventListener('pointerup', onHeroUp)
        document.removeEventListener('visibilitychange', onVisibility)
        canvas.removeEventListener('webglcontextlost', onContextLost as EventListener)
        canvas.removeEventListener('webglcontextrestored', onContextRestored)
        renderer.dispose()
      }
    }).catch(err => {
      console.warn('[SigilHero] three.js not installed — hero canvas disabled. Run: cd web && npm i three @types/three', err)
    })

    return () => {
      destroyed = true
      cancelAnimationFrame(rafId)
      const el = canvasRef.current as (HTMLCanvasElement & { _threeCleanup?: () => void }) | null
      el?._threeCleanup?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Hero canvas + overlay ─────────────────────────────────────────────────────
const FORMATS = ['Commander', 'Draft', 'Planechase', '20 Life']

const FEATURES = [
  {
    key: 'life',
    glyph: '✦',
    dot: 'var(--mana-r)',
    title: 'Life & counters',
    body: 'Tap-and-hold life totals, commander damage, poison, energy, and smart counters pulled from your decklist.',
    cta: 'Open life counter',
    to: '/life',
  },
  {
    key: 'deck',
    glyph: '❖',
    dot: 'var(--mana-u)',
    title: 'Deck builder',
    body: 'Search every card on Scryfall, build and save decks, see your mana curve, and send a deck straight to the table.',
    cta: 'Build a deck',
    to: '/build',
  },
  {
    key: 'play',
    glyph: '⬡',
    dot: 'var(--mana-g)',
    title: 'Virtual tabletop',
    body: 'A full battlefield — draw, tap, drag, scry, mulligan, tokens, stack, and pods of up to four, solo or online.',
    cta: 'Enter the table',
    to: '/play',
  },
]

function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null!)
  useThreeScene(canvasRef)

  return (
    <section
      className="relative overflow-hidden"
      style={{
        minHeight: '100svh',
        // Midnight Azure background — matches home.css .home-sky
        background: [
          'radial-gradient(120% 90% at 50% 0%, rgba(77,163,255,0.14), transparent 55%)',
          'radial-gradient(100% 80% at 80% 100%, rgba(120,110,200,0.12), transparent 55%)',
          'linear-gradient(180deg, #070d1a 0%, #091327 55%, #060b16 100%)',
        ].join(', '),
      }}
    >
      {/* Three.js canvas — pinned behind content */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'none',
          pointerEvents: 'none',
        }}
      />

      {/* Veil — matches home.css .home-veil */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: [
            'radial-gradient(120% 100% at 50% 40%, transparent 52%, rgba(4,8,16,0.6) 100%)',
            'linear-gradient(180deg, rgba(6,11,22,0.32) 0%, transparent 20%, transparent 64%, rgba(6,11,22,0.78) 100%)',
          ].join(', '),
        }}
      />

      {/* Overlay content */}
      <div
        className="relative flex flex-col items-center justify-center text-center gap-5 px-5"
        style={{
          minHeight: '100svh',
          paddingTop: 'clamp(64px,12vh,140px)',
          paddingBottom: 'clamp(64px,12vh,140px)',
          maxWidth: 780,
          margin: '0 auto',
          // Subtle radial backdrop so text is readable over the 3D scene
        }}
      >
        {/* Dark halo behind text — matches home.css .home-hero::before */}
        <div
          style={{
            position: 'absolute',
            left: '50%', top: '48%',
            transform: 'translate(-50%,-50%)',
            width: '150%', height: '160%',
            background: 'radial-gradient(58% 52% at 50% 50%, rgba(6,11,22,0.8), rgba(6,11,22,0.4) 55%, transparent 78%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Eyebrow */}
        <motion.p
          {...fadeUp(0.1)}
          className="relative font-bold uppercase tracking-[0.28em] text-xs"
          style={{ color: 'var(--brand)' }}
        >
          Multiplayer tabletop · Magic: The Gathering
        </motion.p>

        {/* Foil "Sigil" title — matches .home-title.foil-text from home.css/theme.css */}
        <motion.h1
          {...fadeUp(0.18)}
          className="relative font-display font-extrabold foil-text"
          style={{
            fontSize: 'clamp(4rem, 2rem + 12vw, 11rem)',
            lineHeight: 0.92,
            letterSpacing: '0.04em',
            textShadow: '0 8px 40px rgba(77,163,255,0.3)',
          }}
        >
          Sigil
        </motion.h1>

        {/* Tagline */}
        <motion.p
          {...fadeUp(0.32)}
          className="relative font-serif leading-relaxed"
          style={{
            fontSize: 'clamp(1.05rem, 0.9rem + 0.7vw, 1.5rem)',
            color: 'var(--paper-dim)',
            maxWidth: '46ch',
            textShadow: '0 2px 14px rgba(4,8,16,0.85)',
          }}
        >
          Your arcane table for every game — life totals, decks, and a full virtual
          battlefield, right in the browser.
        </motion.p>

        {/* CTA buttons — Paper tracking / Enter the table / Build a deck */}
        <motion.div {...fadeUp(0.46)} className="relative flex flex-wrap gap-3.5 justify-center mt-2">
          <Link
            to="/life"
            className="inline-flex items-center gap-2 font-bold text-sm tracking-wide transition-all duration-[220ms] hover:-translate-y-[2px]"
            style={{
              padding: '14px 30px',
              borderRadius: 'var(--r-pill)',
              border: '1px solid var(--hairline)',
              background: 'var(--glass)',
              color: 'var(--paper)',
              backdropFilter: 'blur(10px)',
            }}
          >
            Paper tracking
          </Link>
          <Link
            to="/play"
            className="inline-flex items-center gap-2 font-bold text-sm tracking-wide transition-all duration-[220ms] hover:-translate-y-[2px]"
            style={{
              padding: '14px 30px',
              borderRadius: 'var(--r-pill)',
              background: 'linear-gradient(135deg, var(--brand-bright), var(--brand) 55%, var(--brand-deep))',
              color: '#04101f',
              boxShadow: 'var(--glow), 0 14px 30px rgba(0,0,0,0.4)',
            }}
          >
            Enter the table
          </Link>
          <Link
            to="/build"
            className="inline-flex items-center gap-2 font-bold text-sm tracking-wide transition-all duration-[220ms] hover:-translate-y-[2px]"
            style={{
              padding: '14px 30px',
              borderRadius: 'var(--r-pill)',
              border: '1px solid var(--hairline)',
              background: 'var(--glass)',
              color: 'var(--paper)',
              backdropFilter: 'blur(10px)',
            }}
          >
            Build a deck
          </Link>
        </motion.div>

        {/* Format chips */}
        <motion.div {...fadeUp(0.6)} className="relative flex flex-wrap gap-2.5 justify-center mt-3">
          {FORMATS.map(f => (
            <Link
              key={f}
              to="/play"
              className="font-semibold text-xs tracking-wide transition-all duration-[220ms] hover:text-[color:var(--brand-bright)] hover:border-[var(--brand)]"
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--r-pill)',
                background: 'rgba(8,14,26,0.55)',
                border: '1px solid var(--hairline)',
                color: 'var(--paper-dim)',
                backdropFilter: 'blur(6px)',
                letterSpacing: '0.06em',
                textDecoration: 'none',
              }}
            >
              {f}
            </Link>
          ))}
        </motion.div>

        {/* Scroll hint */}
        <motion.p
          {...fadeUp(0.72)}
          className="relative text-[10px] tracking-[0.22em] uppercase"
          style={{ color: 'var(--faint)', marginTop: 24 }}
        >
          scroll to explore ↓
        </motion.p>
      </div>
    </section>
  )
}

// ── Feature section ───────────────────────────────────────────────────────────
function FeatureSection() {
  return (
    <section
      className="px-5 py-24 text-center"
      style={{ background: 'transparent', position: 'relative', zIndex: 2 }}
    >
      <div className="max-w-5xl mx-auto">
        <motion.div {...fadeUp(0)} className="mb-10">
          <p className="font-bold text-xs uppercase tracking-[0.22em] mb-2" style={{ color: 'var(--brand)' }}>
            Everything at the table
          </p>
          <h2
            className="font-display font-bold"
            style={{ fontSize: 'clamp(1.6rem, 1rem + 2vw, 2.4rem)', color: 'var(--paper)' }}
          >
            One tab for the whole game
          </h2>
        </motion.div>

        <motion.div
          variants={staggerContainer} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="grid gap-5"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
        >
          {FEATURES.map(f => (
            <motion.div
              key={f.key}
              variants={staggerItem}
              className="text-left flex flex-col gap-3 p-7 rounded-xl transition-all duration-[220ms] hover:-translate-y-1"
              style={{
                border: '1px solid var(--hairline)',
                background: 'linear-gradient(180deg, rgba(16,26,46,0.78), rgba(10,18,32,0.72))',
                backdropFilter: 'blur(14px)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <span
                className="inline-grid place-items-center w-12 h-12 rounded-xl text-2xl"
                style={{
                  background: 'rgba(8,14,26,0.6)',
                  border: '1px solid var(--hairline)',
                  color: (f.dot as string),
                  boxShadow: `0 0 18px -6px ${f.dot}`,
                  // @ts-expect-error CSS custom property
                  '--dot': f.dot,
                }}
              >
                {f.glyph}
              </span>
              <h3 className="font-display font-bold text-xl" style={{ color: 'var(--paper)' }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                {f.body}
              </p>
              <Link
                to={f.to}
                className="self-start inline-flex items-center gap-1 font-bold text-sm mt-1 transition-colors hover:text-white"
                style={{ color: 'var(--brand-bright)', textDecoration: 'none' }}
              >
                {f.cta} <ArrowRight size={13} />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ── Why Sigil bullets ─────────────────────────────────────────────────────────
function WhySection() {
  const bullets = [
    'Server-authoritative rules engine — hidden zones enforced, not trusted.',
    'Full turn structure: untap → upkeep → draw → main → combat → end.',
    'SBA enforcement: 0-toughness deaths, lethal damage, 21 commander damage, 10 poison.',
    'Reconnect mid-game — session persists on the server.',
    'No installation. No login required to play solo.',
    'ELO ratings, match history, and a bracket-aware lobby.',
  ]

  return (
    <section
      className="px-5 py-20"
      style={{ borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)', background: 'var(--glass)' }}
    >
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Seal visual */}
        <motion.div {...fadeUp(0)} className="flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 32, ease: 'linear', repeat: Infinity }}
            style={{ filter: 'drop-shadow(0 0 32px rgba(77,163,255,0.35))' }}
          >
            <SigilSeal size={160} />
          </motion.div>
        </motion.div>

        {/* Text */}
        <motion.div {...fadeUp(0.1)} className="flex flex-col gap-5">
          <p className="font-bold text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--brand)' }}>
            Nothing to install
          </p>
          <h2
            className="font-display font-bold leading-tight"
            style={{ fontSize: 'clamp(1.6rem, 1rem + 2vw, 2.2rem)', color: 'var(--paper)' }}
          >
            Gather your playgroup
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--paper-dim)' }}>
            Solo goldfish, hotseat pods, or online with friends. Sigil runs entirely in your browser.
          </p>
          <ul className="flex flex-col gap-2.5 mt-1">
            {bullets.map(b => (
              <li key={b} className="flex items-start gap-2.5">
                <CheckCircle2 size={13} className="flex-shrink-0 mt-[2px]" style={{ color: 'var(--mana-g)' }} />
                <span className="text-xs leading-relaxed" style={{ color: 'var(--paper-dim)' }}>{b}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section
      className="px-5 py-28 text-center relative overflow-hidden"
      style={{ borderTop: '1px solid var(--hairline)' }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(77,163,255,0.08), transparent 70%)' }}
      />
      <motion.div {...fadeUp(0)} className="relative flex flex-col items-center gap-6 max-w-lg mx-auto">
        <motion.div
          whileHover={{ rotate: 72 }}
          transition={{ duration: 0.46, ease: [0.34, 1.4, 0.5, 1] }}
          style={{ filter: 'drop-shadow(0 4px 16px rgba(77,163,255,0.5))' }}
        >
          <SigilSeal size={52} />
        </motion.div>
        <h2 className="font-display font-bold text-3xl" style={{ color: 'var(--paper)' }}>
          Ready to play?
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--paper-dim)' }}>
          No download. No install. Just open a tab and shuffle up.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            to="/lobby"
            className="inline-flex items-center gap-2 px-8 py-4 font-bold text-sm rounded-full transition-all duration-[220ms] hover:-translate-y-[2px]"
            style={{
              background: 'linear-gradient(135deg, var(--brand-bright), var(--brand) 55%, var(--brand-deep))',
              color: '#04101f',
              boxShadow: 'var(--glow), 0 14px 30px rgba(0,0,0,0.4)',
            }}
          >
            <Users size={16} /> Find a Table
          </Link>
          <Link
            to="/play"
            className="inline-flex items-center gap-2 px-8 py-4 font-bold text-sm rounded-full transition-all duration-[220ms] hover:-translate-y-[2px]"
            style={{ border: '1px solid var(--brand)', color: 'var(--brand-bright)' }}
          >
            Play Solo
          </Link>
        </div>
      </motion.div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="relative flex flex-col" style={{ minHeight: 'calc(100dvh - 62px)' }}>
      <HeroSection />
      <FeatureSection />
      <WhySection />
      <FinalCTA />
    </div>
  )
}
