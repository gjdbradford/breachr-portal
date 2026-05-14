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

// ---------------------------------------------------------------------------
// Dashboard compliance scoring — framework definitions and score calculators
// ---------------------------------------------------------------------------

export interface Article {
  ref: string
  name: string
  desc: string
}

export interface FrameworkDef {
  id: string
  name: string
  articles: Article[]
}

export interface FrameworkScoreInputs {
  hasScans: boolean
  completedScans: number
  criticals: number
  highs: number
  open: number
  total: number
  remediated: number
  tlpt: number
  surfaceCount: number
  auditEvents: number
  auditSignedRatio: number  // 0–1
  remediatedRatio: number   // 0–1
}

export interface ArticleScore {
  ref: string
  name: string
  desc: string
  score: number  // 0–100
}

export interface FrameworkScore {
  id: string
  overall: number          // 0–100, average of article scores
  articles: ArticleScore[]
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export const FRAMEWORKS: FrameworkDef[] = [
  {
    id: 'DORA',
    name: 'DORA',
    articles: [
      { ref: 'Art. 5–10',  name: 'ICT Risk Management',     desc: 'Governance framework' },
      { ref: 'Art. 17',    name: 'ICT Incident Management', desc: 'Classification & reporting' },
      { ref: 'Art. 24',    name: 'General ICT Testing',     desc: 'Annual pen test coverage' },
      { ref: 'Art. 25',    name: 'Advanced Testing (TLPT)', desc: 'TLPT every 3 years' },
      { ref: 'Art. 26',    name: 'TIBER-EU TLPT',           desc: 'Significant entities only' },
      { ref: 'Art. 28–30', name: 'Third-party ICT Risk',    desc: 'Vendor pen testing' },
    ],
  },
  {
    id: 'PCI-DSS',
    name: 'PCI-DSS',
    articles: [
      { ref: 'Req 1–2',   name: 'Network Security Controls',  desc: 'Firewalls & system config' },
      { ref: 'Req 3–4',   name: 'Cardholder Data Protection', desc: 'Encryption & storage' },
      { ref: 'Req 6',     name: 'Secure Systems & Software',  desc: 'Vulnerability management' },
      { ref: 'Req 10–11', name: 'Log Monitoring & Testing',   desc: 'Pen test & IDS' },
    ],
  },
  {
    id: 'NIS2',
    name: 'NIS2',
    articles: [
      { ref: 'Art. 5–6', name: 'Scope & Definitions',         desc: 'Entity classification' },
      { ref: 'Art. 21',  name: 'Cybersecurity Risk Measures', desc: 'Technical & operational' },
      { ref: 'Art. 23',  name: 'Incident Reporting',          desc: '24h initial notification' },
    ],
  },
  {
    id: 'HIPAA',
    name: 'HIPAA',
    articles: [
      { ref: '§ 164.308', name: 'Administrative Safeguards', desc: 'Security management process' },
      { ref: '§ 164.310', name: 'Physical Safeguards',       desc: 'Facility access controls' },
      { ref: '§ 164.312', name: 'Technical Safeguards',      desc: 'Access controls & audit' },
    ],
  },
  {
    id: 'ISO27001',
    name: 'ISO 27001',
    articles: [
      { ref: 'A.5',  name: 'Information Security Policies', desc: 'Management direction' },
      { ref: 'A.8',  name: 'Asset Management',              desc: 'Responsibility for assets' },
      { ref: 'A.12', name: 'Operations Security',           desc: 'Malware & logging' },
      { ref: 'A.14', name: 'System Acquisition & Dev',      desc: 'Security requirements' },
    ],
  },
  {
    id: 'SOC2',
    name: 'SOC 2',
    articles: [
      { ref: 'CC6', name: 'Logical Access',    desc: 'Authentication & authorisation' },
      { ref: 'CC7', name: 'System Operations', desc: 'Monitoring & incident response' },
      { ref: 'CC8', name: 'Change Management', desc: 'System change controls' },
    ],
  },
]

type ArticleScoreFn = (inputs: FrameworkScoreInputs) => number

const DORA_SCORERS: ArticleScoreFn[] = [
  (i) => !i.hasScans ? 0 : clamp(50 + i.remediatedRatio * 30 + (i.surfaceCount > 0 ? 10 : 0) + (i.criticals === 0 ? 10 : 0)),
  (i) => !i.hasScans ? 0 : clamp(80 - i.criticals * 12),
  (i) => clamp(i.completedScans * 25),
  (i) => clamp(i.tlpt * 50),
  (i) => i.tlpt > 0 ? 60 : 0,
  (i) => clamp(i.surfaceCount * 30 + (i.hasScans ? 40 : 0)),
]

const PCI_SCORERS: ArticleScoreFn[] = [
  (i) => !i.hasScans ? 0 : clamp(i.surfaceCount > 0 ? 70 + (i.criticals === 0 ? 10 : 0) : 40),
  (i) => !i.hasScans ? 0 : clamp(80 - i.criticals * 15),
  (i) => !i.hasScans ? 0 : clamp(i.completedScans * 20),
  (i) => !i.hasScans ? 0 : clamp(i.auditSignedRatio * 70 + Math.min(30, i.completedScans * 5)),
]

const NIS2_SCORERS: ArticleScoreFn[] = [
  (_i) => 90,
  (i) => !i.hasScans ? 0 : clamp(60 + i.remediatedRatio * 30 + (i.criticals === 0 ? 10 : 0)),
  (i) => !i.hasScans ? 0 : clamp(i.auditEvents > 0 ? 60 + i.auditSignedRatio * 30 : 40),
]

const GENERIC_SCORER: ArticleScoreFn = (i) =>
  !i.hasScans ? 0 : clamp(50 + i.remediatedRatio * 30 + (i.criticals === 0 ? 20 : 0))

const SCORERS: Record<string, ArticleScoreFn[]> = {
  'DORA':    DORA_SCORERS,
  'PCI-DSS': PCI_SCORERS,
  'NIS2':    NIS2_SCORERS,
}

export function computeFrameworkScore(
  framework: FrameworkDef,
  inputs: FrameworkScoreInputs,
): FrameworkScore {
  const scorers = SCORERS[framework.id]
  const articles: ArticleScore[] = framework.articles.map((art, i) => {
    const scorer = scorers ? (scorers[i] ?? GENERIC_SCORER) : GENERIC_SCORER
    return { ...art, score: scorer(inputs) }
  })
  const overall = articles.length > 0
    ? clamp(articles.reduce((sum, a) => sum + a.score, 0) / articles.length)
    : 0
  return { id: framework.id, overall, articles }
}

export const FRAMEWORK_COLOR: Record<string, string> = {
  'DORA':     '#3b82f6',
  'PCI-DSS':  '#f59e0b',
  'NIS2':     '#22c55e',
  'HIPAA':    '#a78bfa',
  'ISO27001': '#14b8a6',
  'SOC2':     '#64748b',
}
