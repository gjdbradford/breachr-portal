// OWASP Top 10 2021 → compliance framework control mapping.
// Mirrors scanner/engine/frameworks.py — keep in sync.

export type Framework = 'DORA' | 'NIS2' | 'PCI-DSS'

const FRAMEWORK_CONTROLS: Record<Framework, Record<string, string[]>> = {
  DORA: {
    A01: ['Art.9'], A02: ['Art.9'], A03: ['Art.9'], A04: ['Art.9'], A05: ['Art.9'],
    A06: ['Art.28'], A07: ['Art.9'], A08: ['Art.9'], A09: ['Art.13'], A10: ['Art.9'],
    _default: ['Art.9'],
  },
  NIS2: {
    A01: ['Art.21(i)', 'Art.21(j)'], A02: ['Art.21(h)'], A03: ['Art.21(e)'],
    A04: ['Art.21(e)'], A05: ['Art.21(a)'], A06: ['Art.21(d)'],
    A07: ['Art.21(i)', 'Art.21(j)'], A08: ['Art.21(d)'], A09: ['Art.21(b)'],
    A10: ['Art.21(e)'], _default: ['Art.21(a)'],
  },
  'PCI-DSS': {
    A01: ['Req 7', 'Req 8'], A02: ['Req 3', 'Req 4'], A03: ['Req 6'],
    A04: ['Req 6'], A05: ['Req 2'], A06: ['Req 6'], A07: ['Req 8'],
    A08: ['Req 6'], A09: ['Req 10'], A10: ['Req 6'], _default: ['Req 6'],
  },
}

export function getControls(owaspCategory: string | null | undefined, framework: Framework): string[] {
  const mapping = FRAMEWORK_CONTROLS[framework] ?? {}
  const m = (owaspCategory ?? '').match(/A(\d{2})/)
  if (m) {
    const key = `A${m[1]}`
    if (key in mapping) return mapping[key]
  }
  return mapping._default ?? []
}

export const SUPPORTED_FRAMEWORKS: Framework[] = ['DORA', 'NIS2', 'PCI-DSS']
