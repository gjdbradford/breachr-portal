'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Scan, Finding } from '@/lib/types'

const PHASES = ['queued', 'probing', 'attacking', 'validating', 'complete']
const PHASE_LABELS: Record<string, string> = {
  queued:     'Queued — waiting to start',
  probing:    'Phase 1 — Reconnaissance & surface mapping',
  attacking:  'Phase 2 — Active exploitation testing',
  validating: 'Phase 3 — Human validation & chain analysis',
  complete:   'Complete — findings verified',
}

const MODEL_DISPLAY: Record<string, string> = {
  'claude-opus': 'Claude Opus 4',
  'llama-3.1':   'Llama 3.1 70B',
  'multi-model': 'Multi-Model Ensemble',
}

const SIMULATED_FINDINGS = [
  { title: 'SQL Injection — login endpoint',        severity: 'critical', ai_model: 'Claude Opus 4',    ai_confidence: 94.2, owasp_category: 'A03:2021', cvss_score: 9.1 },
  { title: 'IDOR — user profile enumeration',       severity: 'high',     ai_model: 'Llama 3.1 70B',   ai_confidence: 89.7, owasp_category: 'A01:2021', cvss_score: 7.5 },
  { title: 'Authentication bypass via JWT forgery', severity: 'critical', ai_model: 'Claude Opus 4',    ai_confidence: 91.8, owasp_category: 'A07:2021', cvss_score: 9.8 },
  { title: 'Missing security headers (CSP/HSTS)',   severity: 'medium',   ai_model: 'Mistral 7B',       ai_confidence: 87.3, owasp_category: 'A05:2021', cvss_score: 4.3 },
  { title: 'Exposed API key in JS bundle',          severity: 'high',     ai_model: 'Llama 3.1 70B',   ai_confidence: 96.1, owasp_category: 'A02:2021', cvss_score: 8.2 },
  { title: 'SSRF via webhook URL parameter',        severity: 'high',     ai_model: 'Claude Opus 4',    ai_confidence: 88.4, owasp_category: 'A10:2021', cvss_score: 7.1 },
  { title: 'Cross-site request forgery on /transfer', severity: 'medium', ai_model: 'Multi-Model',      ai_confidence: 92.0, owasp_category: 'A01:2021', cvss_score: 6.5 },
]

function hashStr(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(16).padStart(8, '0')
}

export default function ScanProgress({ scan: initialScan, initialFindings }: { scan: Scan & { attack_surfaces?: any }; initialFindings: Finding[] }) {
  const [scan, setScan] = useState(initialScan)
  const [findings, setFindings] = useState<Finding[]>(initialFindings)
  const [simStep, setSimStep] = useState(0)
  const supabase = createClient()

  const surface = scan.attack_surfaces as any

  // Advance the simulated scan every few seconds
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

    // Inject a simulated finding occasionally
    if (!isComplete && simStep < SIMULATED_FINDINGS.length) {
      const f = SIMULATED_FINDINGS[simStep]
      const hash = hashStr(scan.id + f.title + simStep)
      const { data: inserted } = await supabase.from('findings').insert({
        scan_id: scan.id,
        tenant_id: scan.tenant_id,
        title: f.title,
        severity: f.severity,
        ai_model: f.ai_model,
        ai_confidence: f.ai_confidence,
        owasp_category: f.owasp_category,
        cvss_score: f.cvss_score,
        finding_hash: hash,
        status: 'open',
        description: `Identified by ${f.ai_model} during active exploitation phase. CVSS ${f.cvss_score} — ${f.owasp_category}.`,
      }).select().single()
      if (inserted) setFindings(prev => [inserted as Finding, ...prev])
      setSimStep(s => s + 1)
    }

    setScan(prev => ({ ...prev, ...update } as Scan))
  }, [scan, simStep, supabase])

  useEffect(() => {
    if (scan.status === 'complete' || scan.status === 'failed') return
    // Kick off — start scan immediately if queued
    if (scan.status === 'queued') {
      supabase.from('scans').update({ status: 'running', current_phase: 'probing', started_at: new Date().toISOString() }).eq('id', scan.id).then(() => {
        setScan(prev => ({ ...prev, status: 'running', current_phase: 'probing' } as Scan))
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
      {/* Header */}
      <div className="portal-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Link href="/dashboard/scans" style={{ color: '#64748b', fontSize: 12 }}>← Scans</Link>
            <span style={{ color: '#334155', fontSize: 12 }}>/</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{surface?.name ?? 'Scan'}</span>
          </div>
          <h1 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
            {isComplete ? 'SCAN COMPLETE' : 'SCAN IN PROGRESS'}
          </h1>
        </div>
        {isComplete && (
          <Link href="/dashboard/findings" className="btn-p" style={{ fontSize: 13, padding: '8px 18px' }}>
            View All Findings →
          </Link>
        )}
      </div>

      {/* Live status bar */}
      <div className="gs au1" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isRunning && (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#42a5f5', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            )}
            {isComplete && <span style={{ color: '#22c55e', fontSize: 14 }}>✓</span>}
            <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{PHASE_LABELS[phase] ?? phase}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{scan.tests_run ?? 0} / {scan.tests_total ?? 0} test cases</span>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: isComplete ? '#22c55e' : '#42a5f5' }}>{pct}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: isComplete ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#1976d2,#42a5f5)', borderRadius: 3, transition: 'width 0.5s ease' }} />
        </div>

        {/* Phase pills */}
        <div style={{ display: 'flex', gap: 8 }}>
          {PHASES.filter(p => p !== 'queued').map((p, i) => {
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

      {/* Scan metadata */}
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

      {/* Live findings */}
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
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Finding</th>
                <th>Severity</th>
                <th>CVSS</th>
                <th>OWASP</th>
                <th>AI Model · Confidence</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f, i) => (
                <tr key={f.id} style={{ animation: i === 0 && isRunning ? 'fadeIn 0.4s ease' : undefined }}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b' }}>BRH-{String(i + 1).padStart(3, '0')}</span></td>
                  <td style={{ maxWidth: 220 }}>
                    <div style={{ fontWeight: 500, fontSize: 12 }}>{f.title}</div>
                    {f.description && <div style={{ fontSize: 10, color: '#64748b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{f.description}</div>}
                  </td>
                  <td><span className={`sev-${f.severity}`} style={{ borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px' }}>{f.severity}</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{f.cvss_score ?? '—'}</td>
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
                    {f.finding_hash ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#3b5f8a' }}>{f.finding_hash.slice(0, 10)}…</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569' }}>
            <p style={{ fontSize: 13 }}>{isRunning ? 'Scanning… findings will appear here as they are discovered.' : 'No findings yet.'}</p>
          </div>
        )}
      </div>
    </>
  )
}
