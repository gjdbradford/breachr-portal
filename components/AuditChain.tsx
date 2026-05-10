'use client'

import { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { AuditLog } from '@/lib/types'
import ExportButton from './ExportButton'
import { formatFriendly, formatFriendlyDate } from '@/lib/format-date'

const ACTION_META: Record<string, { label: string; icon: string; color: string }> = {
  'scan.launched':           { label: 'Scan Launched',      icon: '⟳', color: '#42a5f5' },
  'scan.queued':             { label: 'Scan Queued',         icon: '⏱', color: '#3b82f6' },
  'scan.started':            { label: 'Scan Started',        icon: '▶', color: '#42a5f5' },
  'scan.completed':          { label: 'Scan Completed',      icon: '✓', color: '#22c55e' },
  'finding.discovered':      { label: 'Finding Discovered',  icon: '⚠', color: '#f59e0b' },
  'finding.status_changed':  { label: 'Status Changed',      icon: '↻', color: '#a78bfa' },
  'finding.verified_fixed':  { label: 'Fix Verified',        icon: '✓', color: '#22c55e' },
  'report.viewed':           { label: 'Report Viewed',       icon: '▤', color: '#64748b' },
  'report.downloaded':       { label: 'Report Downloaded',   icon: '↓', color: '#64748b' },
  'export.requested':        { label: 'Export Requested',    icon: '↓', color: '#a78bfa' },
  'export.completed':        { label: 'Export Completed',    icon: '✓', color: '#22c55e' },
  'target.created':          { label: 'Target Added',        icon: '◎', color: '#42a5f5' },
  'target.deleted':          { label: 'Target Removed',      icon: '✕', color: '#ef4444' },
  'settings.updated':        { label: 'Settings Updated',    icon: '⚙', color: '#94a3b8' },
}

const GROUP_META: Record<string, { label: string; color: string }> = {
  scans:    { label: 'Scans',    color: '#42a5f5' },
  findings: { label: 'Findings', color: '#f59e0b' },
  reports:  { label: 'Reports',  color: '#64748b' },
  admin:    { label: 'Admin',    color: '#94a3b8' },
}

const DATE_PRESETS = [
  { key: '24h', label: 'Last 24h' },
  { key: '7d',  label: 'Last 7d'  },
  { key: '30d', label: 'Last 30d' },
  { key: '90d', label: 'Last 90d' },
]

function parseDetail(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    const { _ts, ...rest } = JSON.parse(raw)
    void _ts
    return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, String(v)]))
  } catch { return {} }
}

function formatDetail(action: string, detail: Record<string, string>): string {
  if (action === 'finding.status_changed') {
    const title = detail.title ?? detail.finding_id ?? '?'
    return `"${title}" ${detail.from ?? '?'} → ${detail.to ?? '?'}`
  }
  if (action.startsWith('scan.')) return detail.scan_id ? `Scan ${detail.scan_id.slice(0, 8)}…` : ''
  if (action === 'finding.discovered' || action === 'finding.verified_fixed') {
    return `${detail.title ?? ''}${detail.severity ? ` (${detail.severity})` : ''}`
  }
  if (action === 'report.viewed') return detail.framework ?? ''
  if (action === 'export.requested' || action === 'export.completed') {
    const type = detail.data_type ?? ''
    const fmt  = detail.format ? `(${detail.format.toUpperCase()})` : ''
    const label = type === 'audit_trail' ? 'Audit Trail' : type === 'findings' ? 'Findings' : type === 'inventory' ? 'Inventory' : type
    return `${label} ${fmt}`.trim()
  }
  return Object.values(detail).slice(0, 2).join(' · ')
}

type VerifyEntry = {
  id: string
  action: string
  created_at: string
  chainValid: boolean
  sigValid: boolean
  valid: boolean
  chain_annotation: string | null
  chain_annotation_at: string | null
  annotator_name: string | null
}

type ServerResult = {
  allValid: boolean
  total: number
  failed: number
  failedEntries: VerifyEntry[]
}

export default function AuditChain({
  entries,
  filteredCount,
  totalCount,
  page,
  pageSize,
  canExport,
  userRole,
  timezone = 'UTC',
}: {
  entries: AuditLog[]
  filteredCount: number
  totalCount: number
  page: number
  pageSize: number
  canExport: boolean
  userRole: string
  timezone?: string
}) {
  const router      = useRouter()
  const searchParams = useSearchParams()

  const groupFilter = searchParams.get('group') ?? ''
  const datePreset  = searchParams.get('date')  ?? ''

  const [verifying, setVerifying]               = useState(false)
  const [serverResult, setServerResult]         = useState<ServerResult | null>(null)
  const [expanded, setExpanded]                 = useState<string | null>(null)
  const [annotationDrafts, setAnnotationDrafts] = useState<Record<string, string>>({})
  const [savingAnnotation, setSavingAnnotation] = useState<string | null>(null)
  const [annotationError, setAnnotationError]   = useState<Record<string, string>>({})

  const canAnnotate = userRole === 'admin' || userRole === 'account_owner'
  const failedIds   = new Set((serverResult?.failedEntries ?? []).map(e => e.id))

  const setParam = useCallback((key: string, value: string | null) => {
    const p = new URLSearchParams(searchParams.toString())
    if (value) p.set(key, value); else p.delete(key)
    p.delete('p')
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, searchParams])

  const setPage = useCallback((p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (p > 1) params.set('p', String(p)); else params.delete('p')
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  const clearFilters = useCallback(() => router.replace('?', { scroll: false }), [router])

  async function handleVerify() {
    setVerifying(true)
    try {
      const res  = await fetch('/api/audit/verify')
      const data = await res.json()
      const allEntries: VerifyEntry[] = (data.entries ?? []).map((e: VerifyEntry) => ({ ...e, id: String(e.id) }))
      const failedEntries = allEntries.filter(e => !e.valid)
      setServerResult({
        allValid:      data.allValid,
        total:         allEntries.length,
        failed:        failedEntries.length,
        failedEntries,
      })
    } catch { /* ignore */ }
    finally { setVerifying(false) }
  }

  async function handleSaveAnnotation(entryId: string) {
    const explanation = (annotationDrafts[entryId] ?? '').trim()
    if (!explanation) return
    setSavingAnnotation(entryId)
    setAnnotationError(prev => ({ ...prev, [entryId]: '' }))
    try {
      const res = await fetch(`/api/audit/${entryId}/annotate`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ explanation }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAnnotationError(prev => ({ ...prev, [entryId]: data.error ?? 'Save failed' }))
        return
      }
      const now = new Date().toISOString()
      setServerResult(prev => {
        if (!prev) return prev
        return {
          ...prev,
          failedEntries: prev.failedEntries.map(e =>
            e.id === String(entryId)
              ? { ...e, chain_annotation: explanation, chain_annotation_at: now, annotator_name: 'You' }
              : e
          ),
        }
      })
      setAnnotationDrafts(prev => ({ ...prev, [entryId]: '' }))
    } catch {
      setAnnotationError(prev => ({ ...prev, [entryId]: 'Network error — try again' }))
    } finally {
      setSavingAnnotation(null)
    }
  }

  function breakReason(entry: Pick<VerifyEntry, 'chainValid' | 'sigValid'>): string {
    if (!entry.chainValid && !entry.sigValid)
      return 'prev_hash mismatch and signature invalid — possible tampering or key change'
    if (!entry.chainValid)
      return 'prev_hash mismatch — concurrent writes to the chain detected'
    return 'Signature invalid — signing key mismatch or entry modified after signing'
  }

  const hasFilters = groupFilter || datePreset
  const totalPages = Math.ceil(filteredCount / pageSize)

  // Group entries by date (entries arrive newest-first from server)
  const byDate: { date: string; items: AuditLog[] }[] = []
  for (const e of entries) {
    const d = formatFriendlyDate(e.created_at, timezone)
    const last = byDate[byDate.length - 1]
    if (last?.date === d) last.items.push(e)
    else byDate.push({ date: d, items: [e] })
  }

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="gs" style={{ flex: 1, minWidth: 140, padding: '14px 18px', borderRadius: 10 }}>
          <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Total Events</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>{totalCount}</p>
        </div>
        <div className="gs" style={{ flex: 1, minWidth: 140, padding: '14px 18px', borderRadius: 10 }}>
          <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {hasFilters ? 'Filtered' : 'This Page'}
          </p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
            {hasFilters ? filteredCount : entries.length}
          </p>
        </div>
        {serverResult && (
          <div className="gs" style={{ flex: 1, minWidth: 140, padding: '14px 18px', borderRadius: 10 }}>
            <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>HMAC Verification</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: serverResult.allValid ? '#22c55e' : '#ef4444' }}>
              {serverResult.allValid
                ? `🔐 All ${serverResult.total} valid`
                : `✗ ${serverResult.failed} of ${serverResult.total} failed`}
            </p>
          </div>
        )}
        <button
          onClick={handleVerify}
          disabled={verifying || totalCount === 0}
          className="btn-s"
          style={{ fontSize: 11, padding: '8px 18px', alignSelf: 'center' }}
        >
          {verifying ? 'Verifying…' : '🔐 Verify Chain'}
        </button>
      </div>

      {/* Chain breaks panel */}
      {serverResult && !serverResult.allValid && (
        <div style={{ marginBottom: 16, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>
              Chain break{serverResult.failed !== 1 ? 's' : ''} detected — {serverResult.failed} entr{serverResult.failed !== 1 ? 'ies' : 'y'} failed verification
            </p>
          </div>
          {serverResult.failedEntries.map(entry => {
            const isAnnotated   = !!entry.chain_annotation
            const editableUntil = entry.chain_annotation_at
              ? new Date(new Date(entry.chain_annotation_at).getTime() + 24 * 60 * 60 * 1000)
              : null
            const isLocked  = editableUntil ? Date.now() > editableUntil.getTime() : false
            const draft     = annotationDrafts[entry.id] ?? ''
            const saving    = savingAnnotation === entry.id
            const errMsg    = annotationError[entry.id] ?? ''

            return (
              <div key={entry.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {/* Entry header */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ color: '#ef4444', fontSize: 14, marginTop: 1 }}>⚠</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1' }}>
                      #{entry.id} · {entry.action} · {formatFriendly(entry.created_at, timezone)}
                    </p>
                    <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                      {breakReason(entry)}
                    </p>
                  </div>
                </div>

                {/* Annotation area */}
                {/* isEditing: annotation exists but admin is actively editing it (draft populated) */}
                {isAnnotated && !(canAnnotate && draft !== '') ? (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '8px 12px' }}>
                    <p style={{ fontSize: 10, color: '#e2e8f0', marginBottom: 4 }}>{entry.chain_annotation}</p>
                    {isLocked ? (
                      <p style={{ fontSize: 9, color: '#475569' }}>
                        🔒 Locked · Saved by {entry.annotator_name ?? 'unknown'} · {entry.chain_annotation_at ? formatFriendly(entry.chain_annotation_at, timezone) : ''}
                      </p>
                    ) : (
                      <>
                        <p style={{ fontSize: 9, color: '#64748b' }}>
                          Editable until {editableUntil ? editableUntil.toLocaleString() : ''}
                          {' · '}Saved by {entry.annotator_name ?? 'unknown'}
                        </p>
                        {canAnnotate && (
                          <button
                            onClick={() => setAnnotationDrafts(prev => ({ ...prev, [entry.id]: entry.chain_annotation ?? '' }))}
                            style={{ fontSize: 9, color: '#42a5f5', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}
                          >
                            Edit explanation
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : canAnnotate ? (
                  <div>
                    <textarea
                      value={draft}
                      onChange={e => setAnnotationDrafts(prev => ({ ...prev, [entry.id]: e.target.value }))}
                      placeholder="Add an official explanation for this chain break…"
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 6, color: '#e2e8f0', fontSize: 10, padding: '8px 10px',
                        resize: 'vertical', minHeight: 56, fontFamily: 'inherit', boxSizing: 'border-box',
                      }}
                    />
                    {errMsg && <p style={{ fontSize: 9, color: '#ef4444', marginTop: 3 }}>{errMsg}</p>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <span style={{ fontSize: 9, color: '#475569' }}>Written once · editable for 24h after saving · locked permanently after</span>
                      <button
                        onClick={() => handleSaveAnnotation(entry.id)}
                        disabled={saving || !draft.trim()}
                        style={{
                          background: draft.trim() ? '#ef4444' : 'rgba(239,68,68,0.3)',
                          color: '#fff', border: 'none', borderRadius: 4, fontSize: 10,
                          padding: '5px 12px', cursor: draft.trim() ? 'pointer' : 'default',
                        }}
                      >
                        {saving ? 'Saving…' : 'Save to record'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}>No official explanation added yet.</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Action group pills */}
        {Object.entries(GROUP_META).map(([key, meta]) => {
          const active = groupFilter === key
          return (
            <button
              key={key}
              onClick={() => setParam('group', active ? null : key)}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${active ? meta.color : 'rgba(255,255,255,0.08)'}`,
                background: active ? `${meta.color}18` : 'rgba(13,20,40,0.5)',
                color: active ? meta.color : '#64748b', transition: 'all 0.15s',
              }}
            >
              {meta.label}
            </button>
          )
        })}

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

        {/* Date presets */}
        {DATE_PRESETS.map(({ key, label }) => {
          const active = datePreset === key
          return (
            <button
              key={key}
              onClick={() => setParam('date', active ? null : key)}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${active ? '#42a5f5' : 'rgba(255,255,255,0.08)'}`,
                background: active ? 'rgba(66,165,245,0.12)' : 'rgba(13,20,40,0.5)',
                color: active ? '#42a5f5' : '#64748b', transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          )
        })}

        {hasFilters && (
          <button onClick={clearFilters} style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>
            Clear filters
          </button>
        )}

        {hasFilters && (
          <span style={{ fontSize: 11, color: '#475569', marginLeft: 4 }}>
            {filteredCount} of {totalCount} events
          </span>
        )}
        <ExportButton dataType="audit_trail" canExport={canExport} recordCount={hasFilters ? filteredCount : totalCount} />
      </div>

      {/* Timeline */}
      <div className="gs au1" style={{ padding: 0, overflow: 'hidden', marginBottom: totalPages > 1 ? 16 : 0 }}>
        {entries.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 28, marginBottom: 12 }}>⛓</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>
              {hasFilters ? 'No events match your filters' : 'No audit events yet'}
            </p>
            <p style={{ fontSize: 12, color: '#475569' }}>
              {hasFilters
                ? <button onClick={clearFilters} style={{ color: '#42a5f5', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>Clear filters →</button>
                : 'Launch a scan or change a finding status to start building the chain.'}
            </p>
          </div>
        ) : (
          byDate.map(({ date, items }) => (
            <div key={date}>
              <div style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{date}</span>
              </div>
              {items.map((entry, idx) => {
                const meta      = ACTION_META[entry.action] ?? { label: entry.action, icon: '·', color: '#64748b' }
                const detail    = parseDetail(entry.detail)
                const summary   = formatDetail(entry.action, detail)
                const isExpanded = expanded === entry.id
                const isLast    = idx === items.length - 1

                return (
                  <div key={entry.id} style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
                    <div
                      onClick={() => setExpanded(isExpanded ? null : entry.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${meta.color}18`, border: `1px solid ${meta.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, color: meta.color }}>
                        {meta.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                          {summary && <span style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{summary}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: '#334155', marginTop: 2, fontFamily: 'monospace' }}>
                          {formatFriendly(entry.created_at, timezone)}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>{isExpanded ? '▴' : '▾'}</span>
                    </div>

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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#475569' }}>
            Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filteredCount)} of {filteredCount} event{filteredCount !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="btn-s" style={{ fontSize: 11, padding: '6px 14px', opacity: page <= 1 ? 0.3 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}>
              ← Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
              .reduce<(number | '…')[]>((acc, n, i, arr) => {
                if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…')
                acc.push(n)
                return acc
              }, [])
              .map((n, i) =>
                n === '…' ? (
                  <span key={`el-${i}`} style={{ fontSize: 11, color: '#334155', padding: '6px 4px', alignSelf: 'center' }}>…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n as number)} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: n === page ? '#1976d2' : 'rgba(255,255,255,0.05)', color: n === page ? '#fff' : '#94a3b8', fontWeight: n === page ? 700 : 400 }}>
                    {n}
                  </button>
                )
              )}
            <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="btn-s" style={{ fontSize: 11, padding: '6px 14px', opacity: page >= totalPages ? 0.3 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
