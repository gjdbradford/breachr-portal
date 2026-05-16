import { describe, it, expect } from 'vitest'

function redirectForRole(role: string): string {
  return role === 'developer' ? '/dashboard/remediation' : '/dashboard'
}

describe('invite accept redirect logic', () => {
  it('redirects developer to remediation', () => {
    expect(redirectForRole('developer')).toBe('/dashboard/remediation')
  })
  it('redirects admin to dashboard', () => {
    expect(redirectForRole('admin')).toBe('/dashboard')
  })
  it('redirects member to dashboard', () => {
    expect(redirectForRole('member')).toBe('/dashboard')
  })
  it('redirects account_owner to dashboard', () => {
    expect(redirectForRole('account_owner')).toBe('/dashboard')
  })
})
