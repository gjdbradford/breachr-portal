'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Scan, Finding } from '@/lib/types'
import { hashFinding } from '@/lib/audit'

// Scans using these model IDs are simulated client-side.
// Any other model_used value means the Python engine is handling it → use Realtime.
const SIMULATED_MODEL_IDS = new Set(['claude-opus', 'llama-3.1', 'multi-model'])

const PHASES = ['queued', 'probing', 'attacking', 'validating', 'complete']
const PHASE_LABELS: Record<string, string> = {
  queued:     'Queued — waiting to start',
  probing:    'Phase 1 — Reconnaissance & surface mapping',
  attacking:  'Phase 2 — Active exploitation testing',
  validating: 'Phase 3 — Human validation & chain analysis',
  complete:   'Complete — findings verified',
}

const MODEL_DISPLAY: Record<string, string> = {
  'claude-opus':        'Claude Opus 4 (simulated)',
  'llama-3.1':          'Llama 3.1 70B (simulated)',
  'multi-model':        'Multi-Model Ensemble (simulated)',
  'claude-sonnet-4-6':  'Claude Sonnet 4.6',
}

const SIMULATED_FINDINGS = [
  { title: 'SQL Injection — login endpoint',        severity: 'critical', ai_model: 'Claude Opus 4',  ai_confidence: 94.2, owasp_category: 'A03:2021', cvss_score: 9.1,
    remediation: 'Use parameterised queries or prepared statements. Never concatenate user input into SQL strings. Apply input validation and least-privilege DB accounts. Consider a WAF rule for short-term mitigation.' },
  { title: 'IDOR — user profile enumeration',       severity: 'high',     ai_model: 'Llama 3.1 70B', ai_confidence: 89.7, owasp_category: 'A01:2021', cvss_score: 7.5,
    remediation: 'Enforce server-side authorisation on every object access. Replace sequential IDs with UUIDs. Validate that the authenticated user owns the requested resource before returning data.' },
  { title: 'Authentication bypass via JWT forgery', severity: 'critical', ai_model: 'Claude Opus 4',  ai_confidence: 91.8, owasp_category: 'A07:2021', cvss_score: 9.8,
    remediation: 'Reject tokens signed with the "none" algorithm. Enforce RS256 or ES256 with a pinned public key. Validate iss, aud, and exp claims. Rotate signing keys immediately.' },
  { title: 'Missing security headers (CSP/HSTS)',   severity: 'medium',   ai_model: 'Mistral 7B',     ai_confidence: 87.3, owasp_category: 'A05:2021', cvss_score: 4.3,
    remediation: 'Add Content-Security-Policy, Strict-Transport-Security (max-age≥31536000; includeSubDomains), X-Frame-Options: DENY, and X-Content-Type-Options: nosniff headers on all responses.' },
  { title: 'Exposed API key in JS bundle',          severity: 'high',     ai_model: 'Llama 3.1 70B', ai_confidence: 96.1, owasp_category: 'A02:2021', cvss_score: 8.2,
    remediation: 'Revoke the exposed key immediately. Move all secrets to server-side environment variables. Audit git history for historical exposure. Use a secrets scanner in CI to prevent recurrence.' },
  { title: 'SSRF via webhook URL parameter',        severity: 'high',     ai_model: 'Claude Opus 4',  ai_confidence: 88.4, owasp_category: 'A10:2021', cvss_score: 7.1,
    remediation: 'Validate webhook URLs against an allowlist of approved domains. Block requests to RFC-1918 ranges (10.x, 172.16.x, 192.168.x) and link-local addresses. Use an outbound proxy to enforce egress policy.' },
  { title: 'Cross-site request forgery on /transfer', severity: 'medium', ai_model: 'Multi-Model',    ai_confidence: 92.0, owasp_category: 'A01:2021', cvss_score: 6.5,
    remediation: 'Implement synchronised CSRF tokens (Double Submit Cookie pattern) on all state-changing endpoints. Validate Origin and Referer headers. Use SameSite=Strict on session cookies.' },
]

async function logAudit(action: string, detail: object) {
  try {
    await fetch('/api/audit/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, detail }),
    })
  } catch (e) {
    console.error('audit log failed', e)
  }
}

export default function ScanProgress({ scan: initialScan, initialFindings }: { scan: Scan & { attack_surfaces?: any }; initialFindings: Finding[] }) {
  const [scan, setScan] = useState(initialScan)
  const [findings, setFindings] = useState<Finding[]>(initialFindings)
  const [simStep, setSimStep] = useState(0)
  const supabase = createClient()

  const surface = scan.attack_surfaces as any
  const isSimulated = SIMULATED_MODEL_IDS.has(scan.model_used ?? '')

  // Real scan mode: subscribe to Supabase Realtime — Python engine writes updates
  useEffect(() => {
    if (isSimulated) return
    if (scan.status === 'complete' || scan.status === 'failed') return

    const channel = supabase
      .channel(`scan-${scan.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'scans', filter: `id=eq.${scan.id}`,
      }, (payload: any) => {
        setScan(prev => ({ ...prev, ...payload.new } as Scan))
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'findings', filter: `scan_id=eq.${scan.id}`,
      }, (payload: any) => {
        setFindings(prev => [payload.new as Finding, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [scan.id, scan.status, isSimulated, supabase])

  const advanceScan = useCallback(async () => {
    if (scan.status === 'complete' || scan.status === 'failed') return

    const phaseIdx = PHASES.indexOf(scan.current_phase ?? 'queued')
    const nextPhase = PHASES[Math.min(phaseIdx + 1, PHASES.length - 1)]
    const newTestsRun = Math.min(scan.tests_run + Math.floor(Math.random() * 120 + 80), scan.tests_total)
    const pct = Math.round((newTestsRun / scan.tests_total) * 100)
    const isComplete = pct >= 100

    const update: Partial<Scan> = {
      tests_run: newTestsRun,
      progress_pct: pct,
      current_phase: isComplete ? 'complete' : nextPhase,
      status: isComplete ? 'complete' : 'running',
    }

    await supabase.from('scans').update(update).eq('id', scan.id)

    if (!isComplete && simStep < SIMULATED_FINDINGS.length) {
      const f = SIMULATED_FINDINGS[simStep]
      const finding_hash = await hashFinding({
        scan_id: scan.id,
        title: f.title,
        severity: f.severity,
        owasp_category: f.owasp_category,
        cvss_score: f.cvss_score,
        ai_model: f.ai_model,
        ai_confidence: f.ai_confidence,
      })

      // Check if this vulnerability was previously remediated in an earlier scan
      const { data: prevRemediated } = await supabase
        .from('findings')
        .select('id')
        .eq('tenant_id', scan.tenant_id)
        .eq('title', f.title)
        .eq('severity', f.severity)
        .eq('status', 'remediated')
        .limit(1)
        .maybeSingle()

      const status = prevRemediated ? 'verified_fixed' : 'open'

      const { data: inserted } = await supabase.from('findings').insert({
        scan_id: scan.id,
        tenant_id: scan.tenant_id,
        title: f.title,
        severity: f.severity,
        ai_model: f.ai_model,
        ai_confidence: f.ai_confidence,
        owasp_category: f.owasp_category,
        cvss_score: f.cvss_score,
        finding_hash,
        status,
        description: status === 'verified_fixed'
          ? `Previously remediated — re-scan confirms fix is holding. Original: identified by ${f.ai_model} (CVSS ${f.cvss_score} — ${f.owasp_category}).`
          : `Identified by ${f.ai_model} during active exploitation phase. CVSS ${f.cvss_score} — ${f.owasp_category}.`,
        remediation: f.remediation,
      }).select().single()

      if (inserted) {
        setFindings(prev => [inserted as Finding, ...prev])
        if (status === 'verified_fixed') {
          logAudit('finding.verified_fixed', {
            scan_id: scan.id,
            finding_id: inserted.id,
            title: f.title,
            severity: f.severity,
          })
        } else {
          logAudit('finding.discovered', {
            scan_id: scan.id,
            finding_id: inserted.id,
            title: f.title,
            severity: f.severity,
            finding_hash,
          })
        }
      }
      setSimStep(s => s + 1)
    }

    if (isComplete) {
      logAudit('scan.completed', { scan_id: scan.id, total_findings: simStep })
    }

    setScan(prev => ({ ...prev, ...update } as Scan))
  }, [scan, simStep, supabase])

  useEffect(() => {
    if (!isSimulated) return  // real scans handled by Realtime subscription above
    if (scan.status === 'complete' || scan.status === 'failed') return
    if (scan.status === 'queued') {
      supabase.from('scans').update({ status: 'running', current_phase: 'probing', started_at: new Date().toISOString() }).eq('id', scan.id).then(() => {
        setScan(prev => ({ ...prev, status: 'running', current_phase: 'probing' } as Scan))
        logAudit('scan.started', { scan_id: scan.id, model: scan.model_used })
      })
    }
    const interval = setInterval(advanceScan, 3500)
    return () => clearInterval(interval)
  }, [scan.status, scan.id, advanceScan, supabase])

  const phase = scan.current_phase ?? 'queued'
  const pct = scan.progress_pct ?? 0
  const isRunning = scan.status === 'running'
  const isComplete = scan.status === 'complete'

  return (
    <>
      {isSimulated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', marginBottom: 16, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8 }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>SIMULATED SCAN</span>
            <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 10 }}>
              These findings are demo data — not real vulnerabilities.
              The <strong style={{ color: '#e2e8f0' }}>Breachr scanner engine</strong> runs automatically in the background and picks up new scans within 15 seconds.
            </span>
          </div>
        </div>
      )}

      <div className="portal-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Link href="/dashboard/scans" style={{ color: '#64748b', fontSize: 12 }}>← Scans</Link>
            <span style={{ color: '#334155', fontSize: 12 }}>/</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{surface?.name ?? 'Scan'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
              {isComplete ? 'SCAN COMPLETE' : 'SCAN IN PROGRESS'}
            </h1>
            {isSimulated ? (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', padding: '3px 7px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
                SIMULATED
              </span>
            ) : (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', padding: '3px 7px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
                REAL SCAN
              </span>
            )}
          </div>
          {isComplete && (
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
              {findings.filter(f => f.status !== 'verified_fixed').length} new findings
              {findings.some(f => f.status === 'verified_fixed') && (
                <> · <span style={{ color: '#22c55e' }}>{findings.filter(f => f.status === 'verified_fixed').length} verified fixed</span></>
              )}
            </p>
          )}
        </div>
        {isComplete && (
          <Link href="/dashboard/findings" className="btn-p" style={{ fontSize: 13, padding: '8px 18px' }}>
            View All Findings →
          </Link>
        )}
      </div>

      <div className="gs au1" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isRunning && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#42a5f5', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />}
            {isComplete && <span style={{ color: '#22c55e', fontSize: 14 }}>✓</span>}
            <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{PHASE_LABELS[phase] ?? phase}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{scan.tests_run ?? 0} / {scan.tests_total ?? 0} test cases</span>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: isComplete ? '#22c55e' : '#42a5f5' }}>{pct}%</span>
          </div>
        </div>

        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: isComplete ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#1976d2,#42a5f5)', borderRadius: 3, transition: 'width 0.5s ease' }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {PHASES.filter(p => p !== 'queued').map((p) => {
            const phaseIdx = PHASES.indexOf(phase)
            const done = PHASES.indexOf(p) < phaseIdx
            const active = p === phase
            return (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, border: `1px solid ${active ? 'rgba(25,118,210,0.5)' : done ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`, background: active ? 'rgba(25,118,210,0.1)' : done ? 'rgba(34,197,94,0.08)' : 'transparent', color: active ? '#42a5f5' : done ? '#22c55e' : '#475569' }}>
                {done ? '✓' : active ? '●' : '○'} {p.charAt(0).toUpperCase() + p.slice(1)}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Target', value: surface?.name ?? '—' },
          { label: 'URL', value: surface?.target_url ?? '—' },
          { label: 'AI Model', value: MODEL_DISPLAY[scan.model_used ?? ''] ?? scan.model_used ?? '—' },
          { label: 'Scan Type', value: scan.scan_type?.toUpperCase() ?? '—' },
        ].map(item => (
          <div key={item.label} className="gs" style={{ padding: '12px 14px', borderRadius: 8 }}>
            <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{item.label}</p>
            <p style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Token usage / cost — shown for real scans after completion */}
      {!isSimulated && isComplete && (scan as any).tokens_input > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Tokens In', value: ((scan as any).tokens_input ?? 0).toLocaleString(), color: '#42a5f5' },
            { label: 'Tokens Out', value: ((scan as any).tokens_output ?? 0).toLocaleString(), color: '#a78bfa' },
            { label: 'Total Tokens', value: (((scan as any).tokens_input ?? 0) + ((scan as any).tokens_output ?? 0)).toLocaleString(), color: '#e2e8f0' },
            { label: 'Scan Cost', value: `$${((scan as any).cost_usd ?? 0).toFixed(4)}`, color: '#22c55e' },
          ].map(item => (
            <div key={item.label} className="gs" style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.1)' }}>
              <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{item.label}</p>
              <p style={{ fontSize: 13, color: item.color, fontWeight: 700, fontFamily: 'monospace' }}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Queued state for real scans — engine will pick up within 15s */}
      {!isSimulated && scan.status === 'queued' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 16, background: 'rgba(25,118,210,0.06)', border: '1px solid rgba(25,118,210,0.2)', borderRadius: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#42a5f5', animation: 'pulse 1.5s infinite', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Scan engine polling every 15 seconds — your scan will start automatically.
          </span>
        </div>
      )}

      <div className="gs au1" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
            Live Findings {findings.length > 0 && <span style={{ color: '#64748b', fontWeight: 400 }}>({findings.length} found)</span>}
          </span>
          {isRunning && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#42a5f5' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#42a5f5', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              Updating live
            </span>
          )}
        </div>

        {findings.length > 0 ? (
          <>
            {isComplete && findings.some(f => f.status === 'verified_fixed') && (
              <div style={{ margin: '0 16px 0', padding: '10px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ color: '#22c55e', fontSize: 16 }}>✓</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>
                  {findings.filter(f => f.status === 'verified_fixed').length} previously remediated {findings.filter(f => f.status === 'verified_fixed').length === 1 ? 'finding' : 'findings'} confirmed still fixed
                </span>
                <span style={{ color: '#64748b', fontSize: 11 }}>· cryptographic evidence recorded in audit trail</span>
              </div>
            )}
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Finding</th>
                <th>Severity</th>
                <th>CVSS</th>
                <th>OWASP</th>
                <th>AI Model · Confidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f, i) => {
                const isVerified = f.status === 'verified_fixed'
                return (
                  <tr key={f.id} style={{ animation: i === 0 && isRunning ? 'fadeIn 0.4s ease' : undefined, opacity: isVerified ? 0.75 : 1 }}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b' }}>BRH-{String(i + 1).padStart(3, '0')}</span></td>
                    <td style={{ maxWidth: 220 }}>
                      <div style={{ fontWeight: 500, fontSize: 12, textDecoration: isVerified ? 'line-through' : 'none', color: isVerified ? '#64748b' : '#e2e8f0' }}>{f.title}</div>
                      {isVerified && <div style={{ fontSize: 10, color: '#22c55e', marginTop: 1 }}>Re-scan confirms fix is holding</div>}
                    </td>
                    <td><span className={`sev-${f.severity}`} style={{ borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px', opacity: isVerified ? 0.5 : 1 }}>{f.severity}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: isVerified ? '#475569' : undefined }}>{f.cvss_score ?? '—'}</td>
                    <td style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{f.owasp_category ?? '—'}</td>
                    <td>
                      {f.ai_model ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 3, fontSize: 9.5, color: '#3b82f6', padding: '2px 5px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {f.ai_model}
                          {f.ai_confidence != null && <span style={{ color: '#22c55e', marginLeft: 3, fontWeight: 600 }}>{f.ai_confidence}%</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {isVerified ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 3, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                          ✓ verified fixed
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 3, padding: '2px 7px' }}>
                          new
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </>

        ) : (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569' }}>
            <p style={{ fontSize: 13 }}>{isRunning ? 'Scanning… findings will appear here as they are discovered.' : 'No findings yet.'}</p>
          </div>
        )}
      </div>
    </>
  )
}
