# Holistic Compliance Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-scan auto-generated compliance reports with on-demand organisational reports that aggregate findings across all targets and all scans within a user-selected period, matching DORA/PCI-DSS/NIS2 regulatory expectations.

**Architecture:** The scanner stops generating compliance reports. Instead, users click "Generate Report" in the portal, select a framework and date range, and an API route aggregates all findings and covered targets into one organisational-level report row. Existing per-scan rows are kept as `report_type = 'scan'` for backward compat; new rows are `report_type = 'organizational'`. The portal UI defaults to showing organisational reports.

**Tech Stack:** Next.js App Router (portal), Python (scanner), Supabase Postgres, `@react-pdf/renderer`, `crypto` (Node built-in)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `portal/supabase/migrations/20260506_org_compliance_reports.sql` | Create | Add org-report columns to compliance_reports |
| `scanner/engine/scanner.py` | Modify | Remove auto `_generate_compliance_reports()` call |
| `portal/lib/frameworks.ts` | Create | OWASP→control mapping (TypeScript port of scanner's frameworks.py) |
| `portal/app/api/compliance-reports/generate/route.ts` | Create | POST endpoint: aggregate findings → insert org report |
| `portal/components/GenerateReportButton.tsx` | Create | Client component: framework + period selector + generate button |
| `portal/components/ReportsTable.tsx` | Modify | Filter to org reports by default, updated empty state |
| `portal/app/dashboard/reports/page.tsx` | Modify | Pass tenant frameworks to GenerateReportButton, add it to header |
| `portal/app/dashboard/reports/[id]/page.tsx` | Modify | Show period/targets/scan-count section for org reports |
| `portal/app/api/reports/[id]/pdf/route.ts` | Modify | Render org-specific cover and chain-of-custody for org reports |

---

## Task 1: DB Migration — Add Organisational Report Columns

**Files:**
- Create: `portal/supabase/migrations/20260506_org_compliance_reports.sql`

- [ ] **Step 1: Write the migration**

```sql
-- compliance_reports: support organisational (multi-scan) reports
-- report_type: 'scan' = legacy per-scan (default), 'organizational' = new holistic
ALTER TABLE compliance_reports
  ADD COLUMN IF NOT EXISTS report_type       text NOT NULL DEFAULT 'scan',
  ADD COLUMN IF NOT EXISTS report_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS report_period_end   timestamptz,
  ADD COLUMN IF NOT EXISTS scan_ids          uuid[],
  ADD COLUMN IF NOT EXISTS scan_count        integer,
  ADD COLUMN IF NOT EXISTS targets_covered   jsonb;   -- [{id, name, url}]

-- Make scan_id nullable — org reports have no single scan
ALTER TABLE compliance_reports
  ALTER COLUMN scan_id DROP NOT NULL;

-- Index for the new default query (org reports, newest first)
CREATE INDEX IF NOT EXISTS idx_compliance_reports_org
  ON compliance_reports (tenant_id, report_type, created_at DESC);
```

- [ ] **Step 2: Run the migration in Supabase**

Go to the Supabase SQL editor for the project and run the migration above, or use the Supabase CLI:
```bash
supabase db push
```
Confirm no errors. Check that `compliance_reports` now has columns `report_type`, `report_period_start`, `report_period_end`, `scan_ids`, `scan_count`, `targets_covered`.

- [ ] **Step 3: Commit**

```bash
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal add supabase/migrations/20260506_org_compliance_reports.sql
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal commit -m "feat: add organisational compliance report columns"
```

---

## Task 2: Scanner — Remove Auto Report Generation

**Files:**
- Modify: `scanner/engine/scanner.py` (lines ~229-233)

The scanner currently calls `_generate_compliance_reports()` at the end of every scan. Remove that call. The function definition can stay but will no longer be invoked.

- [ ] **Step 1: Remove the call in `run_scan()`**

Find this block near the end of `run_scan()`:
```python
        # Generate compliance reports (one per selected framework)
        try:
            await _generate_compliance_reports(db, scan_id, tenant_id, findings)
        except Exception:
            log.exception("Scan %s: compliance report generation failed — scan result unaffected", scan_id)
```

Delete it entirely. Do not delete the `_generate_compliance_reports` function definition below — keep it as dead code for now (it can be removed in a future cleanup).

- [ ] **Step 2: Verify the scanner still runs locally**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/scanner && python3 -c "from engine.scanner import run_scan; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git -C /Users/grahamjohn/Documents/GitHub/breachr/scanner add engine/scanner.py
git -C /Users/grahamjohn/Documents/GitHub/breachr/scanner commit -m "feat: stop auto-generating per-scan compliance reports"
```

---

## Task 3: Portal — Framework Controls Library

**Files:**
- Create: `portal/lib/frameworks.ts`

This is a TypeScript port of `scanner/engine/frameworks.py`. The portal's report generation API needs it.

- [ ] **Step 1: Create `portal/lib/frameworks.ts`**

```typescript
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
```

- [ ] **Step 2: Verify it type-checks**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | head -10
```
Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal add lib/frameworks.ts
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal commit -m "feat: add TypeScript framework controls library"
```

---

## Task 4: Portal — Report Generation API Route

**Files:**
- Create: `portal/app/api/compliance-reports/generate/route.ts`

This is the core logic: aggregate findings → deduplicate → map controls → insert org report.

- [ ] **Step 1: Create the directory and route file**

```bash
mkdir -p /Users/grahamjohn/Documents/GitHub/breachr/portal/app/api/compliance-reports/generate
```

Create `portal/app/api/compliance-reports/generate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { getControls, type Framework } from '@/lib/frameworks'

const VALID_FRAMEWORKS: Framework[] = ['DORA', 'NIS2', 'PCI-DSS']
const VALID_PERIODS = [30, 90, 365]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const framework: Framework = body.framework
  const periodDays: number   = body.period_days ?? 90

  if (!VALID_FRAMEWORKS.includes(framework))
    return NextResponse.json({ error: 'Invalid framework' }, { status: 400 })
  if (!VALID_PERIODS.includes(periodDays))
    return NextResponse.json({ error: 'Invalid period_days. Use 30, 90, or 365.' }, { status: 400 })

  const tenantId      = profile.tenant_id
  const periodEnd     = new Date()
  const periodStart   = new Date(periodEnd.getTime() - periodDays * 86_400_000)
  const periodEndISO  = periodEnd.toISOString()
  const periodStartISO = periodStart.toISOString()

  // Verify tenant has this framework selected
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, compliance_frameworks')
    .eq('id', tenantId)
    .single()

  const enabledFrameworks: string[] = tenant?.compliance_frameworks ?? []
  if (!enabledFrameworks.includes(framework))
    return NextResponse.json(
      { error: `Framework ${framework} is not enabled for this tenant. Add it in Settings → Compliance.` },
      { status: 422 }
    )

  // All complete scans in the period
  const { data: scans } = await supabase
    .from('scans')
    .select('id, attack_surface_id, completed_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'complete')
    .gte('completed_at', periodStartISO)
    .lte('completed_at', periodEndISO)

  if (!scans || scans.length === 0)
    return NextResponse.json(
      { error: 'No completed scans in this period. Run at least one scan before generating a report.' },
      { status: 422 }
    )

  const scanIds        = scans.map(s => s.id)
  const surfaceIds     = [...new Set(scans.map(s => s.attack_surface_id).filter(Boolean))]

  // Covered targets
  const { data: surfaces } = await supabase
    .from('attack_surfaces')
    .select('id, name, target_url')
    .in('id', surfaceIds)

  const targetsCovered = (surfaces ?? []).map(s => ({
    id: s.id, name: s.name, url: s.target_url,
  }))

  // All findings from those scans
  const { data: rawFindings } = await supabase
    .from('findings')
    .select('title, severity, owasp_category, description, remediation, status, created_at, scan_id')
    .eq('tenant_id', tenantId)
    .in('scan_id', scanIds)

  // Deduplicate: same (title, severity) → keep latest, prefer open over remediated
  const STATUS_PRIORITY: Record<string, number> = {
    open: 0, in_progress: 1, remediated: 2, verified_fixed: 3, accepted_risk: 4, false_positive: 5,
  }
  const seen = new Map<string, (typeof rawFindings)[number]>()
  for (const f of rawFindings ?? []) {
    const key = `${f.title}|||${f.severity}`
    const existing = seen.get(key)
    if (!existing) { seen.set(key, f); continue }
    const existingPriority = STATUS_PRIORITY[existing.status] ?? 99
    const newPriority      = STATUS_PRIORITY[f.status]       ?? 99
    // Prefer more-open status; on tie prefer more recent
    if (newPriority < existingPriority ||
       (newPriority === existingPriority && f.created_at > existing.created_at)) {
      seen.set(key, f)
    }
  }

  const findings = [...seen.values()]

  // Map to framework controls and build snapshot
  const sevCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  const snapshot = findings.map(f => {
    const sev = f.severity as string
    if (sev in sevCounts) sevCounts[sev]++
    return {
      title:          f.title,
      severity:       sev,
      owasp_category: f.owasp_category ?? '',
      description:    f.description   ?? '',
      remediation:    f.remediation   ?? '',
      status:         f.status,
      controls:       getControls(f.owasp_category, framework),
    }
  })

  // SHA-256 over canonical snapshot
  const snapshotJson = JSON.stringify(snapshot.map(f => ({
    title: f.title, severity: f.severity, owasp_category: f.owasp_category,
    controls: f.controls,
  })).sort((a, b) => a.title.localeCompare(b.title)))
  const sha256Hash = createHash('sha256').update(snapshotJson).digest('hex')

  const now   = periodEnd.toISOString()
  const title = `${framework} Compliance Report — ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`

  // Insert via admin client (service role) to bypass any RLS gaps
  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: report, error } = await admin
    .from('compliance_reports')
    .insert({
      tenant_id:           tenantId,
      scan_id:             null,
      framework,
      title,
      status:              'ready',
      report_type:         'organizational',
      report_period_start: periodStartISO,
      report_period_end:   periodEndISO,
      scan_ids:            scanIds,
      scan_count:          scanIds.length,
      targets_covered:     targetsCovered,
      findings_snapshot:   snapshot,
      framework_summary:   sevCounts,
      sha256_hash:         sha256Hash,
      generated_at:        now,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to insert compliance report', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reportId: report.id })
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | head -10
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal add app/api/compliance-reports/
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal commit -m "feat: add organisational compliance report generation API"
```

---

## Task 5: Portal — GenerateReportButton Component

**Files:**
- Create: `portal/components/GenerateReportButton.tsx`

Client component: framework selector + period selector + generate button. On success, redirects to the new report.

- [ ] **Step 1: Create `portal/components/GenerateReportButton.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Framework = 'DORA' | 'NIS2' | 'PCI-DSS'

const PERIOD_OPTIONS = [
  { label: 'Last 30 days',  value: 30 },
  { label: 'Last 90 days',  value: 90 },
  { label: 'Last 12 months', value: 365 },
]

const FRAMEWORK_COLOURS: Record<Framework, string> = {
  'DORA':    '#1976d2',
  'NIS2':    '#7b1fa2',
  'PCI-DSS': '#c62828',
}

export default function GenerateReportButton({
  enabledFrameworks,
}: {
  enabledFrameworks: string[]
}) {
  const router = useRouter()
  const available = (enabledFrameworks as Framework[]).filter(f =>
    ['DORA', 'NIS2', 'PCI-DSS'].includes(f)
  )

  const [open,       setOpen]       = useState(false)
  const [framework,  setFramework]  = useState<Framework>(available[0] ?? 'DORA')
  const [periodDays, setPeriodDays] = useState(90)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/compliance-reports/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ framework, period_days: periodDays }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      setOpen(false)
      router.push(`/dashboard/reports/${body.reportId}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  if (available.length === 0) {
    return (
      <span style={{ fontSize: 12, color: '#475569' }}>
        No frameworks selected — add them in{' '}
        <a href="/dashboard/settings" style={{ color: '#42a5f5' }}>Settings</a>
      </span>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px',
          borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: '#1976d2', color: '#fff', border: 'none',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Generate Report
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          {/* Dropdown */}
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50,
            width: 280, background: '#0d1428', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: 20, boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>
              Generate Compliance Report
            </p>

            {/* Framework selector */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Framework
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {available.map(fw => (
                  <button
                    key={fw}
                    onClick={() => setFramework(fw)}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                      cursor: 'pointer', border: 'none',
                      background: framework === fw
                        ? `${FRAMEWORK_COLOURS[fw]}30`
                        : 'rgba(255,255,255,0.05)',
                      color: framework === fw ? FRAMEWORK_COLOURS[fw] : '#64748b',
                      outline: framework === fw ? `1px solid ${FRAMEWORK_COLOURS[fw]}80` : 'none',
                    }}
                  >
                    {fw}
                  </button>
                ))}
              </div>
            </div>

            {/* Period selector */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Reporting Period
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriodDays(opt.value)}
                    style={{
                      textAlign: 'left', fontSize: 12, padding: '6px 10px', borderRadius: 5,
                      cursor: 'pointer', border: 'none',
                      background: periodDays === opt.value
                        ? 'rgba(25,118,210,0.15)'
                        : 'rgba(255,255,255,0.03)',
                      color: periodDays === opt.value ? '#42a5f5' : '#94a3b8',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 12 }}>{error}</p>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{
                width: '100%', padding: '8px 0', borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer', border: 'none',
                background: loading ? 'rgba(25,118,210,0.5)' : '#1976d2',
                color: '#fff',
              }}
            >
              {loading ? 'Generating…' : `Generate ${framework} Report`}
            </button>

            <p style={{ fontSize: 10, color: '#475569', marginTop: 10, textAlign: 'center' }}>
              Covers all completed scans in the selected period
            </p>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | head -10
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal add components/GenerateReportButton.tsx
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal commit -m "feat: add GenerateReportButton component"
```

---

## Task 6: Portal — Update ReportsTable

**Files:**
- Modify: `portal/components/ReportsTable.tsx`

Add a `reportType` filter toggle (defaults to 'organizational'). Update the empty-state copy to remove the now-incorrect "auto-generated" message. Add a "Type" column showing the report type pill.

- [ ] **Step 1: Add `reportType` prop and update the interface**

In `portal/components/ReportsTable.tsx`, update the `Props` interface:

```typescript
interface Props {
  reports:         any[]
  filteredCount:   number
  totalCount:      number
  page:            number
  pageSize:        number
  frameworkCounts: Record<string, number>
  orgCount:        number   // add this
}
```

Update the export signature:
```typescript
export default function ReportsTable({
  reports, filteredCount, totalCount, page, pageSize, frameworkCounts, orgCount,
}: Props) {
```

- [ ] **Step 2: Add report type toggle to the filter bar**

After the closing `</div>` of the date presets block (before the "Clear" button), add:

```typescript
        {/* Report type toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['organizational', 'scan', ''] as const).map(t => {
            const label = t === 'organizational' ? 'Org reports' : t === 'scan' ? 'Scan reports' : 'All'
            const active = (searchParams.get('type') ?? 'organizational') === t
            return (
              <button
                key={t}
                onClick={() => setParam('type', t)}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                  background: active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#22c55e' : '#64748b',
                  border: `1px solid ${active ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
```

- [ ] **Step 3: Update the empty state copy**

Replace the existing empty-state `<div>` (when `!isFiltered`) with:

```typescript
              <>
                <p style={{ fontSize: 15, marginBottom: 8 }}>No compliance reports yet</p>
                <p style={{ fontSize: 13, color: '#64748b' }}>
                  Run a scan first, then use the Generate Report button to create an organisational compliance report.
                </p>
                {orgCount === 0 && totalCount > 0 && (
                  <p style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>
                    {totalCount} legacy scan-level report{totalCount !== 1 ? 's' : ''} exist — switch to "All" to view them.
                  </p>
                )}
              </>
```

- [ ] **Step 4: Add report_type pill to the table rows**

In the table `<thead>`, add a `<th>Type</th>` after `<th>Report</th>`. In the `<tbody>` rows, add after the report title cell:

```typescript
                  <td>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                      background: r.report_type === 'organizational' ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
                      color: r.report_type === 'organizational' ? '#22c55e' : '#64748b',
                      border: `1px solid ${r.report_type === 'organizational' ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)'}`,
                    }}>
                      {r.report_type === 'organizational' ? 'Org' : 'Scan'}
                    </span>
                  </td>
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | head -10
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal add components/ReportsTable.tsx
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal commit -m "feat: update ReportsTable for org/scan type filtering"
```

---

## Task 7: Portal — Update Reports List Page

**Files:**
- Modify: `portal/app/dashboard/reports/page.tsx`

Add the `GenerateReportButton` to the page header. Pass tenant's `compliance_frameworks` to it. Apply the `type` filter to the DB query (default: `organizational`). Pass `orgCount` to `ReportsTable`.

- [ ] **Step 1: Add imports**

At the top of `portal/app/dashboard/reports/page.tsx`, add:

```typescript
import GenerateReportButton from '@/components/GenerateReportButton'
```

- [ ] **Step 2: Fetch tenant frameworks and org count**

In the `Promise.all` block that already fetches reports, add two more queries:

```typescript
  const [
    { data: reports, count: filteredCount },
    { count: totalCount },
    { data: frameworkRows },
    { count: orgCount },
    { data: tenantRow },
  ] = await Promise.all([
    // ... existing queries unchanged ...
    applyFilters(
      supabase
        .from('compliance_reports')
        .select('id, framework, title, status, framework_summary, generated_at, created_at, scan_id, report_type', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('report_type', typeFilter)          // see step 3
    )
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),

    supabase
      .from('compliance_reports')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),

    supabase
      .from('compliance_reports')
      .select('framework')
      .eq('tenant_id', tenantId),

    // new: count of org reports
    supabase
      .from('compliance_reports')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('report_type', 'organizational'),

    // new: tenant frameworks
    supabase
      .from('tenants')
      .select('compliance_frameworks')
      .eq('id', tenantId)
      .single(),
  ])
```

- [ ] **Step 3: Parse the `type` filter param and apply it**

Add to the existing param parsing block (after `const page = ...`):

```typescript
  const typeFilter = params.type ?? 'organizational'
```

Update `applyFilters` to also filter by type when set:

```typescript
  function applyFilters(q: any) {
    if (frameworkFilter.length) q = q.in('framework', frameworkFilter)
    if (dateCutoff)             q = q.gte('created_at', dateCutoff)
    if (typeFilter)             q = q.eq('report_type', typeFilter)
    return q
  }
```

- [ ] **Step 4: Add GenerateReportButton to the header and pass orgCount**

Replace the existing header `<div>` content:

```typescript
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>REPORTS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{orgCount ?? 0} organisational reports · {totalCount ?? 0} total</p>
        </div>
        <GenerateReportButton enabledFrameworks={tenantRow?.data?.compliance_frameworks ?? []} />
      </div>
```

Update the `<ReportsTable>` call to pass `orgCount`:

```typescript
        <ReportsTable
          reports={(reports ?? []) as any[]}
          filteredCount={filteredCount ?? 0}
          totalCount={totalCount ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          frameworkCounts={frameworkCounts}
          orgCount={orgCount ?? 0}
        />
```

- [ ] **Step 5: Type-check and build**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | head -10
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal add app/dashboard/reports/page.tsx
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal commit -m "feat: add generate report button and org report filtering to reports page"
```

---

## Task 8: Portal — Update Report Detail Page

**Files:**
- Modify: `portal/app/dashboard/reports/[id]/page.tsx`

For `report_type === 'organizational'` reports, show a "Scope" section (period covered, targets assessed, scans included) instead of the Scan ID. For legacy scan reports, keep existing display.

- [ ] **Step 1: Add scope section for org reports**

In `portal/app/dashboard/reports/[id]/page.tsx`, after the existing summary card `</div>` and before the findings table, add:

```typescript
      {/* Scope section — org reports only */}
      {report.report_type === 'organizational' && (
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{
            padding: 16, borderRadius: 8,
            background: 'rgba(25,118,210,0.06)', border: '1px solid rgba(25,118,210,0.15)',
            marginBottom: 24,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Report Scope
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Reporting Period</p>
                <p style={{ fontSize: 12, color: '#e2e8f0' }}>
                  {report.report_period_start
                    ? new Date(report.report_period_start).toLocaleDateString('en-GB')
                    : '—'}
                  {' → '}
                  {report.report_period_end
                    ? new Date(report.report_period_end).toLocaleDateString('en-GB')
                    : '—'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Scans Included</p>
                <p style={{ fontSize: 12, color: '#e2e8f0' }}>{report.scan_count ?? (report.scan_ids?.length ?? '—')}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Targets Assessed</p>
                <p style={{ fontSize: 12, color: '#e2e8f0' }}>{(report.targets_covered ?? []).length}</p>
              </div>
            </div>
            {(report.targets_covered ?? []).length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>Covered Targets</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(report.targets_covered as any[]).map((t: any) => (
                    <span key={t.id} style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 4,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      color: '#94a3b8',
                    }}>
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
```

- [ ] **Step 2: Update header subline**

Replace the existing `<p>` that shows `Generated … · Scan ID: …`:

```typescript
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {report.report_type === 'organizational'
              ? `Organisational report · generated ${report.generated_at
                  ? new Date(report.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—'}`
              : `Generated ${report.generated_at
                  ? new Date(report.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—'} · Scan ID: ${report.scan_id?.slice(0, 8) ?? '—'}`}
          </p>
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | head -10
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal add app/dashboard/reports/[id]/page.tsx
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal commit -m "feat: show org report scope (period, targets, scans) in report detail"
```

---

## Task 9: Portal — Update PDF Generation for Org Reports

**Files:**
- Modify: `portal/app/api/reports/[id]/pdf/route.ts`

The `buildPDF` function currently shows `Scan ID` in the chain-of-custody section. For org reports, replace this with period, targets covered, and scan count.

- [ ] **Step 1: Update the chain-of-custody block in `buildPDF`**

In `portal/app/api/reports/[id]/pdf/route.ts`, find the chain of custody `h(View, { style: s.hashBox }, ...)` block. Replace its inner content with:

```typescript
          h(Text, { style: s.hashLabel }, 'FINDINGS SNAPSHOT SHA-256 (computed at report generation over deduplicated findings)'),
          h(Text, { style: s.hashValue }, report.sha256_hash ?? '—'),
          h(Text, { style: { ...s.hashLabel, marginTop: 8 } }, 'REPORT ID'),
          h(Text, { style: s.hashValue }, report.id),
          // Org reports: show period + targets; scan reports: show scan ID
          ...(report.report_type === 'organizational'
            ? [
                h(Text, { style: { ...s.hashLabel, marginTop: 8 } }, 'REPORTING PERIOD'),
                h(Text, { style: s.hashValue },
                  `${report.report_period_start ? report.report_period_start.slice(0, 10) : '?'} → ${report.report_period_end ? report.report_period_end.slice(0, 10) : '?'}`),
                h(Text, { style: { ...s.hashLabel, marginTop: 8 } }, 'SCANS INCLUDED'),
                h(Text, { style: s.hashValue }, String(report.scan_count ?? (report.scan_ids?.length ?? '—'))),
                h(Text, { style: { ...s.hashLabel, marginTop: 8 } }, 'TARGETS ASSESSED'),
                h(Text, { style: s.hashValue },
                  (report.targets_covered as any[] ?? []).map((t: any) => t.name).join(', ') || '—'),
              ]
            : [
                h(Text, { style: { ...s.hashLabel, marginTop: 8 } }, 'SCAN ID'),
                h(Text, { style: s.hashValue }, report.scan_id ?? '—'),
              ]
          ),
          h(Text, { style: s.hashNote },
            'The findings snapshot SHA-256 above was computed at report generation and stored in the Breachr audit log. ' +
            'A separate SHA-256 of this PDF is recorded in the Breachr database upon download. ' +
            'CONFIDENTIAL — REGULATORY USE ONLY'),
```

- [ ] **Step 2: Update the cover subtitle line**

Find `h(Text, { style: s.sub }, 'Compliance Report  ·  AI-Powered Security Intelligence')` and update to show report type:

```typescript
          h(Text, { style: s.sub },
            `${report.report_type === 'organizational' ? 'Organisational Compliance Report' : 'Scan-Level Technical Report'}  ·  AI-Powered Security Intelligence`),
```

- [ ] **Step 3: Type-check and build**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | head -5
npx next build 2>&1 | grep -E "error|Error|api/reports|api/compliance"
```
Expected: no type errors. Build output shows both `/api/reports/[id]/pdf` and `/api/compliance-reports/generate`.

- [ ] **Step 4: Commit**

```bash
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal add app/api/reports/
git -C /Users/grahamjohn/Documents/GitHub/breachr/portal commit -m "feat: update PDF for org reports (period, targets, scan count in chain of custody)"
```

---

## Task 10: Deploy

- [ ] **Step 1: Deploy scanner to Railway**

```bash
git -C /Users/grahamjohn/Documents/GitHub/breachr/scanner push origin main
```
Railway auto-deploys on push. Confirm the new deployment starts without errors in the Railway dashboard.

- [ ] **Step 2: Deploy portal to Vercel (production)**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && vercel --prod
```

- [ ] **Step 3: Smoke test**

1. Log in to `https://breachr-portal.vercel.app`
2. Go to **Reports** — confirm the page shows "Organisational reports" toggle active, empty state updated
3. Click **Generate Report** — select DORA, Last 90 days — confirm it generates and redirects to the report
4. Open the report — confirm scope section shows period, targets, scan count
5. Download PDF (Summary) — confirm PDF shows "Organisational Compliance Report" and period in chain of custody
6. Run a scan — confirm **no new compliance report row** is auto-created in Supabase

---

## Self-Review Notes

- **Spec coverage:** All 9 architectural changes covered (scanner stop, DB migration, TS framework lib, generate API, button component, table update, list page, detail page, PDF update). ✓
- **Backwards compat:** Existing scan-level reports preserved with `report_type = 'scan'`. ✓
- **Type consistency:** `Framework` type defined in `lib/frameworks.ts`, imported in generate route. `orgCount` added to both `ReportsTable` Props and the page call site. ✓
- **No placeholders:** All code blocks are complete. ✓
- **DB migration must be run before portal deploy** — Task 1 step 2 covers this. ✓
