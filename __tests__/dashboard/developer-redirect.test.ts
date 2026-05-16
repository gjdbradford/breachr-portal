import { describe, it, expect } from 'vitest'

function getDashboardRedirect(role: string, onboardingComplete: boolean): string | null {
  if (!onboardingComplete) return '/onboarding'
  if (role === 'developer') return '/dashboard/remediation'
  return null
}

describe('dashboard root redirect logic', () => {
  it('redirects developer to remediation', () => {
    expect(getDashboardRedirect('developer', true)).toBe('/dashboard/remediation')
  })
  it('does not redirect admin', () => {
    expect(getDashboardRedirect('admin', true)).toBeNull()
  })
  it('redirects to onboarding if not complete (takes priority)', () => {
    expect(getDashboardRedirect('developer', false)).toBe('/onboarding')
  })
})
