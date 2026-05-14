import { describe, it, expect } from 'vitest'
import { FRAMEWORKS, computeFrameworkScore, FRAMEWORK_COLOR } from '@/lib/frameworks'

const baseInputs = {
  hasScans: false,
  completedScans: 0,
  criticals: 0,
  highs: 0,
  open: 0,
  total: 0,
  remediated: 0,
  tlpt: 0,
  surfaceCount: 0,
  auditEvents: 0,
  auditSignedRatio: 0,
  remediatedRatio: 0,
}

describe('FRAMEWORKS', () => {
  it('includes DORA, PCI-DSS, NIS2', () => {
    const ids = FRAMEWORKS.map(f => f.id)
    expect(ids).toContain('DORA')
    expect(ids).toContain('PCI-DSS')
    expect(ids).toContain('NIS2')
  })
  it('each framework has at least 3 articles', () => {
    FRAMEWORKS.forEach(f => expect(f.articles.length).toBeGreaterThanOrEqual(3))
  })
})

describe('computeFrameworkScore', () => {
  it('returns 0 for DORA with no scans', () => {
    const dora = FRAMEWORKS.find(f => f.id === 'DORA')!
    const score = computeFrameworkScore(dora, baseInputs)
    expect(score.overall).toBe(0)
  })
  it('returns 0 for all articles when no scans', () => {
    const dora = FRAMEWORKS.find(f => f.id === 'DORA')!
    const score = computeFrameworkScore(dora, baseInputs)
    score.articles.forEach(a => expect(a.score).toBe(0))
  })
  it('returns >0 overall for DORA with completed scans and no criticals', () => {
    const dora = FRAMEWORKS.find(f => f.id === 'DORA')!
    const score = computeFrameworkScore(dora, {
      ...baseInputs,
      hasScans: true,
      completedScans: 4,
      surfaceCount: 2,
      remediatedRatio: 0.8,
    })
    expect(score.overall).toBeGreaterThan(0)
  })
  it('penalises DORA score heavily for open criticals', () => {
    const dora = FRAMEWORKS.find(f => f.id === 'DORA')!
    const clean = computeFrameworkScore(dora, { ...baseInputs, hasScans: true, completedScans: 2, surfaceCount: 1, remediatedRatio: 1 })
    const dirty = computeFrameworkScore(dora, { ...baseInputs, hasScans: true, completedScans: 2, surfaceCount: 1, remediatedRatio: 1, criticals: 3 })
    expect(clean.overall).toBeGreaterThan(dirty.overall)
  })
  it('overall score is always 0–100', () => {
    const extremeInputs = { ...baseInputs, hasScans: true, completedScans: 100, criticals: 0, remediatedRatio: 1, surfaceCount: 10, auditSignedRatio: 1, auditEvents: 500 }
    FRAMEWORKS.forEach(f => {
      const score = computeFrameworkScore(f, extremeInputs)
      expect(score.overall).toBeGreaterThanOrEqual(0)
      expect(score.overall).toBeLessThanOrEqual(100)
    })
  })
})

describe('FRAMEWORK_COLOR', () => {
  it('has a colour for every framework id', () => {
    FRAMEWORKS.forEach(f => {
      expect(FRAMEWORK_COLOR[f.id]).toBeDefined()
    })
  })
})
