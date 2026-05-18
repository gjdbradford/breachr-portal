import { describe, it, expect } from 'vitest'
import { getProviderForRegion } from '@/lib/payment/factory'

describe('getProviderForRegion', () => {
  it('returns stripe provider for eu', () => {
    expect(getProviderForRegion('eu').name).toBe('stripe')
  })

  it('returns payfast provider for za', () => {
    expect(getProviderForRegion('za').name).toBe('payfast')
  })

  it('falls back to stripe for unknown region', () => {
    expect(getProviderForRegion('us').name).toBe('stripe')
  })

  it('falls back to stripe for null', () => {
    expect(getProviderForRegion(null).name).toBe('stripe')
  })

  it('falls back to stripe for undefined', () => {
    expect(getProviderForRegion(undefined).name).toBe('stripe')
  })
})
