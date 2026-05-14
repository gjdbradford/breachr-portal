# Dashboard Redesign — CISO Command Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the DORA-only compliance dashboard with a modular CISO Command centre featuring a weighted exposure score, multi-framework expandable compliance rows, AI engine tier panel, target/sensor/inventory summary, and plan-based scanning tiers.

**Architecture:** Server component `app/dashboard/page.tsx` fetches all data and passes props to new presentational components in `components/dashboard/`. Pure scoring logic lives in `lib/frameworks.ts` and `lib/exposure-score.ts` — these are unit-tested independently. `FrameworkRow.tsx` is the only client component (needs `localStorage` for expand state).

**Tech Stack:** Next.js (portal version — check `node_modules/next/dist/docs/` before touching routing), Supabase client, TypeScript, Vitest (node env — no jsdom, no React component tests), inline styles (match existing codebase pattern).

**Spec:** `docs/superpowers/specs/2026-05-14-dashboard-redesign-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `supabase/migrations/20260514_tenant_node_model_region.sql` | Add node_count, ai_model_override, data_region to tenants |
| Modify | `lib/plans.ts` | Add ScanTier type, PLAN_TIER map, TIER_CONFIG |
| Create | `lib/frameworks.ts` | Framework definitions + article score calculators |
| Create | `lib/exposure-score.ts` | Weighted exposure score engine |
| Create | `__tests__/lib/plans-tier.test.ts` | Tests for tier additions |
| Create | `__tests__/lib/frameworks.test.ts` | Tests for score calculators |
| Create | `__tests__/lib/exposure-score.test.ts` | Tests for exposure engine |
| Create | `components/dashboard/KpiGrid.tsx` | 6-tile KPI grid (extracts MetricCard) |
| Create | `components/dashboard/ExposureGauge.tsx` | SVG gauge + component breakdown |
| Create | `components/dashboard/AiEnginePanel.tsx` | Tier badge + model + nodes + region |
| Create | `components/dashboard/FrameworkRow.tsx` | Single expandable framework row (client) |
| Create | `components/dashboard/FrameworkAccordion.tsx` | Renders list of FrameworkRow for active frameworks |
| Create | `components/dashboard/TargetsCard.tsx` | Attack surface breakdown by type |
| Create | `components/dashboard/InventoryMiniCard.tsx` | Asset count summary |
| Create | `components/dashboard/SensorsMiniCard.tsx` | Sensor online/offline status |
| Modify | `components/DashboardNav.tsx` | Add tier medal badge to plan footer |
| Modify | `app/dashboard/page.tsx` | New layout, new queries, wire all components |

---

## Task 1: DB Migration — tenant node/model/region columns

**Files:**
- Create: `supabase/migrations/20260514_tenant_node_model_region.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260514_tenant_node_model_region.sql
alter table tenants
  add column if not exists node_count        smallint not null default 1,
  add column if not exists ai_model_override text,
  add column if not exists data_region       text not null default 'eu';
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with the SQL above against the project. Confirm success.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260514_tenant_node_model_region.sql
git commit -m "feat: add tenant node_count, ai_model_override, data_region columns"
```

---

## Task 2: Plan Tier System — `lib/plans.ts` additions

**Files:**
- Modify: `lib/plans.ts`
- Create: `__tests__/lib/plans-tier.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/plans-tier.test.ts
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd portal && npx vitest run __tests__/lib/plans-tier.test.ts
```
Expected: `FAIL` — `PLAN_TIER is not exported`

- [ ] **Step 3: Add tier exports to `lib/plans.ts`**

Append to the end of the existing `lib/plans.ts` file (after the `fmtTokens` function):

```ts
// ── Scanning tier system ──────────────────────────────────────────────────

export type ScanTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export const PLAN_TIER: Record<PlanId, ScanTier> = {
  free:         'bronze',
  starter:      'silver',
  professional: 'gold',
  enterprise:   'platinum',
}

export interface TierConfig {
  label: string
  badge: string        // medal emoji
  modelClass: string   // human-readable description shown in AI panel
  maxNodes: number     // display cap for node dots
  byoModel: boolean    // whether Switch/BYO button is enabled
  onPrem: boolean      // whether on-prem option is shown
}

export const TIER_CONFIG: Record<ScanTier, TierConfig> = {
  bronze:   { label: 'Bronze',   badge: '🥉', modelClass: 'Lightweight AI',           maxNodes: 1,  byoModel: false, onPrem: false },
  silver:   { label: 'Silver',   badge: '🥈', modelClass: 'Standard AI',               maxNodes: 1,  byoModel: false, onPrem: false },
  gold:     { label: 'Gold',     badge: '🥇', modelClass: 'Multi-Agent AI',            maxNodes: 3,  byoModel: false, onPrem: false },
  platinum: { label: 'Platinum', badge: '💎', modelClass: 'Best Models · Multi-Agent', maxNodes: 10, byoModel: true,  onPrem: true  },
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run __tests__/lib/plans-tier.test.ts
```
Expected: `PASS` — 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/plans.ts __tests__/lib/plans-tier.test.ts
git commit -m "feat: add ScanTier, PLAN_TIER, TIER_CONFIG to plans.ts"
```

---

## Task 3: Framework Definitions — `lib/frameworks.ts`

**Files:**
- Create: `lib/frameworks.ts`
- Create: `__tests__/lib/frameworks.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/frameworks.test.ts
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run __tests__/lib/frameworks.test.ts
```
Expected: `FAIL` — `Cannot find module '@/lib/frameworks'`

- [ ] **Step 3: Create `lib/frameworks.ts`**

```ts
// lib/frameworks.ts

export interface Article {
  ref: string
  name: string
  desc: string
}

export interface Framework {
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

// ── Framework definitions ─────────────────────────────────────────────────

export const FRAMEWORKS: Framework[] = [
  {
    id: 'DORA',
    name: 'DORA',
    articles: [
      { ref: 'Art. 5–10', name: 'ICT Risk Management',      desc: 'Governance framework' },
      { ref: 'Art. 17',   name: 'ICT Incident Management',  desc: 'Classification & reporting' },
      { ref: 'Art. 24',   name: 'General ICT Testing',      desc: 'Annual pen test coverage' },
      { ref: 'Art. 25',   name: 'Advanced Testing (TLPT)',  desc: 'TLPT every 3 years' },
      { ref: 'Art. 26',   name: 'TIBER-EU TLPT',            desc: 'Significant entities only' },
      { ref: 'Art. 28–30', name: 'Third-party ICT Risk',    desc: 'Vendor pen testing' },
    ],
  },
  {
    id: 'PCI-DSS',
    name: 'PCI-DSS',
    articles: [
      { ref: 'Req 1–2',  name: 'Network Security Controls',   desc: 'Firewalls & system config' },
      { ref: 'Req 3–4',  name: 'Cardholder Data Protection',  desc: 'Encryption & storage' },
      { ref: 'Req 6',    name: 'Secure Systems & Software',   desc: 'Vulnerability management' },
      { ref: 'Req 10–11', name: 'Log Monitoring & Testing',   desc: 'Pen test & IDS' },
    ],
  },
  {
    id: 'NIS2',
    name: 'NIS2',
    articles: [
      { ref: 'Art. 5–6',  name: 'Scope & Definitions',         desc: 'Entity classification' },
      { ref: 'Art. 21',   name: 'Cybersecurity Risk Measures', desc: 'Technical & operational' },
      { ref: 'Art. 23',   name: 'Incident Reporting',          desc: '24h initial notification' },
    ],
  },
  {
    id: 'HIPAA',
    name: 'HIPAA',
    articles: [
      { ref: '§ 164.308', name: 'Administrative Safeguards',  desc: 'Security management process' },
      { ref: '§ 164.310', name: 'Physical Safeguards',        desc: 'Facility access controls' },
      { ref: '§ 164.312', name: 'Technical Safeguards',       desc: 'Access controls & audit' },
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
      { ref: 'CC6',  name: 'Logical Access',    desc: 'Authentication & authorisation' },
      { ref: 'CC7',  name: 'System Operations', desc: 'Monitoring & incident response' },
      { ref: 'CC8',  name: 'Change Management', desc: 'System change controls' },
    ],
  },
]

// ── Per-article score calculators ─────────────────────────────────────────

type ArticleScoreFn = (inputs: FrameworkScoreInputs) => number

const DORA_SCORERS: ArticleScoreFn[] = [
  // Art. 5–10: ICT Risk Management
  (i) => !i.hasScans ? 0 : clamp(50 + i.remediatedRatio * 30 + (i.surfaceCount > 0 ? 10 : 0) + (i.criticals === 0 ? 10 : 0)),
  // Art. 17: ICT Incident Management
  (i) => !i.hasScans ? 0 : clamp(80 - i.criticals * 12),
  // Art. 24: General ICT Testing
  (i) => clamp(i.completedScans * 25),
  // Art. 25: Advanced Testing
  (i) => clamp(i.tlpt * 50),
  // Art. 26: TIBER-EU
  (i) => i.tlpt > 0 ? 60 : 0,
  // Art. 28–30: Third-party
  (i) => clamp(i.surfaceCount * 30 + (i.hasScans ? 40 : 0)),
]

const PCI_SCORERS: ArticleScoreFn[] = [
  // Req 1–2: Network Security
  (i) => !i.hasScans ? 0 : clamp(i.surfaceCount > 0 ? 70 + (i.criticals === 0 ? 10 : 0) : 40),
  // Req 3–4: Cardholder Data
  (i) => !i.hasScans ? 0 : clamp(80 - i.criticals * 15),
  // Req 6: Secure Systems
  (i) => !i.hasScans ? 0 : clamp(i.completedScans * 20),
  // Req 10–11: Log Monitoring
  (i) => !i.hasScans ? 0 : clamp(i.auditSignedRatio * 70 + Math.min(30, i.completedScans * 5)),
]

const NIS2_SCORERS: ArticleScoreFn[] = [
  // Art. 5–6: Scope (always satisfied by platform usage)
  (_i) => 90,
  // Art. 21: Risk Measures
  (i) => !i.hasScans ? 0 : clamp(60 + i.remediatedRatio * 30 + (i.criticals === 0 ? 10 : 0)),
  // Art. 23: Incident Reporting
  (i) => !i.hasScans ? 0 : clamp(i.auditEvents > 0 ? 60 + i.auditSignedRatio * 30 : 40),
]

// Generic scorer for frameworks without tailored logic — returns 0 until scans run
const GENERIC_SCORER: ArticleScoreFn = (i) =>
  !i.hasScans ? 0 : clamp(50 + i.remediatedRatio * 30 + (i.criticals === 0 ? 20 : 0))

const SCORERS: Record<string, ArticleScoreFn[]> = {
  'DORA':    DORA_SCORERS,
  'PCI-DSS': PCI_SCORERS,
  'NIS2':    NIS2_SCORERS,
}

// ── Public API ────────────────────────────────────────────────────────────

export function computeFrameworkScore(
  framework: Framework,
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
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run __tests__/lib/frameworks.test.ts
```
Expected: `PASS` — all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/frameworks.ts __tests__/lib/frameworks.test.ts
git commit -m "feat: add framework definitions and article score calculators"
```

---

## Task 4: Exposure Score Engine — `lib/exposure-score.ts`

**Files:**
- Create: `lib/exposure-score.ts`
- Create: `__tests__/lib/exposure-score.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/exposure-score.test.ts
import { describe, it, expect } from 'vitest'
import { computeExposureScore, type ExposureDimension } from '@/lib/exposure-score'

describe('computeExposureScore', () => {
  it('returns 0 when all dimension scores are 0', () => {
    const dims: ExposureDimension[] = [
      { label: 'A', weight: 0.5, score: 0 },
      { label: 'B', weight: 0.5, score: 0 },
    ]
    expect(computeExposureScore(dims)).toBe(0)
  })

  it('returns 100 when all dimension scores are 100', () => {
    const dims: ExposureDimension[] = [
      { label: 'A', weight: 0.35, score: 100 },
      { label: 'B', weight: 0.30, score: 100 },
      { label: 'C', weight: 0.20, score: 100 },
      { label: 'D', weight: 0.15, score: 100 },
    ]
    expect(computeExposureScore(dims)).toBe(100)
  })

  it('computes correct weighted average', () => {
    const dims: ExposureDimension[] = [
      { label: 'A', weight: 0.5, score: 80 },
      { label: 'B', weight: 0.5, score: 60 },
    ]
    // (80*0.5 + 60*0.5) = 70
    expect(computeExposureScore(dims)).toBe(70)
  })

  it('normalises unequal weights that do not sum to 1', () => {
    const dims: ExposureDimension[] = [
      { label: 'A', weight: 1, score: 100 },
      { label: 'B', weight: 1, score: 0 },
    ]
    // normalised: each 0.5, result = 50
    expect(computeExposureScore(dims)).toBe(50)
  })

  it('result is always clamped to 0–100', () => {
    const dims: ExposureDimension[] = [
      { label: 'A', weight: 0.5, score: 200 },
      { label: 'B', weight: 0.5, score: -50 },
    ]
    const result = computeExposureScore(dims)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(100)
  })

  it('returns 0 for empty array', () => {
    expect(computeExposureScore([])).toBe(0)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run __tests__/lib/exposure-score.test.ts
```
Expected: `FAIL` — `Cannot find module '@/lib/exposure-score'`

- [ ] **Step 3: Create `lib/exposure-score.ts`**

```ts
// lib/exposure-score.ts

export interface ExposureDimension {
  label: string
  weight: number   // positive number; normalised internally
  score: number    // 0–100
}

export function computeExposureScore(dimensions: ExposureDimension[]): number {
  if (dimensions.length === 0) return 0
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0)
  if (totalWeight === 0) return 0
  const raw = dimensions.reduce((sum, d) => sum + (d.score * d.weight) / totalWeight, 0)
  return Math.max(0, Math.min(100, Math.round(raw)))
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run __tests__/lib/exposure-score.test.ts
```
Expected: `PASS` — all 6 tests green.

- [ ] **Step 5: Run all lib tests to check for regressions**

```bash
npx vitest run __tests__/lib/
```
Expected: all previously passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add lib/exposure-score.ts __tests__/lib/exposure-score.test.ts
git commit -m "feat: add weighted exposure score engine"
```

---

## Task 5: KPI Grid Component — `components/dashboard/KpiGrid.tsx`

**Files:**
- Create: `components/dashboard/KpiGrid.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/dashboard/KpiGrid.tsx

interface KpiTile {
  label: string
  value: string
  suffix?: string
  sub: string
  accent: string
  borderColor: string
}

interface KpiGridProps {
  tiles: KpiTile[]
}

export default function KpiGrid({ tiles }: KpiGridProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: '1fr 1fr', gap: 8 }}>
      {tiles.map((tile) => (
        <div key={tile.label} style={{ background: 'rgba(13,20,40,0.7)', border: `1px solid ${tile.borderColor}`, borderRadius: 7, padding: '10px 12px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: tile.accent }} />
          <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{tile.label}</p>
          <p style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: tile.accent, marginBottom: 3 }}>
            {tile.value}{tile.suffix && <span style={{ fontSize: 13 }}>{tile.suffix}</span>}
          </p>
          <p style={{ fontSize: 9, color: '#64748b' }}>{tile.sub}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/KpiGrid.tsx
git commit -m "feat: add KpiGrid component (6-tile dashboard KPI grid)"
```

---

## Task 6: Exposure Gauge Component — `components/dashboard/ExposureGauge.tsx`

**Files:**
- Create: `components/dashboard/ExposureGauge.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/dashboard/ExposureGauge.tsx
import type { ExposureDimension } from '@/lib/exposure-score'

interface ExposureGaugeProps {
  score: number
  dimensions: ExposureDimension[]
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Low Risk'
  if (score >= 50) return 'Medium Risk'
  return 'High Risk'
}

export default function ExposureGauge({ score, dimensions }: ExposureGaugeProps) {
  const color = scoreColor(score)
  const circumference = 2 * Math.PI * 32
  const dashArr = Math.round((score / 100) * circumference)

  return (
    <div style={{ background: 'rgba(13,20,40,0.9)', border: `1px solid rgba(245,158,11,0.2)`, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},#ef4444)` }} />
      <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Weighted Exposure</p>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          <circle cx="40" cy="40" r="32" fill="none"
            stroke={color} strokeWidth="7"
            strokeDasharray={`${dashArr} ${circumference}`}
            strokeDashoffset="50"
            strokeLinecap="round"
            transform="rotate(-90 40 40)" />
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>/100</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color, fontWeight: 600 }}>{scoreLabel(score)}</div>
      <div style={{ width: '100%' }}>
        {dimensions.map((d) => (
          <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 9 }}>
            <span style={{ color: '#64748b' }}>{d.label}</span>
            <span style={{ fontFamily: 'monospace', color: scoreColor(d.score), fontWeight: 600 }}>{d.score}%</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: '#475569', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 5, width: '100%' }}>
        Weighted across {dimensions.length} dimensions
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/ExposureGauge.tsx
git commit -m "feat: add ExposureGauge component with SVG ring and dimension breakdown"
```

---

## Task 7: AI Engine Panel — `components/dashboard/AiEnginePanel.tsx`

**Files:**
- Create: `components/dashboard/AiEnginePanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/dashboard/AiEnginePanel.tsx
import { PLAN_TIER, TIER_CONFIG } from '@/lib/plans'
import type { PlanId } from '@/lib/plans'

interface AiEnginePanelProps {
  planId: string
  activeModel: string | null
  nodeCount: number
  dataRegion: string
}

export default function AiEnginePanel({ planId, activeModel, nodeCount, dataRegion }: AiEnginePanelProps) {
  const tier = PLAN_TIER[(planId as PlanId) ?? 'free'] ?? 'bronze'
  const config = TIER_CONFIG[tier]
  const isAfrica = dataRegion === 'africa'

  return (
    <div style={{ background: 'rgba(13,20,40,0.9)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#a78bfa,#818cf8)' }} />

      {/* Tier */}
      <div>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>AI Engine</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            {config.badge}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>{config.label} Tier</div>
            <div style={{ fontSize: 10, color: '#7c6fcd' }}>{config.modelClass}</div>
          </div>
        </div>
      </div>

      {/* Active model */}
      <div>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Active Model</p>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8', background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 4, padding: '3px 7px', display: 'inline-block' }}>
          {activeModel ?? 'claude-haiku-4-5'}
        </span>
        <div style={{ marginTop: 6 }}>
          {config.byoModel ? (
            <a href="/dashboard/settings?tab=ai" style={{ display: 'block', fontSize: 9, color: '#a78bfa', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 4, padding: '4px 8px', textDecoration: 'none', textAlign: 'center' }}>
              ⚙ Switch / BYO Model →
            </a>
          ) : (
            <div title="Available on Enterprise" style={{ fontSize: 9, color: '#475569', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '4px 8px', textAlign: 'center', cursor: 'default' }}>
              ⚙ Switch model — Enterprise only
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Nodes */}
      <div>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Scan Nodes</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {Array.from({ length: config.maxNodes }).map((_, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < nodeCount ? '#22c55e' : '#334155', boxShadow: i < nodeCount ? '0 0 4px rgba(34,197,94,0.5)' : 'none' }} title={i < nodeCount ? `Node ${i + 1} active` : 'Inactive'} />
          ))}
          <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 600, marginLeft: 4 }}>{nodeCount} active</span>
        </div>
        {tier !== 'platinum' && (
          <p style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>More nodes available on Enterprise</p>
        )}
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Data residency */}
      <div>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Data Residency</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13 }}>{isAfrica ? '🌍' : '🇪🇺'}</span>
          <span style={{ fontSize: 10, color: '#64748b' }}>{isAfrica ? 'Africa · Cape Town' : 'EU · Frankfurt'}</span>
          <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>{isAfrica ? '✓ POPIA' : '✓ GDPR'}</span>
        </div>
        {!isAfrica && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.45 }}>
            <span style={{ fontSize: 13 }}>🌍</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>Africa · Cape Town (add-on)</span>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/AiEnginePanel.tsx
git commit -m "feat: add AiEnginePanel with tier badge, nodes, model, and data residency"
```

---

## Task 8: Framework Row (client) — `components/dashboard/FrameworkRow.tsx`

**Files:**
- Create: `components/dashboard/FrameworkRow.tsx`

- [ ] **Step 1: Create the client component**

```tsx
// components/dashboard/FrameworkRow.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { FrameworkScore } from '@/lib/frameworks'
import { FRAMEWORK_COLOR } from '@/lib/frameworks'

interface FrameworkRowProps {
  score: FrameworkScore
  frameworkName: string
}

function statusPill(s: number) {
  if (s >= 80) return { label: '✓ Compliant',    color: '#4ade80', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)' }
  if (s >= 50) return { label: '⚠ Partial',      color: '#fbbf24', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' }
  if (s > 0)   return { label: '✗ Non-compliant', color: '#f87171', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)' }
  return       { label: '○ Not assessed',  color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' }
}

const FRAMEWORK_SHORTCUTS: Record<string, { label: string; href: string; color: string; borderColor: string; bgColor: string }[]> = {
  'DORA':    [
    { label: '📄 Export BaFin Pack', href: '/dashboard/reports', color: '#42a5f5', borderColor: 'rgba(66,165,245,0.3)', bgColor: 'rgba(66,165,245,0.08)' },
    { label: '📋 DORA Report',       href: '/dashboard/reports', color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)',  bgColor: 'rgba(34,197,94,0.08)' },
    { label: '⬡ Inventory',          href: '/dashboard/inventory', color: '#64748b', borderColor: 'rgba(100,116,139,0.2)', bgColor: 'rgba(100,116,139,0.06)' },
  ],
  'PCI-DSS': [
    { label: '📄 PCI-DSS Report',    href: '/dashboard/reports',   color: '#42a5f5', borderColor: 'rgba(66,165,245,0.3)', bgColor: 'rgba(66,165,245,0.08)' },
    { label: '🔐 Cardholder Scope',  href: '/dashboard/inventory', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)', bgColor: 'rgba(245,158,11,0.08)' },
  ],
  'NIS2':    [
    { label: '📄 NIS2 Report',       href: '/dashboard/reports', color: '#42a5f5', borderColor: 'rgba(66,165,245,0.3)', bgColor: 'rgba(66,165,245,0.08)' },
    { label: '✓ Export evidence',    href: '/dashboard/reports', color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)',  bgColor: 'rgba(34,197,94,0.08)' },
  ],
}

export default function FrameworkRow({ score, frameworkName }: FrameworkRowProps) {
  const color = FRAMEWORK_COLOR[score.id] ?? '#64748b'
  const storageKey = `fw-expanded-${score.id}`
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(storageKey) === 'true')
    } catch { /* noop */ }
  }, [storageKey])

  function toggle() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem(storageKey, String(next)) } catch { /* noop */ }
  }

  const criticals = score.articles.filter(a => a.score > 0 && a.score < 50).length
  const borderColor = `${color}33`
  const bgColor = `${color}10`
  const shortcuts = FRAMEWORK_SHORTCUTS[score.id] ?? []

  return (
    <div style={{ borderRadius: 7, overflow: 'hidden', border: `1px solid ${borderColor}` }}>
      {/* Header row — always visible */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => e.key === 'Enter' && toggle()}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: bgColor, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color, minWidth: 62, letterSpacing: '0.02em' }}>{frameworkName}</span>
        <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${score.overall}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34, textAlign: 'right', fontFamily: 'monospace' }}>{score.overall}%</span>
        {criticals > 0 ? (
          <span style={{ fontSize: 9, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 3, padding: '2px 6px', whiteSpace: 'nowrap' }}>
            {criticals} critical
          </span>
        ) : score.overall >= 80 ? (
          <span style={{ fontSize: 9, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', borderRadius: 3, padding: '2px 6px' }}>
            Compliant
          </span>
        ) : null}
        <span style={{ fontSize: 10, color: '#475569', marginLeft: 2, transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>

      {/* Body — articles table on expand */}
      {open && (
        <div style={{ padding: '8px 12px 10px', background: 'rgba(10,14,26,0.5)', borderTop: `1px solid ${color}1a` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Article', 'Requirement', 'Score', 'Status'].map(h => (
                  <th key={h} style={{ fontSize: 8, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '3px 6px 5px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {score.articles.map((art) => {
                const pill = statusPill(art.score)
                return (
                  <tr key={art.ref}>
                    <td style={{ padding: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569', whiteSpace: 'nowrap' }}>{art.ref}</span>
                    </td>
                    <td style={{ padding: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{art.name}</div>
                      <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>{art.desc}</div>
                    </td>
                    <td style={{ padding: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, minWidth: 60, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${art.score}%`, background: art.score >= 80 ? '#22c55e' : art.score >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#64748b', minWidth: 28 }}>{art.score > 0 ? `${art.score}%` : '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 3, fontSize: 9, fontWeight: 600, padding: '2px 6px', whiteSpace: 'nowrap', color: pill.color, background: pill.bg, border: `1px solid ${pill.border}` }}>
                        {pill.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {shortcuts.length > 0 && (
            <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
              {shortcuts.map((s) => (
                <Link key={s.label} href={s.href} style={{ fontSize: 9, borderRadius: 4, padding: '3px 8px', fontWeight: 500, border: `1px solid ${s.borderColor}`, background: s.bgColor, color: s.color, textDecoration: 'none' }}>
                  {s.label}
                </Link>
              ))}
              <Link href={`/dashboard/findings`} style={{ fontSize: 9, borderRadius: 4, padding: '3px 8px', fontWeight: 500, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', textDecoration: 'none' }}>
                ⚠ View Findings
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/FrameworkRow.tsx
git commit -m "feat: add FrameworkRow client component with localStorage expand state"
```

---

## Task 9: Framework Accordion — `components/dashboard/FrameworkAccordion.tsx`

**Files:**
- Create: `components/dashboard/FrameworkAccordion.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/dashboard/FrameworkAccordion.tsx
import Link from 'next/link'
import type { FrameworkScore } from '@/lib/frameworks'
import { FRAMEWORKS } from '@/lib/frameworks'
import FrameworkRow from './FrameworkRow'

interface FrameworkAccordionProps {
  activeFrameworks: string[]   // e.g. ['DORA','PCI-DSS']
  scores: FrameworkScore[]
}

export default function FrameworkAccordion({ activeFrameworks, scores }: FrameworkAccordionProps) {
  const scoreMap = Object.fromEntries(scores.map(s => [s.id, s]))

  if (activeFrameworks.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>No compliance frameworks configured.</p>
        <Link href="/dashboard/settings?tab=compliance" style={{ fontSize: 12, color: '#42a5f5' }}>Configure frameworks →</Link>
      </div>
    )
  }

  const activeDefinitions = FRAMEWORKS.filter(f => activeFrameworks.includes(f.id))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Compliance Frameworks</p>
          <p style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
            Expand a framework to see article-level detail ·{' '}
            <Link href="/dashboard/settings?tab=compliance" style={{ color: '#42a5f5', textDecoration: 'none' }}>Manage →</Link>
          </p>
        </div>
        <span style={{ fontSize: 10, color: '#64748b' }}>Based on scan history</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {activeDefinitions.map((fw) => {
          const score = scoreMap[fw.id]
          if (!score) return null
          return <FrameworkRow key={fw.id} score={score} frameworkName={fw.name} />
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/FrameworkAccordion.tsx
git commit -m "feat: add FrameworkAccordion wrapper component"
```

---

## Task 10: Targets Card — `components/dashboard/TargetsCard.tsx`

**Files:**
- Create: `components/dashboard/TargetsCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/dashboard/TargetsCard.tsx
import Link from 'next/link'

export interface TargetTypeSummary {
  type: string
  count: number
  cleanCount: number
  findingsCount: number
  criticalCount: number
}

const TYPE_DISPLAY: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  web:    { label: 'Web Applications',     icon: '🌐', color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  api:    { label: 'API Endpoints',         icon: '⚡', color: '#c4b5fd', bg: 'rgba(167,139,250,0.12)' },
  cloud:  { label: 'Cloud / Infrastructure', icon: '☁',  color: '#2dd4bf', bg: 'rgba(20,184,166,0.12)' },
  mobile: { label: 'Mobile Apps',           icon: '📱', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  other:  { label: 'Other',                 icon: '◎',  color: '#94a3b8', bg: 'rgba(100,116,139,0.12)' },
}

interface TargetsCardProps {
  summaries: TargetTypeSummary[]
  totalCount: number
}

export default function TargetsCard({ summaries, totalCount }: TargetsCardProps) {
  return (
    <div style={{ background: 'rgba(13,20,40,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Target Endpoints
          {totalCount > 0 && <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 5, textTransform: 'none', letterSpacing: 'normal', fontSize: 10 }}>({totalCount})</span>}
        </span>
        <Link href="/dashboard/targets" style={{ fontSize: 10, color: '#42a5f5', textDecoration: 'none' }}>View all →</Link>
      </div>
      {summaries.length === 0 ? (
        <div style={{ padding: '20px 14px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#475569' }}>No targets added yet.</p>
          <Link href="/onboarding" style={{ fontSize: 11, color: '#42a5f5' }}>Add a target →</Link>
        </div>
      ) : (
        summaries.map((s) => {
          const display = TYPE_DISPLAY[s.type] ?? TYPE_DISPLAY.other
          return (
            <div key={s.type} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ width: 22, height: 22, borderRadius: 5, background: display.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>
                {display.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{display.label}</div>
                <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                  {s.cleanCount > 0 && (
                    <span style={{ fontSize: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>
                      {s.cleanCount} clean
                    </span>
                  )}
                  {s.findingsCount > 0 && (
                    <span style={{ fontSize: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>
                      {s.findingsCount} findings
                    </span>
                  )}
                  {s.criticalCount > 0 && (
                    <span style={{ fontSize: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>
                      {s.criticalCount} critical
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: display.color, fontFamily: 'monospace' }}>{s.count}</div>
            </div>
          )
        })
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/TargetsCard.tsx
git commit -m "feat: add TargetsCard component with endpoint type breakdown"
```

---

## Task 11: Inventory + Sensors Mini Cards

**Files:**
- Create: `components/dashboard/InventoryMiniCard.tsx`
- Create: `components/dashboard/SensorsMiniCard.tsx`

- [ ] **Step 1: Create InventoryMiniCard**

```tsx
// components/dashboard/InventoryMiniCard.tsx
import Link from 'next/link'

interface InventoryMiniCardProps {
  total: number
  servers: number
  services: number
  unreviewed: number
}

export default function InventoryMiniCard({ total, servers, services, unreviewed }: InventoryMiniCardProps) {
  return (
    <div style={{ background: 'rgba(13,20,40,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Inventory</p>
        <Link href="/dashboard/inventory" style={{ fontSize: 9, color: '#42a5f5', textDecoration: 'none' }}>→</Link>
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', lineHeight: 1, marginBottom: 3 }}>{total}</p>
      <p style={{ fontSize: 9, color: '#64748b', marginBottom: 8 }}>assets discovered</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
          <span style={{ color: '#64748b' }}>Servers</span>
          <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{servers}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
          <span style={{ color: '#64748b' }}>Services</span>
          <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{services}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
          <span style={{ color: '#64748b' }}>Unreviewed</span>
          <span style={{ fontFamily: 'monospace', color: unreviewed > 0 ? '#f87171' : '#94a3b8' }}>{unreviewed}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create SensorsMiniCard**

```tsx
// components/dashboard/SensorsMiniCard.tsx
import Link from 'next/link'

interface SensorSummary {
  id: string
  name: string
  location: string | null
  status: string  // 'online' | 'offline' | other
}

interface SensorsMiniCardProps {
  sensors: SensorSummary[]
}

export default function SensorsMiniCard({ sensors }: SensorsMiniCardProps) {
  const online = sensors.filter(s => s.status === 'online').length
  const offline = sensors.length - online

  return (
    <div style={{ background: 'rgba(13,20,40,0.7)', border: '1px solid rgba(20,184,166,0.15)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sensors</p>
        <Link href="/dashboard/sensors" style={{ fontSize: 9, color: '#42a5f5', textDecoration: 'none' }}>→</Link>
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, color: '#14b8a6', lineHeight: 1, marginBottom: 3 }}>{online}</p>
      <p style={{ fontSize: 9, color: '#64748b', marginBottom: 8 }}>online{offline > 0 ? ` · ${offline} offline` : ' · 0 offline'}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {sensors.slice(0, 4).map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.status === 'online' ? '#22c55e' : '#334155', flexShrink: 0 }} />
            <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.location ?? s.name}</span>
          </div>
        ))}
        {sensors.length > 4 && <span style={{ fontSize: 9, color: '#475569' }}>+{sensors.length - 4} more</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/InventoryMiniCard.tsx components/dashboard/SensorsMiniCard.tsx
git commit -m "feat: add InventoryMiniCard and SensorsMiniCard components"
```

---

## Task 12: Sidebar Tier Badge — `components/DashboardNav.tsx`

**Files:**
- Modify: `components/DashboardNav.tsx`

- [ ] **Step 1: Add tier imports and badge to plan footer**

In `components/DashboardNav.tsx`, add the import at the top (after `getPlan`):

```ts
import { PLAN_TIER, TIER_CONFIG } from '@/lib/plans'
```

Then, in the plan footer `div` (the block starting `{!collapsed && <div style={{ margin: '0 12px 12px'...`), find the `plan-label` section:

```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: plan.color, display: 'inline-block' }} />
    <span style={{ fontSize: 10, fontWeight: 700, color: plan.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{plan.label}</span>
  </div>
  {planId !== 'enterprise' && (
    <Link href="/dashboard/upgrade" style={{ fontSize: 9, color: '#42a5f5', textDecoration: 'none', fontWeight: 600, letterSpacing: '0.04em' }}>
      Upgrade ↑
    </Link>
  )}
</div>
```

Replace it with:

```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: plan.color, display: 'inline-block' }} />
    <span style={{ fontSize: 10, fontWeight: 700, color: plan.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{plan.label}</span>
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
    <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 10, fontWeight: 700, letterSpacing: '0.05em', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
      {TIER_CONFIG[PLAN_TIER[(planId as import('@/lib/plans').PlanId) ?? 'free']].badge}{' '}
      {TIER_CONFIG[PLAN_TIER[(planId as import('@/lib/plans').PlanId) ?? 'free']].label}
    </span>
    {planId !== 'enterprise' && (
      <Link href="/dashboard/upgrade" style={{ fontSize: 9, color: '#42a5f5', textDecoration: 'none', fontWeight: 600, letterSpacing: '0.04em' }}>
        ↑
      </Link>
    )}
  </div>
</div>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/DashboardNav.tsx
git commit -m "feat: add scanning tier badge to sidebar plan footer"
```

---

## Task 13: Rewire `app/dashboard/page.tsx`

**Files:**
- Modify: `app/dashboard/page.tsx`

This is the final wiring task. It replaces the entire page body with the new layout while keeping the server-side data fetching pattern.

- [ ] **Step 1: Extend the data queries**

In `app/dashboard/page.tsx`, update the imports block at the top:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import LaunchScanButton from '@/components/LaunchScanButton'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { FRAMEWORKS, computeFrameworkScore } from '@/lib/frameworks'
import type { FrameworkScoreInputs } from '@/lib/frameworks'
import { computeExposureScore } from '@/lib/exposure-score'
import { PLAN_TIER, TIER_CONFIG } from '@/lib/plans'
import KpiGrid from '@/components/dashboard/KpiGrid'
import ExposureGauge from '@/components/dashboard/ExposureGauge'
import AiEnginePanel from '@/components/dashboard/AiEnginePanel'
import FrameworkAccordion from '@/components/dashboard/FrameworkAccordion'
import TargetsCard from '@/components/dashboard/TargetsCard'
import type { TargetTypeSummary } from '@/components/dashboard/TargetsCard'
import InventoryMiniCard from '@/components/dashboard/InventoryMiniCard'
import SensorsMiniCard from '@/components/dashboard/SensorsMiniCard'
```

- [ ] **Step 2: Extend the tenant select query**

Find:
```tsx
const { data: tenant } = await supabase
  .from('tenants').select('name, onboarding_complete, plan, industry, scans_this_month, tokens_used_this_month').eq('id', tenantId).single()
```

Replace with:
```tsx
const { data: tenant } = await supabase
  .from('tenants').select('name, onboarding_complete, plan, industry, scans_this_month, tokens_used_this_month, compliance_frameworks, node_count, ai_model_override, data_region').eq('id', tenantId).single()
```

- [ ] **Step 3: Extend the Promise.all block**

After the existing `resolved,` in the Promise.all destructure, add new queries. Find the closing `])` of the `Promise.all` and extend it:

```tsx
  const [
    { count: activeScans },
    { count: completedScans },
    { count: criticalOpen },
    { count: totalOpen },
    { count: totalFindings },
    { count: remediatedFindings },
    { count: tlptScans },
    { count: auditEvents },
    { count: auditSigned },
    { data: recentFindings },
    { data: recentAudit },
    { data: surfaces },
    resolved,
    { data: allSurfaces },
    { data: findingsPerSurface },
    { data: sensors },
    { count: inventoryTotal },
    { count: inventoryUnreviewed },
    { count: inventoryServers },
    { count: inventoryServices },
  ] = await Promise.all([
    supabase.from('scans').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'running'),
    supabase.from('scans').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'complete'),
    supabase.from('findings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('severity', 'critical').in('status', ['open', 'in_progress']),
    supabase.from('findings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['open', 'in_progress']),
    supabase.from('findings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('findings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['remediated', 'verified_fixed']),
    supabase.from('scans').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('scan_type', 'tlpt').eq('status', 'complete'),
    supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).not('signature', 'is', null),
    supabase.from('findings').select('id,title,severity,ai_model,ai_confidence,finding_hash,owasp_category,cvss_score,status,created_at,scan_id,attack_surface_id').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5),
    supabase.from('audit_logs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(6),
    supabase.from('attack_surfaces').select('id,name,target_url').eq('tenant_id', tenantId).eq('active', true),
    resolvePermissions(user.id),
    // New queries
    supabase.from('attack_surfaces').select('id,target_type').eq('tenant_id', tenantId).eq('active', true),
    supabase.from('findings').select('attack_surface_id,severity').eq('tenant_id', tenantId).in('status', ['open', 'in_progress']),
    supabase.from('sensors').select('id,name,status,location').eq('tenant_id', tenantId).order('name'),
    supabase.from('assets').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('assets').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true).is('acknowledged_at', null),
    supabase.from('assets').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true).eq('asset_type', 'server'),
    supabase.from('assets').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true).eq('asset_type', 'service'),
  ])
```

- [ ] **Step 4: Add derived variables after the Promise.all block**

After the existing `const signedRatio = ...` line, add:

```tsx
  const activeFrameworks: string[] = (tenant?.compliance_frameworks ?? []) as string[]
  const nodeCount = tenant?.node_count ?? 1
  const dataRegion = tenant?.data_region ?? 'eu'
  const activeModel = tenant?.ai_model_override ?? null

  // Build framework score inputs
  const fwInputs: FrameworkScoreInputs = {
    hasScans,
    completedScans: completedScans ?? 0,
    criticals,
    highs: 0,          // not yet tracked separately — safe default
    open,
    total,
    remediated,
    tlpt: tlpt ?? 0,
    surfaceCount,
    auditEvents: auditEvents ?? 0,
    auditSignedRatio: auditEvents ? (auditSigned ?? 0) / auditEvents : 0,
    remediatedRatio,
  }

  // Compute per-framework scores for active frameworks only
  const frameworkScores = FRAMEWORKS
    .filter(f => activeFrameworks.includes(f.id))
    .map(f => computeFrameworkScore(f, fwInputs))

  // Weighted exposure score dimensions
  const avgComplianceScore = frameworkScores.length > 0
    ? frameworkScores.reduce((sum, f) => sum + f.overall, 0) / frameworkScores.length
    : 0
  const findingsScore = Math.max(0, Math.min(100, 100 - criticals * 15 - open * 3))
  const coverageScore = hasScans ? Math.min(100, (completedScans ?? 0) * 12 + surfaceCount * 8) : 0
  const auditIntegrityScore = signedRatio

  const exposureDimensions = [
    { label: 'Compliance',   weight: 0.35, score: Math.round(avgComplianceScore) },
    { label: 'Findings',     weight: 0.30, score: findingsScore },
    { label: 'Coverage',     weight: 0.20, score: coverageScore },
    { label: 'Audit',        weight: 0.15, score: auditIntegrityScore },
  ]
  const exposureScore = computeExposureScore(exposureDimensions)

  // Build targets-by-type summary
  type FindingRow = { attack_surface_id: string | null; severity: string }
  const findingsBySurface: Record<string, FindingRow[]> = {}
  for (const f of findingsPerSurface ?? []) {
    const sid = f.attack_surface_id ?? '__none__'
    findingsBySurface[sid] = [...(findingsBySurface[sid] ?? []), f]
  }

  type SurfaceRow = { id: string; target_type: string }
  const typeMap: Record<string, { count: number; cleanCount: number; findingsCount: number; criticalCount: number }> = {}
  for (const s of (allSurfaces ?? []) as SurfaceRow[]) {
    const t = s.target_type ?? 'other'
    if (!typeMap[t]) typeMap[t] = { count: 0, cleanCount: 0, findingsCount: 0, criticalCount: 0 }
    typeMap[t].count++
    const sFindings = findingsBySurface[s.id] ?? []
    if (sFindings.length === 0) {
      typeMap[t].cleanCount++
    } else {
      typeMap[t].findingsCount++
      if (sFindings.some(f => f.severity === 'critical')) typeMap[t].criticalCount++
    }
  }
  const targetSummaries: TargetTypeSummary[] = Object.entries(typeMap).map(([type, counts]) => ({ type, ...counts }))
```

- [ ] **Step 5: Replace the entire JSX return**

Replace everything from `return (` to the end of the function with:

```tsx
  return (
    <div className="portal-content">

      {/* Header */}
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Compliance Dashboard
          </h1>
          <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
            {tenant?.name ?? 'Security Dashboard'} · {activeFrameworks.length} framework{activeFrameworks.length !== 1 ? 's' : ''} active
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, padding: '5px 10px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Audit trail live
          </div>
          <div style={{ fontSize: 11, color: '#42a5f5', background: 'rgba(66,165,245,0.08)', border: '1px solid rgba(66,165,245,0.2)', borderRadius: 6, padding: '5px 10px' }}>
            {dataRegion === 'africa' ? '🌍 Africa · Cape Town' : '🇪🇺 EU · Frankfurt'}
          </div>
          {surfaces && surfaces.length > 0 && (
            <LaunchScanButton
              surfaces={surfaces}
              tenantId={tenantId}
              planId={tenant?.plan ?? 'free'}
              scansThisMonth={tenant?.scans_this_month ?? 0}
              tokensThisMonth={tenant?.tokens_used_this_month ?? 0}
              canCreate={resolved['scans.create']}
            />
          )}
        </div>
      </div>

      {/* ── Hero row: Exposure gauge + KPI grid + AI Engine panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 200px', gap: 14, marginBottom: 16 }}>

        <ExposureGauge score={exposureScore} dimensions={exposureDimensions} />

        <KpiGrid tiles={[
          { label: 'Critical Findings',   value: String(criticals),               accent: '#ef4444', borderColor: 'rgba(239,68,68,0.15)',   sub: criticals > 0 ? 'Board notification required' : 'No critical issues' },
          { label: 'Total Open Findings', value: String(open),                    accent: '#f59e0b', borderColor: 'rgba(245,158,11,0.15)',   sub: `${open - criticals} non-critical open` },
          { label: 'Scans',               value: String(completedScans ?? 0),     accent: '#3b82f6', borderColor: 'rgba(59,130,246,0.15)',   sub: `${activeScans ?? 0} running · ${completedScans ?? 0} complete` },
          { label: 'Audit Events',        value: String(auditEvents ?? 0),        accent: '#22c55e', borderColor: 'rgba(34,197,94,0.15)',    sub: auditEvents ? `${signedRatio}% cryptographically signed` : 'Launch a scan to start' },
          { label: 'Target Surfaces',     value: String(surfaceCount),            accent: '#64748b', borderColor: 'rgba(100,116,139,0.15)',  sub: targetSummaries.map(t => `${t.count} ${t.type}`).join(' · ') || 'No targets yet' },
          { label: 'Inventory Assets',    value: String(inventoryTotal ?? 0),     accent: '#14b8a6', borderColor: 'rgba(20,184,166,0.15)',   sub: (inventoryUnreviewed ?? 0) > 0 ? `${inventoryUnreviewed} unreviewed` : 'All reviewed' },
        ]} />

        <AiEnginePanel
          planId={tenant?.plan ?? 'free'}
          activeModel={activeModel}
          nodeCount={nodeCount}
          dataRegion={dataRegion}
        />
      </div>

      {/* ── Compliance + right panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, marginBottom: 16 }}>

        <FrameworkAccordion
          activeFrameworks={activeFrameworks}
          scores={frameworkScores}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <TargetsCard summaries={targetSummaries} totalCount={surfaceCount} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <InventoryMiniCard
              total={inventoryTotal ?? 0}
              servers={inventoryServers ?? 0}
              services={inventoryServices ?? 0}
              unreviewed={inventoryUnreviewed ?? 0}
            />
            <SensorsMiniCard sensors={sensors ?? []} />
          </div>
        </div>
      </div>

      {/* ── Bottom row: findings + audit ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Recent findings */}
        <div className="gs au1" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
              Recent Findings
              {total > 0 && <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 6 }}>({total} total)</span>}
            </span>
            <Link href="/dashboard/findings" style={{ fontSize: 10, color: '#42a5f5' }}>View all →</Link>
          </div>
          {recentFindings && recentFindings.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Sev</th>
                  <th>CVSS</th>
                  <th>AI Model</th>
                </tr>
              </thead>
              <tbody>
                {recentFindings.map((f: any) => (
                  <tr key={f.id}>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ fontWeight: 500, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</div>
                      {f.finding_hash && <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#3b5f8a', display: 'block', marginTop: 1 }}>{f.finding_hash.slice(0, 16)}…</span>}
                    </td>
                    <td><span className={`sev-${f.severity}`} style={{ borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px' }}>{f.severity}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{f.cvss_score ?? '—'}</td>
                    <td>
                      {f.ai_model ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 3, fontSize: 9, color: '#3b82f6', padding: '2px 5px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {f.ai_model.split(' ')[0]}
                          {f.ai_confidence && <span style={{ color: '#22c55e', marginLeft: 3, fontWeight: 600 }}>{f.ai_confidence}%</span>}
                        </span>
                      ) : <span style={{ color: '#475569', fontSize: 10 }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569' }}>
              <p style={{ marginBottom: 12, fontSize: 13 }}>No findings yet — run a scan to start.</p>
              {surfaces && surfaces.length > 0
                ? <LaunchScanButton surfaces={surfaces} tenantId={tenantId} canCreate={resolved['scans.create']} />
                : <Link href="/onboarding" className="btn-p" style={{ fontSize: 12, padding: '7px 16px' }}>Add Target →</Link>}
            </div>
          )}
        </div>

        {/* Cryptographic audit trail */}
        <div className="gs au1" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Cryptographic Audit Trail</span>
            <Link href="/dashboard/audit" style={{ fontSize: 10, color: '#22c55e' }}>
              {auditSigned === auditEvents && auditEvents ? '✓ 100% signed' : `${signedRatio}% signed`} →
            </Link>
          </div>
          {recentAudit && recentAudit.length > 0 ? (
            <div>
              {recentAudit.map((log: any) => (
                <AuditRow key={log.id} log={log} />
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569' }}>
              <p style={{ fontSize: 13 }}>Audit events will appear here as you use the platform.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

// ── AuditRow helper (unchanged from original) ────────────────────────────

function AuditRow({ log }: { log: any }) {
  const actionColors: Record<string, string> = {
    'scan.queued': '#3b82f6', 'scan.started': '#42a5f5',
    'finding.discovered': '#f59e0b', 'finding.verified_fixed': '#22c55e', 'scan.completed': '#22c55e',
  }
  const color = actionColors[log.action] ?? '#64748b'
  let detail = ''
  try {
    const parsed = JSON.parse(log.detail ?? '{}')
    const { _ts, scan_id, finding_id, ...rest } = parsed
    const key = Object.keys(rest)[0]
    detail = key ? `${key}: ${String(rest[key]).slice(0, 40)}` : ''
  } catch { detail = String(log.detail ?? '').slice(0, 60) }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569', minWidth: 72, flexShrink: 0, paddingTop: 2 }}>
        {new Date(log.created_at).toISOString().slice(11, 19)}Z
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700, fontFamily: 'monospace', background: `${color}18`, border: `1px solid ${color}40`, color, whiteSpace: 'nowrap' }}>
            {log.action}
          </span>
        </div>
        {detail && <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>}
        {log.signature && <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#3b5f8a', marginTop: 2 }}>{log.signature.slice(0, 20)}…</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors. If `attack_surface_id` is not on the `findings` query type, add it to the select string — it will be typed as `string | null`.

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass, no regressions.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: rewire dashboard page to CISO Command layout with all new components"
```

---

## Task 14: Smoke Test in Browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify all zones render**

Open `http://localhost:3000/dashboard` (or the staging URL) and confirm:
- Hero row shows Exposure Gauge + 6 KPI tiles + AI Engine panel
- AI Engine panel shows correct tier badge for the tenant's plan
- Compliance section shows expandable rows for active frameworks
- Clicking a framework row expands the article table
- Collapsing and refreshing the page preserves expand state (localStorage)
- Targets card groups surfaces by type
- Inventory and Sensors mini cards show correct counts
- Recent findings table and audit trail render
- No console errors

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: dashboard redesign complete — CISO Command layout"
```

---

## Self-Review Checklist

- [x] DB migration: `node_count`, `ai_model_override`, `data_region` — Task 1
- [x] Plan tier system (Bronze/Silver/Gold/Platinum) — Task 2
- [x] Framework definitions + article score calculators for DORA, PCI-DSS, NIS2, HIPAA, ISO27001, SOC2 — Task 3
- [x] Generic scorer fallback for frameworks without tailored logic — Task 3
- [x] Weighted exposure score engine with normalisation — Task 4
- [x] All lib functions unit-tested — Tasks 2, 3, 4
- [x] KPI grid (6 tiles) — Task 5
- [x] Exposure gauge SVG + dimension breakdown — Task 6
- [x] AI Engine panel: tier, model, nodes, region, Switch/BYO — Task 7
- [x] Framework row client component with localStorage expand — Task 8
- [x] Framework accordion with empty state — Task 9
- [x] Targets card grouped by type with status chips — Task 10
- [x] Inventory + Sensors mini cards — Task 11
- [x] Sidebar tier badge — Task 12
- [x] Dashboard page fully wired with all new queries — Task 13
- [x] Non-goals documented (BYO model UI, Africa provisioning, multi-node scheduling) — see spec
