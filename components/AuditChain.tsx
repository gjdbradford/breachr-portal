'use client'

import { useEffect, useState } from 'react'
import type { AuditLog } from '@/lib/types'
import { sha256Hex, GENESIS_HASH } from '@/lib/audit'

const ACTION_META: Record<string, { label: string; icon: string; color: string }> = {
  'scan.launched':           { label: 'Scan Launched',         icon: '⟳', color: '#42a5f5' },
  'scan.queued':             { label: 'Scan Queued',           icon: '⏱', color: '#3b82f6' },
  'scan.started':            { label: 'Scan Started',          icon: '▶', color: '#42a5f5' },
  'scan.completed':          { label: 'Scan Completed',        icon: '✓', color: '#22c55e' },
  'finding.discovered':      { label: 'Finding Discovered',    icon: '⚠', color: '#f59e0b' },
  'finding.status_changed':  { label: 'Status Changed',        icon: '↻', color: '#a78bfa' },
  'finding.verified_fixed':  { label: 'Fix Verified',          icon: '✓', color: '#22c55e' },
  'report.viewed':           { label: 'Report Viewed',         icon: '▤', color: '#64748b' },
  'report.downloaded':       { label: 'Report Downloaded',     icon: '↓', color: '#64748b' },
  'target.created':          { label: 'Target Added',          icon: '◎', color: '#42a5f5' },
  'target.deleted':          { label: 'Target Removed',        icon: '✕', color: '#ef4444' },
  'settings.updated':        { label: 'Settings Updated',      icon: '⚙', color: '#94a3b8' },
}

function parseDetail(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw)
    const { _ts, ...rest } = obj
    void _ts
    return Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, String(v)])
    )
  } catch {
    return {}
  }
}

function formatDetail(action: string, detail: Record<string, string>): string {
  if (action === 'finding.status_changed') {
    const title = detail.title ?? detail.finding_id ?? '?'
    return `"${title}" → ${detail.from ?? '?'} → ${detail.to ?? '?'}`
  }
  if (action === 'scan.completed' || action === 'scan.launched' || action === 'scan.started') {
    return detail.scan_id ? `Scan ${detail.scan_id.slice(0, 8)}…` : ''
  }
  if (action === 'finding.discovered' || action === 'finding.verified_fixed') {
    const title = detail.title ?? ''
    const sev = detail.severity ? ` (${detail.severity})` : ''
    return `${title}${sev}`
  }
  if (action === 'report.viewed') return detail.framework ?? ''
  const values = Object.values(detail).slice(0, 2).join(' · ')
  return values
}

type ChainResult = { chainValid: boolean; sigValid?: boolean }

export default function AuditChain({ entries }: { entries: AuditLog[] }) {
  const [chainResults, setChainResults] = useState<Record<string, ChainResult>>({})
  const [verifying, setVerifying] = useState(false)
  const [serverResult, setServerResult] = useState<{ allValid: boolean } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!entries.length) return
    ;(async () => {
      const results: Record<string, ChainResult> = {}
      for (let i = 0; i < entries.length; i++) {
        const expected = i === 0
          ? GENESIS_HASH
          : await sha256Hex(entries[i - 1].signature ?? '')
        results[entries[i].id] = { chainValid: entries[i].prev_hash === expected }
      }
      setChainResults(results)
    })()
  }, [entries])

  async function handleVerify() {
    setVerifying(true)
    try {
      const res = await fetch('/api/audit/verify')
      const data = await res.json()
      setChainResults(prev => {
        const next = { ...prev }
        for (const e of data.entries ?? []) {
          next[e.id] = { ...next[e.id], sigValid: e.sigValid, chainValid: e.chainValid }
        }
        return next
      })
      setServerResult({ allValid: data.allValid })
    } catch { /* ignore */ }
    finally { setVerifying(false) }
  }

  const chainIntact = entries.length === 0 || Object.values(chainResults).every(r => r.chainValid)
  const total = entries.length

  // Group entries by date
  const byDate: { date: string; items: AuditLog[] }[] = []
  for (const e of [...entries].reverse()) {
    const d = new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const last = byDate[byDate.length - 1]
    if (last?.date === d) last.items.push(e)
    else byDate.push({ date: d, items: [e] })
  }

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="gs" style={{ flex: 1, minWidth: 160, padding: '14px 18px', borderRadius: 10 }}>
          <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Total Events</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>{total}</p>
        </div>
        <div className="gs" style={{ flex: 1, minWidth: 160, padding: '14px 18px', borderRadius: 10 }}>
          <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Chain Status</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: chainIntact ? '#22c55e' : '#ef4444' }}>
            {total === 0 ? '—' : chainIntact ? '⛓ Intact' : '⚠ Broken'}
          </p>
        </div>
        {serverResult && (
          <div className="gs" style={{ flex: 1, minWidth: 160, padding: '14px 18px', borderRadius: 10 }}>
            <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>HMAC Verification</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: serverResult.allValid ? '#22c55e' : '#ef4444' }}>
              {serverResult.allValid ? '🔐 All valid' : '✗ Failed'}
            </p>
          </div>
        )}
        <button
          onClick={handleVerify}
          disabled={verifying || total === 0}
          className="btn-s"
          style={{ fontSize: 11, padding: '8px 18px', alignSelf: 'center' }}
        >
          {verifying ? 'Verifying…' : '🔐 Verify Chain'}
        </button>
      </div>

      {/* Timeline */}
      <div className="gs au1" style={{ padding: 0, overflow: 'hidden' }}>
        {total === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 28, marginBottom: 12 }}>⛓</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>No audit events yet</p>
            <p style={{ fontSize: 12, color: '#475569' }}>Launch a scan or change a finding status to start building the chain.</p>
          </div>
        ) : (
          byDate.map(({ date, items }) => (
            <div key={date}>
              {/* Date divider */}
              <div style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{date}</span>
              </div>

              {items.map((entry, idx) => {
                const meta = ACTION_META[entry.action] ?? { label: entry.action, icon: '·', color: '#64748b' }
                const detail = parseDetail(entry.detail)
                const summary = formatDetail(entry.action, detail)
                const result = chainResults[entry.id]
                const isExpanded = expanded === entry.id
                const isLast = idx === items.length - 1

                return (
                  <div key={entry.id} style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
                    <div
                      onClick={() => setExpanded(isExpanded ? null : entry.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Icon */}
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${meta.color}18`, border: `1px solid ${meta.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, color: meta.color }}>
                        {meta.icon}
                      </div>

                      {/* Action + summary */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                          {summary && <span style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>{summary}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: '#334155', marginTop: 2, fontFamily: 'monospace' }}>
                          {new Date(entry.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC
                        </div>
                      </div>

                      {/* Chain validity */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {result == null ? (
                          <span style={{ fontSize: 10, color: '#334155' }}>…</span>
                        ) : result.chainValid ? (
                          <span title="Chain link valid" style={{ fontSize: 10, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 3 }}>⛓ <span style={{ color: '#22c55e' }}>✓</span></span>
                        ) : (
                          <span title="Chain broken" style={{ fontSize: 10, color: '#ef4444' }}>⛓ ✗</span>
                        )}
                        {result?.sigValid != null && (
                          result.sigValid
                            ? <span title="HMAC verified" style={{ fontSize: 11 }}>🔐</span>
                            : <span title="HMAC failed" style={{ fontSize: 10, color: '#ef4444' }}>✗ HMAC</span>
                        )}
                        <span style={{ fontSize: 10, color: '#334155' }}>{isExpanded ? '▴' : '▾'}</span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ padding: '12px 20px 16px 64px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        {Object.keys(detail).length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Event Detail</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {Object.entries(detail).map(([k, v]) => (
                                <div key={k} style={{ fontSize: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '3px 8px' }}>
                                  <span style={{ color: '#475569' }}>{k}: </span>
                                  <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                          <div>
                            <p style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>prev_hash</p>
                            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#3b5f8a' }}>{entry.prev_hash ?? 'GENESIS'}</span>
                          </div>
                          <div>
                            <p style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>signature</p>
                            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#42a5f5' }}>{entry.signature ?? '—'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
