import { describe, it, expect } from 'vitest'
import { calcScrollDirection } from '@/hooks/useScrollDirection'

describe('calcScrollDirection', () => {
  it('returns current direction when delta is below threshold', () => {
    expect(calcScrollDirection(100, 103, 'up')).toBe('up')
    expect(calcScrollDirection(100, 97, 'down')).toBe('down')
  })

  it('returns down when scrolling down past threshold', () => {
    expect(calcScrollDirection(100, 110, 'up')).toBe('down')
  })

  it('returns up when scrolling up past threshold', () => {
    expect(calcScrollDirection(110, 100, 'down')).toBe('up')
  })

  it('uses custom threshold', () => {
    expect(calcScrollDirection(100, 108, 'up', 10)).toBe('up')
    expect(calcScrollDirection(100, 111, 'up', 10)).toBe('down')
  })
})
