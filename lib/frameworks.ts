// OWASP Top 10 2021 → compliance framework control mapping.
// Mirrors scanner/engine/frameworks.py — keep in sync.

export type Framework = 'DORA' | 'NIS2' | 'PCI-DSS' | 'HIPAA' | 'ISO27001' | 'SOC2'

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
  HIPAA: {
    A01: ['§164.312(a)(1)'], A02: ['§164.312(e)(2)(ii)'], A03: ['§164.312(c)(1)'],
    A04: ['§164.312(b)'],    A05: ['§164.312(a)(2)(iv)'], A06: ['§164.308(a)(5)'],
    A07: ['§164.312(a)(2)(i)'], A08: ['§164.312(c)(2)'], A09: ['§164.312(b)'],
    A10: ['§164.312(c)(1)'], _default: ['§164.312(b)'],
  },
  ISO27001: {
    A01: ['A.5.15', 'A.8.3'],  A02: ['A.8.24'],         A03: ['A.8.28'],
    A04: ['A.8.25', 'A.8.27'], A05: ['A.8.8', 'A.8.9'], A06: ['A.8.8'],
    A07: ['A.5.17', 'A.8.5'],  A08: ['A.8.7', 'A.8.16'], A09: ['A.8.15', 'A.8.16'],
    A10: ['A.8.22', 'A.8.23'], _default: ['A.8.8'],
  },
  SOC2: {
    A01: ['CC6.1', 'CC6.3'], A02: ['CC6.7'],        A03: ['CC7.1'],
    A04: ['CC8.1'],          A05: ['CC6.6', 'CC7.1'], A06: ['CC7.1'],
    A07: ['CC6.1', 'CC6.2'], A08: ['CC7.1'],         A09: ['CC7.2'],
    A10: ['CC6.6'],          _default: ['CC7.1'],
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

export const SUPPORTED_FRAMEWORKS: Framework[] = ['DORA', 'NIS2', 'PCI-DSS', 'HIPAA', 'ISO27001', 'SOC2']
