import { describe, it, expect } from 'vitest'

function filterLinks(
  links: Array<{ href: string }>,
  opts: {
    showAudit: boolean
    showScans: boolean
    showFindings: boolean
    showInventory: boolean
    showRemediation: boolean
    developerMode: boolean
  }
): Array<{ href: string }> {
  if (opts.developerMode) {
    return links.filter(l =>
      l.href === '/dashboard/remediation' || l.href === '/dashboard/settings'
    )
  }
  return links.filter(({ href }) => {
    if (href === '/dashboard/audit')        return opts.showAudit
    if (href === '/dashboard/scans')        return opts.showScans
    if (href === '/dashboard/findings')     return opts.showFindings
    if (href === '/dashboard/inventory')    return opts.showInventory
    if (href === '/dashboard/remediation')  return opts.showRemediation
    return true
  })
}

const ALL_LINKS = [
  { href: '/dashboard' },
  { href: '/dashboard/targets' },
  { href: '/dashboard/scans' },
  { href: '/dashboard/findings' },
  { href: '/dashboard/reports' },
  { href: '/dashboard/inventory' },
  { href: '/dashboard/sensors' },
  { href: '/dashboard/audit' },
  { href: '/dashboard/remediation' },
  { href: '/dashboard/settings' },
]

describe('DashboardNav filter logic', () => {
  it('developer mode shows only remediation and settings', () => {
    const visible = filterLinks(ALL_LINKS, {
      showAudit: true, showScans: true, showFindings: true,
      showInventory: true, showRemediation: true, developerMode: true,
    })
    expect(visible.map(l => l.href)).toEqual(['/dashboard/remediation', '/dashboard/settings'])
  })

  it('non-developer hides audit when showAudit=false', () => {
    const visible = filterLinks(ALL_LINKS, {
      showAudit: false, showScans: true, showFindings: true,
      showInventory: true, showRemediation: true, developerMode: false,
    })
    expect(visible.some(l => l.href === '/dashboard/audit')).toBe(false)
  })

  it('non-developer shows remediation when showRemediation=true', () => {
    const visible = filterLinks(ALL_LINKS, {
      showAudit: true, showScans: true, showFindings: true,
      showInventory: true, showRemediation: true, developerMode: false,
    })
    expect(visible.some(l => l.href === '/dashboard/remediation')).toBe(true)
  })
})
