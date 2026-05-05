# Compliance Frameworks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DORA / NIS2 / PCI-DSS framework selection to onboarding and auto-generate tamper-evident frozen compliance reports after each completed scan.

**Architecture:** Framework selection is stored on the `tenants` table (`compliance_frameworks text[]`). On scan completion the scanner generates one `compliance_reports` row per selected framework, each containing a frozen `findings_snapshot` jsonb with OWASP→control tags and a `sha256_hash` for tamper-evidence. The portal renders reports in-app; a new report detail page logs a `report.viewed` audit event via the existing HMAC-chained audit trail.

**Tech Stack:** Python (scanner), Next.js 15 App Router (portal), Supabase (PostgreSQL + RLS), TypeScript

---

## Discovered constraints (read before implementing)

- `compliance_reports.framework` has a CHECK constraint: only `'DORA'`, `'NIS2'`, `'PCI-DSS'` are valid
- `compliance_reports.status` has a CHECK constraint: only `'generating'` and `'ready'` are valid
- `compliance_reports` does **not** yet have `findings_snapshot` or `framework_summary` columns — Task 1 adds them
- `tenants.compliance_frameworks` column already exists — no schema change needed there
- `compliance_reports.storage_path` is the PDF path column (not `report_url` as the old reports page assumed)
- `compliance_reports.sha256_hash` exists — use it for DORA tamper-evidence

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| Supabase SQL editor | Run migration | Add columns + RLS to compliance_reports |
| `app/api/audit/log/route.ts` | Modify | Add `report.viewed` to VALID_ACTIONS |
| `components/AuditLogger.tsx` | Create | Client component: fires audit log on mount |
| `scanner/engine/frameworks.py` | Create | OWASP→framework control mapping + industry presets |
| `scanner/engine/scanner.py` | Modify | Call `_generate_compliance_reports` after scan complete |
| `app/dashboard/onboarding/page.tsx` | Modify | Add Step 3 framework selection (4-step flow) |
| `app/dashboard/reports/page.tsx` | Modify | Updated list: framework badge, severity summary, View button |
| `app/dashboard/reports/[id]/page.tsx` | Create | Report detail: header, summary card, findings table, audit log |

---

## Task 1: DB Migration — Add columns and RLS to compliance_reports

**Files:** Run SQL in Supabase SQL editor (Dashboard → SQL Editor)

- [ ] **Step 1: Run the migration**

```sql
-- Add missing columns to compliance_reports
ALTER TABLE compliance_reports
  ADD COLUMN IF NOT EXISTS findings_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS framework_summary jsonb;

-- Enable RLS (idempotent)
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy: users can only see their tenant's reports
DROP POLICY IF EXISTS "tenant_isolation" ON compliance_reports;
CREATE POLICY "tenant_isolation" ON compliance_reports
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );
```

- [ ] **Step 2: Verify**

Run in SQL editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'compliance_reports'
ORDER BY ordinal_position;
```

Expected: `findings_snapshot` and `framework_summary` both appear with `data_type = 'jsonb'`.

Run:
```sql
SELECT polname FROM pg_policies WHERE tablename = 'compliance_reports';
```

Expected: `tenant_isolation` appears.

- [ ] **Step 3: Commit note**

No code to commit — SQL migration applied directly to Supabase. Add a comment in the next commit: `# DB migration applied: compliance_reports findings_snapshot, framework_summary, RLS`.

---

## Task 2: Audit log — add report.viewed action

**Files:**
- Modify: `app/api/audit/log/route.ts`

- [ ] **Step 1: Add action to VALID_ACTIONS**

In `app/api/audit/log/route.ts`, change line:
```typescript
const VALID_ACTIONS = ['scan.queued', 'scan.started', 'finding.discovered', 'finding.verified_fixed', 'scan.completed'] as const
```
to:
```typescript
const VALID_ACTIONS = ['scan.queued', 'scan.started', 'finding.discovered', 'finding.verified_fixed', 'scan.completed', 'report.viewed'] as const
```

- [ ] **Step 2: Verify the route still compiles**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
npx tsc --noEmit 2>&1 | grep "audit"
```

Expected: no errors mentioning audit/log/route.ts

- [ ] **Step 3: Commit**

```bash
git add app/api/audit/log/route.ts
git commit -m "feat: add report.viewed to audit VALID_ACTIONS"
```

---

## Task 3: AuditLogger client component

**Files:**
- Create: `components/AuditLogger.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/AuditLogger.tsx
'use client'

import { useEffect } from 'react'

interface Props {
  action: string
  detail: Record<string, unknown>
}

export default function AuditLogger({ action, detail }: Props) {
  useEffect(() => {
    fetch('/api/audit/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, detail }),
    }).catch(() => {
      // Audit failures must never break the page
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
npx tsc --noEmit 2>&1 | grep "AuditLogger"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AuditLogger.tsx
git commit -m "feat: add AuditLogger client component for server-page audit events"
```

---

## Task 4: Scanner — frameworks.py

**Files:**
- Create: `scanner/engine/frameworks.py`

- [ ] **Step 1: Create the file**

```python
# scanner/engine/frameworks.py
"""
OWASP Top 10 2021 → compliance framework control mapping.
Framework values must match compliance_reports.framework CHECK constraint:
  'DORA', 'NIS2', 'PCI-DSS'
"""
from __future__ import annotations
import re

FRAMEWORK_CONTROLS: dict[str, dict[str, list[str]]] = {
    'DORA': {
        'A01': ['Art.9'],
        'A02': ['Art.9'],
        'A03': ['Art.9'],
        'A04': ['Art.9'],
        'A05': ['Art.9'],
        'A06': ['Art.28'],
        'A07': ['Art.9'],
        'A08': ['Art.9'],
        'A09': ['Art.13'],
        'A10': ['Art.9'],
        '_default': ['Art.9'],
    },
    'NIS2': {
        'A01': ['Art.21(i)', 'Art.21(j)'],
        'A02': ['Art.21(h)'],
        'A03': ['Art.21(e)'],
        'A04': ['Art.21(e)'],
        'A05': ['Art.21(a)'],
        'A06': ['Art.21(d)'],
        'A07': ['Art.21(i)', 'Art.21(j)'],
        'A08': ['Art.21(d)'],
        'A09': ['Art.21(b)'],
        'A10': ['Art.21(e)'],
        '_default': ['Art.21(a)'],
    },
    'PCI-DSS': {
        'A01': ['Req 7', 'Req 8'],
        'A02': ['Req 3', 'Req 4'],
        'A03': ['Req 6'],
        'A04': ['Req 6'],
        'A05': ['Req 2'],
        'A06': ['Req 6'],
        'A07': ['Req 8'],
        'A08': ['Req 6'],
        'A09': ['Req 10'],
        'A10': ['Req 6'],
        '_default': ['Req 6'],
    },
}

# Industry → pre-selected frameworks for onboarding
# Values must match the CHECK constraint on compliance_reports.framework
INDUSTRY_FRAMEWORKS: dict[str, list[str]] = {
    'banking':    ['DORA', 'NIS2', 'PCI-DSS'],
    'insurance':  ['DORA', 'NIS2'],
    'payments':   ['DORA', 'NIS2', 'PCI-DSS'],
    'healthtech': ['NIS2'],
    'energy':     ['NIS2'],
    'other':      [],
}


def get_controls(owasp_category: str | None, framework: str) -> list[str]:
    """
    Extract the A01-A10 prefix from an OWASP category string and return
    the matching framework controls.

    Claude returns owasp_category as e.g. 'A05:2021 – Security Misconfiguration'.
    We extract the two-digit prefix and look it up in FRAMEWORK_CONTROLS.
    Unknown categories fall back to the _default entry.
    """
    mapping = FRAMEWORK_CONTROLS.get(framework, {})
    m = re.search(r'A(\d{2})', owasp_category or '')
    if m:
        key = f'A{m.group(1)}'
        if key in mapping:
            return mapping[key]
    return mapping.get('_default', [])
```

- [ ] **Step 2: Smoke test locally**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/scanner
python3 -c "
from engine.frameworks import get_controls, INDUSTRY_FRAMEWORKS
assert get_controls('A05:2021 – Security Misconfiguration', 'DORA') == ['Art.9']
assert get_controls('A06:2021 – Vulnerable Components', 'NIS2') == ['Art.21(d)']
assert get_controls('A02:2021 – Cryptographic Failures', 'PCI-DSS') == ['Req 3', 'Req 4']
assert get_controls('Unknown category', 'DORA') == ['Art.9']
assert get_controls(None, 'NIS2') == ['Art.21(a)']
assert INDUSTRY_FRAMEWORKS['banking'] == ['DORA', 'NIS2', 'PCI-DSS']
assert INDUSTRY_FRAMEWORKS['healthtech'] == ['NIS2']
print('All assertions passed')
"
```

Expected output: `All assertions passed`

- [ ] **Step 3: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/scanner
git add engine/frameworks.py
git commit -m "feat: OWASP→framework control mapping for DORA, NIS2, PCI-DSS"
```

---

## Task 5: Scanner — generate compliance reports after scan completion

**Files:**
- Modify: `scanner/engine/scanner.py`

- [ ] **Step 1: Add the _generate_compliance_reports function**

Add this function to `scanner/engine/scanner.py` after the `_fail` function (end of file):

```python
async def _generate_compliance_reports(
    db: Client,
    scan_id: str,
    tenant_id: str,
    findings: list[dict],
) -> None:
    """
    Generate one compliance_reports row per framework the tenant has selected.
    Each row contains a frozen findings_snapshot with OWASP→control tags
    and a sha256_hash for DORA tamper-evidence.
    Called after scan status is set to 'complete'. Failures are logged but
    never propagate — a report failure must not retroactively fail a scan.
    """
    import hashlib
    import json as _json
    from engine.frameworks import FRAMEWORK_CONTROLS, get_controls

    tenant_result = db.table("tenants").select("compliance_frameworks").eq("id", tenant_id).single().execute()
    frameworks: list[str] = (tenant_result.data or {}).get("compliance_frameworks") or []

    if not frameworks:
        log.info("Scan %s: no compliance frameworks on tenant — skipping report generation", scan_id)
        return

    now = datetime.now(timezone.utc).isoformat()

    for framework in frameworks:
        if framework not in FRAMEWORK_CONTROLS:
            log.warning("Scan %s: unknown framework '%s' — skipping", scan_id, framework)
            continue

        sev_counts: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        snapshot: list[dict] = []

        for f in findings:
            sev = f.get("severity", "low")
            if sev in sev_counts:
                sev_counts[sev] += 1
            snapshot.append({
                "title":          f.get("title", ""),
                "severity":       sev,
                "owasp_category": f.get("owasp_category", ""),
                "description":    f.get("description", ""),
                "remediation":    f.get("remediation", ""),
                "controls":       get_controls(f.get("owasp_category"), framework),
            })

        # SHA-256 of canonical snapshot JSON for DORA tamper-evidence
        snapshot_json = _json.dumps(snapshot, sort_keys=True, ensure_ascii=True)
        sha256 = hashlib.sha256(snapshot_json.encode("utf-8")).hexdigest()

        title = f"{framework} Compliance Report — {now[:10]}"

        db.table("compliance_reports").insert({
            "tenant_id":         tenant_id,
            "scan_id":           scan_id,
            "framework":         framework,
            "title":             title,
            "status":            "ready",
            "findings_snapshot": snapshot,
            "framework_summary": sev_counts,
            "sha256_hash":       sha256,
            "generated_at":      now,
        }).execute()

        log.info("Scan %s: generated %s compliance report (%d findings, sha256=%s…)",
                 scan_id, framework, len(findings), sha256[:12])
```

- [ ] **Step 2: Call _generate_compliance_reports in run_scan**

In `scanner/engine/scanner.py`, find the block after `increment_tenant_usage` RPC call (around line 173). Add the compliance report generation call:

```python
        # Generate compliance reports (one per selected framework)
        try:
            await _generate_compliance_reports(db, scan_id, tenant_id, findings)
        except Exception:
            log.exception("Scan %s: compliance report generation failed — scan result unaffected", scan_id)
```

The full completion block should read (with the new lines added after the RPC try/except):

```python
        # Atomically increment tenant's monthly scan count + token usage
        try:
            db.rpc("increment_tenant_usage", {
                "p_tenant_id": tenant_id,
                "p_scan_delta": 1,
                "p_token_delta": tokens_input + tokens_output,
            }).execute()
        except Exception:
            log.warning("Could not update tenant usage for %s", tenant_id)

        # Generate compliance reports (one per selected framework)
        try:
            await _generate_compliance_reports(db, scan_id, tenant_id, findings)
        except Exception:
            log.exception("Scan %s: compliance report generation failed — scan result unaffected", scan_id)

        log.info("Scan %s complete — %d/%d findings inserted", scan_id, inserted, len(findings))
```

- [ ] **Step 3: Verify imports — datetime and timezone are already imported**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/scanner
head -10 engine/scanner.py
```

Expected: `from datetime import datetime, timezone` is present on line 5.

- [ ] **Step 4: Smoke test locally (no scan needed)**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/scanner
python3 -c "
import asyncio
from engine.scanner import _generate_compliance_reports
print('Import OK — _generate_compliance_reports is defined')
"
```

Expected: `Import OK — _generate_compliance_reports is defined`

- [ ] **Step 5: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/scanner
git add engine/scanner.py
git commit -m "feat: auto-generate compliance reports after scan completion

Generates one compliance_reports row per tenant framework (DORA/NIS2/PCI-DSS).
Each row contains a frozen findings_snapshot with OWASP→control tags and a
sha256_hash for DORA tamper-evidence. Failures are isolated — scan stays complete."
```

- [ ] **Step 6: Push to GitHub (triggers Railway redeploy)**

```bash
git push origin main
```

---

## Task 6: Onboarding — framework selection step

**Files:**
- Modify: `app/dashboard/onboarding/page.tsx`

- [ ] **Step 1: Add type and framework constants**

At the top of `app/dashboard/onboarding/page.tsx`, change `type Step = 1 | 2 | 3` to:

```typescript
type Step = 1 | 2 | 3 | 4

const ALL_FRAMEWORKS = ['DORA', 'NIS2', 'PCI-DSS'] as const
type Framework = typeof ALL_FRAMEWORKS[number]

const FRAMEWORK_LABELS: Record<Framework, { name: string; description: string }> = {
  'DORA':    { name: 'DORA', description: 'EU Digital Operational Resilience Act — mandatory for financial entities operating in the EU.' },
  'NIS2':    { name: 'NIS2', description: 'EU Network & Information Security Directive — applies to essential and important sector entities.' },
  'PCI-DSS': { name: 'PCI-DSS', description: 'Payment Card Industry Data Security Standard — required if you process, store or transmit card data.' },
}

const INDUSTRY_FRAMEWORKS: Record<string, Framework[]> = {
  banking:    ['DORA', 'NIS2', 'PCI-DSS'],
  insurance:  ['DORA', 'NIS2'],
  payments:   ['DORA', 'NIS2', 'PCI-DSS'],
  healthtech: ['NIS2'],
  energy:     ['NIS2'],
  other:      [],
}
```

- [ ] **Step 2: Add framework state**

Inside the `OnboardingPage` component, after `const [companySize, setCompanySize] = useState('')`, add:

```typescript
// Step 3: compliance frameworks
const [selectedFrameworks, setSelectedFrameworks] = useState<Framework[]>([])
```

- [ ] **Step 3: Add handleStep2 to set frameworks before moving to step 3**

The existing `handleStep2` calls `setStep(3)`. Change it to `setStep(3)` and pre-populate frameworks based on the saved industry:

Change the last lines of `handleStep2`:
```typescript
    if (error) { setError(error.message); setLoading(false); return }
    // Pre-select frameworks based on industry before showing step 3
    setSelectedFrameworks(INDUSTRY_FRAMEWORKS[industry] ?? [])
    setStep(3)
    setLoading(false)
```

- [ ] **Step 4: Add handleStep3 function**

Add this function after `handleStep2`:

```typescript
  async function handleStep3(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
    if (!profile) { setError('Profile not found'); setLoading(false); return }

    const { error } = await supabase
      .from('tenants')
      .update({ compliance_frameworks: selectedFrameworks })
      .eq('id', profile.tenant_id)

    if (error) { setError(error.message); setLoading(false); return }
    setStep(4)
    setLoading(false)
  }

  function toggleFramework(fw: Framework) {
    setSelectedFrameworks(prev =>
      prev.includes(fw) ? prev.filter(f => f !== fw) : [...prev, fw]
    )
  }
```

- [ ] **Step 5: Update handleFinish to set step 4 → dashboard**

`handleFinish` stays the same — it already sets `onboarding_complete: true` and redirects. No changes needed.

- [ ] **Step 6: Update step dots to 4**

Change:
```typescript
{([1, 2, 3] as Step[]).map(s => (
```
to:
```typescript
{([1, 2, 3, 4] as Step[]).map(s => (
```

- [ ] **Step 7: Add step 3 JSX and update step 3 → step 4**

Change the existing `{step === 3 && (` block (the "YOU'RE ALL SET" block) to render for `step === 4`. Then add a new `{step === 3 && (` block before it:

```typescript
        {step === 3 && (
          <>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 6, letterSpacing: '0.05em' }}>
              SELECT COMPLIANCE FRAMEWORKS
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
              We&apos;ve recommended frameworks based on your industry. Adjust as needed.
            </p>

            <form onSubmit={handleStep3}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {ALL_FRAMEWORKS.map(fw => {
                  const selected = selectedFrameworks.includes(fw)
                  return (
                    <button
                      key={fw}
                      type="button"
                      onClick={() => toggleFramework(fw)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16,
                        background: selected ? 'rgba(25,118,210,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${selected ? 'rgba(25,118,210,0.5)' : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
                        background: selected ? '#1976d2' : 'transparent',
                        border: `2px solid ${selected ? '#1976d2' : '#475569'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{FRAMEWORK_LABELS[fw].name}</p>
                        <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{FRAMEWORK_LABELS[fw].description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>{error}</p>}
              <button type="submit" className="btn-p" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Saving…' : 'Continue →'}
              </button>
            </form>
          </>
        )}

        {step === 4 && (
```

Also change the closing of the old step 3 block: find `{step === 3 && (` (the YOU'RE ALL SET block) and change it to `{step === 4 && (`.

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
npx tsc --noEmit 2>&1 | grep "onboarding"
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/dashboard/onboarding/page.tsx
git commit -m "feat: add compliance framework selection to onboarding (step 3 of 4)

Pre-selects DORA/NIS2/PCI-DSS based on industry. User can adjust.
Saves to tenants.compliance_frameworks. You're All Set moves to step 4."
```

---

## Task 7: Update reports list page

**Files:**
- Modify: `app/dashboard/reports/page.tsx`

- [ ] **Step 1: Replace the file content**

```typescript
// app/dashboard/reports/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const FRAMEWORK_COLOURS: Record<string, string> = {
  'DORA':    '#1976d2',
  'NIS2':    '#7b1fa2',
  'PCI-DSS': '#c62828',
}

function SeveritySummary({ summary }: { summary: Record<string, number> | null }) {
  if (!summary) return <span style={{ color: '#475569' }}>—</span>
  const parts: string[] = []
  if (summary.critical > 0) parts.push(`${summary.critical} critical`)
  if (summary.high > 0) parts.push(`${summary.high} high`)
  if (summary.medium > 0) parts.push(`${summary.medium} medium`)
  if (summary.low > 0) parts.push(`${summary.low} low`)
  if (parts.length === 0) return <span style={{ color: '#22c55e', fontSize: 12 }}>No findings</span>
  const hasGaps = (summary.critical ?? 0) + (summary.high ?? 0) > 0
  return (
    <span style={{ fontSize: 12, color: hasGaps ? '#ef4444' : '#f59e0b' }}>
      {parts.join(' · ')}
    </span>
  )
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: reports } = await supabase
    .from('compliance_reports')
    .select('id, framework, title, status, framework_summary, generated_at, created_at, scan_id')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>REPORTS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Compliance and audit reports</p>
        </div>
      </div>

      <div className="gs au1" style={{ padding: 24 }}>
        {reports && reports.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Framework</th>
                <th>Findings</th>
                <th>Generated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r: any) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 13, color: '#e2e8f0' }}>
                    {r.title ?? `Report ${r.id.slice(0, 8)}`}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                      padding: '2px 8px', borderRadius: 4,
                      background: `${FRAMEWORK_COLOURS[r.framework] ?? '#334155'}22`,
                      color: FRAMEWORK_COLOURS[r.framework] ?? '#94a3b8',
                      border: `1px solid ${FRAMEWORK_COLOURS[r.framework] ?? '#334155'}44`,
                    }}>
                      {r.framework}
                    </span>
                  </td>
                  <td>
                    <SeveritySummary summary={r.framework_summary} />
                  </td>
                  <td style={{ color: '#64748b', fontSize: 12 }}>
                    {r.generated_at
                      ? new Date(r.generated_at).toLocaleDateString('en-GB')
                      : new Date(r.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td>
                    {r.status === 'ready' ? (
                      <Link
                        href={`/dashboard/reports/${r.id}`}
                        className="btn-s"
                        style={{ fontSize: 12, padding: '4px 12px' }}
                      >
                        View Report
                      </Link>
                    ) : (
                      <span style={{ color: '#475569', fontSize: 12 }}>Generating…</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No reports yet</p>
            <p style={{ fontSize: 13 }}>Reports are auto-generated after completed scans.</p>
            <div style={{ marginTop: 32, padding: 20, background: 'rgba(25,118,210,0.06)', borderRadius: 10, border: '1px solid rgba(25,118,210,0.2)', maxWidth: 400, margin: '32px auto 0' }}>
              <p style={{ fontSize: 12, color: '#42a5f5', fontWeight: 600, marginBottom: 6 }}>DORA · NIS2 · PCI-DSS Reports</p>
              <p style={{ fontSize: 12, color: '#64748b' }}>
                After each scan, Breachr auto-generates compliance reports mapped to your selected frameworks — ready to share with your regulator.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
npx tsc --noEmit 2>&1 | grep "reports"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/reports/page.tsx
git commit -m "feat: update reports list — framework badge, severity summary, View Report link"
```

---

## Task 8: Create report detail page

**Files:**
- Create: `app/dashboard/reports/[id]/page.tsx`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p /Users/grahamjohn/Documents/GitHub/breachr/portal/app/dashboard/reports/\[id\]
```

- [ ] **Step 2: Create the page**

```typescript
// app/dashboard/reports/[id]/page.tsx
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuditLogger from '@/components/AuditLogger'

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info']

const SEV_COLOURS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#22c55e',
  info:     '#64748b',
}

const FRAMEWORK_FULL_NAMES: Record<string, string> = {
  'DORA':    'Digital Operational Resilience Act (DORA)',
  'NIS2':    'Network & Information Security Directive (NIS2)',
  'PCI-DSS': 'Payment Card Industry Data Security Standard (PCI-DSS)',
}

function overallRisk(summary: Record<string, number> | null): string {
  if (!summary) return 'UNKNOWN'
  if (summary.critical > 0) return 'CRITICAL'
  if (summary.high > 0) return 'HIGH'
  if (summary.medium > 0) return 'MEDIUM'
  if (summary.low > 0) return 'LOW'
  return 'PASSED'
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: report } = await supabase
    .from('compliance_reports')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!report) notFound()

  const findings: any[] = report.findings_snapshot ?? []
  const summary: Record<string, number> = report.framework_summary ?? {}
  const risk = overallRisk(summary)
  const hasGaps = (summary.critical ?? 0) + (summary.high ?? 0) > 0

  const sortedFindings = [...findings].sort((a, b) =>
    SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)
  )

  return (
    <div className="portal-content">
      {/* Fires report.viewed audit event on mount — hidden, no output */}
      <AuditLogger
        action="report.viewed"
        detail={{ report_id: report.id, framework: report.framework, scan_id: report.scan_id }}
      />

      {/* Header */}
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
            {FRAMEWORK_FULL_NAMES[report.framework] ?? report.framework}
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Generated {report.generated_at
              ? new Date(report.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : '—'}
            {' · '}Scan ID: {report.scan_id?.slice(0, 8) ?? '—'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
            padding: '4px 12px', borderRadius: 6,
            color: risk === 'PASSED' ? '#22c55e' : SEV_COLOURS[risk.toLowerCase()] ?? '#94a3b8',
            background: risk === 'PASSED' ? 'rgba(34,197,94,0.1)' : `${SEV_COLOURS[risk.toLowerCase()] ?? '#94a3b8'}18`,
            border: `1px solid ${risk === 'PASSED' ? 'rgba(34,197,94,0.3)' : `${SEV_COLOURS[risk.toLowerCase()] ?? '#94a3b8'}44`}`,
          }}>
            {risk}
          </span>
        </div>
      </div>

      {/* Summary card */}
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{
          padding: 20, borderRadius: 10,
          background: hasGaps ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
          border: `1px solid ${hasGaps ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
          marginBottom: 24,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: hasGaps ? '#ef4444' : '#22c55e', marginBottom: 12, letterSpacing: '0.05em' }}>
            {hasGaps ? 'GAPS FOUND — Immediate action required' : 'PASSED — No critical or high severity gaps identified'}
          </p>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {SEV_ORDER.filter(s => s !== 'info').map(sev => (
              <div key={sev}>
                <span style={{ fontSize: 22, fontWeight: 700, color: SEV_COLOURS[sev] }}>{summary[sev] ?? 0}</span>
                <span style={{ fontSize: 12, color: '#64748b', marginLeft: 6, textTransform: 'capitalize' }}>{sev}</span>
              </div>
            ))}
          </div>
          {report.sha256_hash && (
            <p style={{ fontSize: 11, color: '#334155', marginTop: 16, fontFamily: 'monospace' }}>
              SHA-256: {report.sha256_hash}
            </p>
          )}
        </div>

        {/* Findings table */}
        {sortedFindings.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Severity</th>
                <th>Finding</th>
                <th>OWASP</th>
                <th>Controls</th>
              </tr>
            </thead>
            <tbody>
              {sortedFindings.map((f: any, i: number) => (
                <tr key={i}>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: SEV_COLOURS[f.severity] ?? '#94a3b8',
                    }}>
                      {f.severity}
                    </span>
                  </td>
                  <td>
                    <p style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>{f.title}</p>
                    <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{f.description}</p>
                  </td>
                  <td style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {f.owasp_category || '—'}
                  </td>
                  <td>
                    {(f.controls ?? []).map((c: string) => (
                      <span key={c} style={{
                        display: 'inline-block', fontSize: 11, fontWeight: 600,
                        padding: '2px 6px', borderRadius: 4, marginRight: 4, marginBottom: 4,
                        background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        {c}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: 14 }}>
            No findings — all probes passed
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
npx tsc --noEmit 2>&1 | grep -E "reports/\[id\]|AuditLogger"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/reports/\[id\]/page.tsx
git commit -m "feat: compliance report detail page — summary card, findings table, audit log

Read-only frozen snapshot. Fires report.viewed audit event on load.
Shows SHA-256 hash for DORA tamper-evidence verification."
```

---

## Task 9: Deploy and end-to-end test

- [ ] **Step 1: Deploy portal to Vercel**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git push origin main
```

Wait for Vercel to complete the deployment (check dashboard or run `/deploy`).

- [ ] **Step 2: Verify scanner is on latest code**

Check Railway dashboard — the scanner should have auto-deployed from the GitHub push in Task 5 Step 6. Confirm the active deployment is newer than the Task 5 commit.

- [ ] **Step 3: Set compliance_frameworks on your test tenant**

Run in Supabase SQL editor:
```sql
UPDATE tenants
SET compliance_frameworks = '{DORA,NIS2,PCI-DSS}'
WHERE id = '85596311-117b-4c7c-99d2-cd5137ba03ac';
```

- [ ] **Step 4: Trigger a scan from the portal**

Log in as testuser1@test.com and launch a scan. Wait for it to complete.

- [ ] **Step 5: Verify reports were generated**

```sql
SELECT framework, title, status, framework_summary, sha256_hash, generated_at
FROM compliance_reports
WHERE tenant_id = '85596311-117b-4c7c-99d2-cd5137ba03ac'
ORDER BY created_at DESC
LIMIT 6;
```

Expected: 3 rows (DORA, NIS2, PCI-DSS) with `status = 'ready'`, non-null `sha256_hash`, and populated `framework_summary`.

- [ ] **Step 6: View reports in portal**

Navigate to `/dashboard/reports` — confirm 3 report rows appear with framework badges and severity counts.

Click "View Report" on the DORA report — confirm detail page shows findings with control tags (e.g. `Art.9`).

- [ ] **Step 7: Verify audit log**

```sql
SELECT action, detail, created_at
FROM audit_logs
WHERE tenant_id = '85596311-117b-4c7c-99d2-cd5137ba03ac'
  AND action = 'report.viewed'
ORDER BY created_at DESC
LIMIT 3;
```

Expected: a `report.viewed` entry with the report_id in the detail field.

- [ ] **Step 8: Test new onboarding flow (optional — requires a fresh account)**

Create a new account, go through onboarding. Confirm Step 3 appears with framework checkboxes pre-selected based on the chosen industry. Complete onboarding and verify `compliance_frameworks` is saved on the tenant.
