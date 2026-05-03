'use client'
import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'

type Finding = {
  id: string
  title: string
  severity: string
  cvss_score: number | null
  owasp_category: string | null
  status: string
  created_at: string
  finding_hash: string | null
  ai_model: string | null
  ai_confidence: number | null
  scans: { id: string; scan_type: string; attack_surfaces: { name: string; target_url: string } | null } | null
}

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info']
const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#64748b',
}
const STATUS_ALL = ['open', 'in_progress', 'remediated']

type SortKey = 'title' | 'severity' | 'cvss_score' | 'status' | 'created_at' | 'target' | 'scan_type' | 'owasp_category'
type SortDir = 'asc' | 'desc'

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
const STATUS_RANK: Record<string, number> = { open: 0, in_progress: 1, remediated: 2 }

export default function FindingsTable({ findings }: { findings: Finding[] }) {
  const [search, setSearch] = useState('')
  const [severities, setSeverities] = useState<Set<string>>(new Set())
  const [statuses, setStatuses] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState('')
  const [scanType, setScanType] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'created_at', dir: 'desc' })

  // Unique values for dropdowns
  const targets = useMemo(() => {
    const seen = new Set<string>()
    findings.forEach(f => {
      const n = f.scans?.attack_surfaces?.name
      if (n) seen.add(n)
    })
    return [...seen].sort()
  }, [findings])

  const scanTypes = useMemo(() => {
    const seen = new Set<string>()
    findings.forEach(f => { if (f.scans?.scan_type) seen.add(f.scans.scan_type) })
    return [...seen].sort()
  }, [findings])

  const sevCounts = useMemo(() =>
    SEV_ORDER.reduce((acc, s) => { acc[s] = findings.filter(f => f.severity === s).length; return acc }, {} as Record<string, number>)
  , [findings])

  // Toggle helpers
  const toggleSev = useCallback((s: string) => {
    setSeverities(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }, [])

  const toggleStatus = useCallback((s: string) => {
    setStatuses(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setSearch('')
    setSeverities(new Set())
    setStatuses(new Set())
    setTarget('')
    setScanType('')
  }, [])

  const q = search.toLowerCase().trim()

  // Filter
  const filtered = useMemo(() => {
    return findings.filter(f => {
      if (severities.size > 0 && !severities.has(f.severity)) return false
      if (statuses.size > 0 && !statuses.has(f.status)) return false
      if (target && f.scans?.attack_surfaces?.name !== target) return false
      if (scanType && f.scans?.scan_type !== scanType) return false
      if (q) {
        const haystack = [
          f.title,
          f.owasp_category ?? '',
          f.scans?.attack_surfaces?.name ?? '',
          f.scans?.attack_surfaces?.target_url ?? '',
          f.scans?.scan_type ?? '',
          f.ai_model ?? '',
          f.status,
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [findings, severities, statuses, target, scanType, q])

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sort.key) {
        case 'severity':    cmp = (SEV_RANK[a.severity] ?? 99) - (SEV_RANK[b.severity] ?? 99); break
        case 'cvss_score':  cmp = (a.cvss_score ?? 0) - (b.cvss_score ?? 0); break
        case 'status':      cmp = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9); break
        case 'created_at':  cmp = a.created_at.localeCompare(b.created_at); break
        case 'title':       cmp = a.title.localeCompare(b.title); break
        case 'target':      cmp = (a.scans?.attack_surfaces?.name ?? '').localeCompare(b.scans?.attack_surfaces?.name ?? ''); break
        case 'scan_type':   cmp = (a.scans?.scan_type ?? '').localeCompare(b.scans?.scan_type ?? ''); break
        case 'owasp_category': cmp = (a.owasp_category ?? '').localeCompare(b.owasp_category ?? ''); break
      }
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sort])

  const hasFilters = severities.size > 0 || statuses.size > 0 || target || scanType || q

  function SortTh({ col, label, style }: { col: SortKey; label: string; style?: React.CSSProperties }) {
    const active = sort.key === col
    return (
      <th
        onClick={() => setSort(s => ({ key: col, dir: s.key === col && s.dir === 'asc' ? 'desc' : 'asc' }))}
        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          <span style={{ opacity: active ? 1 : 0.25, fontSize: 9, lineHeight: 1 }}>
            {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </span>
      </th>
    )
  }

  return (
    <>
      {/* Severity pills — clickable toggles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SEV_ORDER.map(sev => {
          const active = severities.has(sev)
          const color = SEV_COLOR[sev]
          return (
            <button
              key={sev}
              onClick={() => toggleSev(sev)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
                background: active ? `${color}18` : 'rgba(13,20,40,0.5)',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, opacity: sevCounts[sev] === 0 ? 0.3 : 1 }} />
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: active ? color : '#94a3b8', letterSpacing: '0.04em' }}>{sev}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: active ? color : '#e2e8f0' }}>{sevCounts[sev]}</span>
            </button>
          )
        })}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#475569', pointerEvents: 'none' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, OWASP, target, model…"
            style={{
              width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8,
              background: 'rgba(13,20,40,0.7)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, fontSize: 12, color: '#e2e8f0', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUS_ALL.map(s => {
            const active = statuses.has(s)
            const colors: Record<string, string> = { open: '#ef4444', in_progress: '#f59e0b', remediated: '#22c55e' }
            const c = colors[s]
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                style={{
                  padding: '7px 11px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  border: `1px solid ${active ? c : 'rgba(255,255,255,0.08)'}`,
                  background: active ? `${c}18` : 'rgba(13,20,40,0.5)',
                  color: active ? c : '#64748b',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.replace('_', ' ')}
              </button>
            )
          })}
        </div>

        {/* Target dropdown */}
        {targets.length > 0 && (
          <Select value={target} onChange={setTarget} placeholder="All targets">
            {targets.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}

        {/* Scan type dropdown */}
        {scanTypes.length > 0 && (
          <Select value={scanType} onChange={setScanType} placeholder="All scan types">
            {scanTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}
      </div>

      {/* Active chips + count */}
      {(hasFilters || true) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Showing <strong style={{ color: '#e2e8f0' }}>{sorted.length}</strong> of <strong style={{ color: '#e2e8f0' }}>{findings.length}</strong> findings
          </span>
          {hasFilters && (
            <>
              <span style={{ color: '#334155', fontSize: 11 }}>·</span>
              {[...severities].map(s => (
                <Chip key={s} label={s} color={SEV_COLOR[s]} onRemove={() => toggleSev(s)} />
              ))}
              {[...statuses].map(s => (
                <Chip key={s} label={s.replace('_', ' ')} color="#64748b" onRemove={() => toggleStatus(s)} />
              ))}
              {target && <Chip label={target} color="#3b82f6" onRemove={() => setTarget('')} />}
              {scanType && <Chip label={scanType} color="#8b5cf6" onRemove={() => setScanType('')} />}
              {q && <Chip label={`"${search}"`} color="#06b6d4" onRemove={() => setSearch('')} />}
              <button
                onClick={clearAll}
                style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}
              >
                Clear all
              </button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div className="gs au1" style={{ padding: 0, overflow: 'hidden' }}>
        {sorted.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <SortTh col="title" label="Title" />
                <SortTh col="severity" label="Severity" />
                <SortTh col="cvss_score" label="CVSS" />
                <SortTh col="owasp_category" label="OWASP" />
                <SortTh col="target" label="Target" />
                <SortTh col="scan_type" label="Scan" />
                <SortTh col="status" label="Status" />
                <SortTh col="created_at" label="Found" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(f => (
                <tr key={f.id} style={{ cursor: 'pointer' }}>
                  <td style={{ maxWidth: 240 }}>
                    <Link href={`/dashboard/findings/${f.id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.title}
                    </Link>
                    {f.finding_hash && (
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#3b5f8a', display: 'block', marginTop: 1 }}>
                        {f.finding_hash.slice(0, 14)}…
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      onClick={() => toggleSev(f.severity)}
                      style={{
                        cursor: 'pointer', padding: '2px 7px', borderRadius: 3, fontSize: 10,
                        fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                        background: `${SEV_COLOR[f.severity]}18`,
                        border: `1px solid ${SEV_COLOR[f.severity]}40`,
                        color: SEV_COLOR[f.severity],
                      }}
                    >
                      {f.severity}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                    {f.cvss_score ?? '—'}
                  </td>
                  <td>
                    {f.owasp_category ? (
                      <button
                        onClick={() => setSearch(f.owasp_category!)}
                        style={{ fontSize: 10, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                        title="Filter by this category"
                      >
                        {f.owasp_category}
                      </button>
                    ) : <span style={{ color: '#334155' }}>—</span>}
                  </td>
                  <td>
                    {f.scans?.attack_surfaces?.name ? (
                      <button
                        onClick={() => setTarget(f.scans!.attack_surfaces!.name)}
                        style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                        title="Filter by this target"
                      >
                        {f.scans.attack_surfaces.name}
                      </button>
                    ) : <span style={{ color: '#334155' }}>—</span>}
                  </td>
                  <td>
                    {f.scans?.scan_type ? (
                      <button
                        onClick={() => setScanType(f.scans!.scan_type)}
                        style={{ fontSize: 10, color: '#8b5cf6', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}
                        title="Filter by this scan type"
                      >
                        {f.scans.scan_type}
                      </button>
                    ) : <span style={{ color: '#334155' }}>—</span>}
                  </td>
                  <td>
                    <button
                      onClick={() => toggleStatus(f.status)}
                      style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                      title="Filter by this status"
                    >
                      <StatusPill status={f.status} />
                    </button>
                  </td>
                  <td style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {new Date(f.created_at).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : findings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No findings yet</p>
            <p style={{ fontSize: 13 }}>Run a scan to discover vulnerabilities.</p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#475569' }}>
            <p style={{ fontSize: 14, marginBottom: 8 }}>No findings match your filters</p>
            <button onClick={clearAll} style={{ fontSize: 12, color: '#42a5f5', background: 'none', border: 'none', cursor: 'pointer' }}>
              Clear all filters →
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function Select({ value, onChange, placeholder, children }: {
  value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '7px 10px', background: 'rgba(13,20,40,0.7)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6, fontSize: 11, color: value ? '#e2e8f0' : '#64748b', cursor: 'pointer', outline: 'none',
      }}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  )
}

function Chip({ label, color, onRemove }: { label: string; color: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, padding: '3px 8px', borderRadius: 4,
      background: `${color}18`, border: `1px solid ${color}40`, color,
    }}>
      {label}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    open:        { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    in_progress: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    remediated:  { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  }
  const s = map[status] ?? { color: '#64748b', bg: 'rgba(100,116,139,0.1)' }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3, color: s.color, background: s.bg }}>
      {status.replace('_', ' ')}
    </span>
  )
}
