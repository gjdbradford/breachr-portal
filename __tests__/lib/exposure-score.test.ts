import { describe, it, expect } from 'vitest'
import { computeExposureScore, type ExposureDimension } from '@/lib/exposure-score'

describe('computeExposureScore', () => {
  it('returns 0 when all dimension scores are 0', () => {
    const dims: ExposureDimension[] = [
      { label: 'A', weight: 0.5, score: 0 },
      { label: 'B', weight: 0.5, score: 0 },
    ]
    expect(computeExposureScore(dims)).toBe(0)
  })

  it('returns 100 when all dimension scores are 100', () => {
    const dims: ExposureDimension[] = [
      { label: 'A', weight: 0.35, score: 100 },
      { label: 'B', weight: 0.30, score: 100 },
      { label: 'C', weight: 0.20, score: 100 },
      { label: 'D', weight: 0.15, score: 100 },
    ]
    expect(computeExposureScore(dims)).toBe(100)
  })

  it('computes correct weighted average', () => {
    const dims: ExposureDimension[] = [
      { label: 'A', weight: 0.5, score: 80 },
      { label: 'B', weight: 0.5, score: 60 },
    ]
    expect(computeExposureScore(dims)).toBe(70)
  })

  it('normalises unequal weights that do not sum to 1', () => {
    const dims: ExposureDimension[] = [
      { label: 'A', weight: 1, score: 100 },
      { label: 'B', weight: 1, score: 0 },
    ]
    expect(computeExposureScore(dims)).toBe(50)
  })

  it('result is always clamped to 0–100', () => {
    const dims: ExposureDimension[] = [
      { label: 'A', weight: 0.5, score: 200 },
      { label: 'B', weight: 0.5, score: -50 },
    ]
    const result = computeExposureScore(dims)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(100)
  })

  it('returns 0 for empty array', () => {
    expect(computeExposureScore([])).toBe(0)
  })
})
