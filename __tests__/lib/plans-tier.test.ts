import { describe, it, expect } from 'vitest'
import { PLAN_TIER, TIER_CONFIG } from '@/lib/plans'

describe('PLAN_TIER', () => {
  it('maps free to bronze', () => {
    expect(PLAN_TIER['free']).toBe('bronze')
  })
  it('maps starter to silver', () => {
    expect(PLAN_TIER['starter']).toBe('silver')
  })
  it('maps professional to gold', () => {
    expect(PLAN_TIER['professional']).toBe('gold')
  })
  it('maps enterprise to platinum', () => {
    expect(PLAN_TIER['enterprise']).toBe('platinum')
  })
})

describe('TIER_CONFIG', () => {
  it('bronze has maxNodes 1 and byoModel false', () => {
    expect(TIER_CONFIG['bronze'].maxNodes).toBe(1)
    expect(TIER_CONFIG['bronze'].byoModel).toBe(false)
  })
  it('platinum has byoModel true and onPrem true', () => {
    expect(TIER_CONFIG['platinum'].byoModel).toBe(true)
    expect(TIER_CONFIG['platinum'].onPrem).toBe(true)
  })
  it('gold has maxNodes 3', () => {
    expect(TIER_CONFIG['gold'].maxNodes).toBe(3)
  })
  it('every tier has a badge string', () => {
    const tiers = ['bronze', 'silver', 'gold', 'platinum'] as const
    tiers.forEach(t => expect(typeof TIER_CONFIG[t].badge).toBe('string'))
  })
})
