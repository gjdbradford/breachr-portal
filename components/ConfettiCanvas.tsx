'use client'

import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react'

type ConfettiContextValue = {
  triggerBurst: (x: number, y: number) => void
  triggerCelebration: () => void
}

const ConfettiContext = createContext<ConfettiContextValue | null>(null)

export function useConfetti() {
  const ctx = useContext(ConfettiContext)
  if (!ctx) throw new Error('useConfetti must be used within ConfettiCanvas')
  return ctx
}

type Particle = {
  x: number; y: number; vx: number; vy: number
  r: number; color: string; alpha: number
  rot: number; rspeed: number; gravity: number
  shape: 'rect' | 'circle'; w: number; h: number
}

const COLORS = ['#42a5f5', '#1976d2', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#fff']

function rand(a: number, b: number) { return a + Math.random() * (b - a) }

function makeParticle(x: number, y: number, vxRange: number, vyMin: number, vyMax: number): Particle {
  return {
    x, y,
    vx: rand(-vxRange, vxRange),
    vy: rand(vyMin, vyMax),
    r: rand(3, 7),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: 1,
    rot: rand(0, Math.PI * 2),
    rspeed: rand(-0.15, 0.15),
    gravity: rand(0.12, 0.28),
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
    w: rand(4, 10), h: rand(3, 6),
  }
}

export default function ConfettiCanvas({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const particlesRef = useRef<Particle[]>([])

  function startLoop() {
    if (rafRef.current !== null) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    function draw() {
      const { width, height } = canvas!
      ctx.clearRect(0, 0, width, height)
      particlesRef.current = particlesRef.current.filter(p => p.alpha > 0.02)

      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy; p.vy += p.gravity
        p.vx *= 0.98; p.rot += p.rspeed; p.alpha -= 0.014
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.alpha)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.shape === 'rect') ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill() }
        ctx.restore()
      }

      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(draw)
      } else {
        rafRef.current = null
        ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      }
    }
    rafRef.current = requestAnimationFrame(draw)
  }

  const triggerBurst = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const burst = Array.from({ length: 40 }, () => makeParticle(x, y, 6, -9, -2))
    particlesRef.current.push(...burst)
    startLoop()
  }, [])

  const triggerCelebration = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const rain = Array.from({ length: 120 }, () =>
      makeParticle(rand(0, window.innerWidth), rand(-60, -10), 1.5, 1.5, 4)
    )
    rain.forEach(p => { p.vy = Math.abs(p.vy); p.gravity = 0.06 })
    particlesRef.current.push(...rain)
    startLoop()
  }, [])

  return (
    <ConfettiContext.Provider value={{ triggerBurst, triggerCelebration }}>
      {children}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          zIndex: 9999, width: '100%', height: '100%',
        }}
      />
    </ConfettiContext.Provider>
  )
}
