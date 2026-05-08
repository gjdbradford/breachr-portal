'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function calcScrollDirection(
  prevY: number,
  currY: number,
  currentDir: 'up' | 'down',
  threshold = 5,
): 'up' | 'down' {
  if (Math.abs(currY - prevY) < threshold) return currentDir
  return currY > prevY ? 'down' : 'up'
}

export function useScrollDirection(): 'up' | 'down' {
  const [direction, setDirection] = useState<'up' | 'down'>('up')
  const prevY = useRef(0)
  const rafId = useRef<number | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    setDirection('up')
    prevY.current = typeof window !== 'undefined' ? window.scrollY : 0
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return

    function onScroll() {
      if (rafId.current !== null) return
      rafId.current = requestAnimationFrame(() => {
        const currY = window.scrollY
        if (currY < 10) {
          setDirection('up')
        } else {
          setDirection(prev => calcScrollDirection(prevY.current, currY, prev))
        }
        prevY.current = currY
        rafId.current = null
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId.current !== null) cancelAnimationFrame(rafId.current)
    }
  }, [])

  return direction
}
