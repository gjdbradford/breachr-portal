import { describe, it, expect } from 'vitest'

function computeTabs(role: string, showTeam: boolean): string[] {
  if (role === 'developer') return ['profile']
  if (role === 'account_owner') return ['profile', 'compliance', 'team', 'permissions', 'subscription']
  return (['profile', 'compliance', showTeam ? 'team' : null, 'subscription'] as Array<string | null>).filter((t): t is string => t !== null)
}

describe('SettingsTabs tab computation', () => {
  it('developer sees only profile tab', () => {
    expect(computeTabs('developer', true)).toEqual(['profile'])
  })
  it('account_owner sees all tabs', () => {
    expect(computeTabs('account_owner', true)).toEqual(['profile', 'compliance', 'team', 'permissions', 'subscription'])
  })
  it('admin with showTeam=true sees 4 tabs', () => {
    expect(computeTabs('admin', true)).toEqual(['profile', 'compliance', 'team', 'subscription'])
  })
  it('admin with showTeam=false skips team', () => {
    expect(computeTabs('admin', false)).toEqual(['profile', 'compliance', 'subscription'])
  })
})
