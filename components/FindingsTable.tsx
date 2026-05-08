'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import ExportButton from './ExportButton'

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
  scans: { id: string; scan_type: string; attack_surfaces: { name: string; target_url: string } | null } | null
}

type SavedView = {
  id: string
  name: string
  filters_json: Record<string, string>
  created_at: string
}

const SEV_ORDER  = ['critical', 'high', 'medium', 'low', 'info']
const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#64748b',
}
const STATUS_ALL = ['open', 'in_progress', 'remediated', 'verified_fixed', 'accepted_risk', 'false_positive']
type SortKey = 'title' | 'severity' | 'cvss_score' | 'status' | 'created_at' | 'owasp_category'

// Columns sortable server-side (joined columns excluded)
const SERVER_SORTABLE = new Set<SortKey>(['title', 'severity', 'cvss_score', 'status', 'created_at', 'owasp_category'])

function parseSet(raw: string | null): Set<string> {
  if (!raw) return new Set()
  return new Set(raw.split(',').filter(Boolean))
}

export default function FindingsTable({
  findings,
  filteredCount,
  totalCount,
  page,
  pageSize,
  sevCounts,
  availableTargets,
  availableScanTypes,
  canExport,
}: {
  findings: Finding[]
  filteredCount: number
  totalCount: number
  page: number
  pageSize: number
  sevCounts: Record<string, number>
  availableTargets: string[]
  availableScanTypes: string[]
  canExport: boolean
}) {
  const router      = useRouter()
  const searchParams = useSearchParams()

  const severities = parseSet(searchParams.get('sev'))
  const statuses   = parseSet(searchParams.get('status'))
  const target     = searchParams.get('target') ?? ''
  const scanType   = searchParams.get('scan') ?? ''
  const sortKey    = (searchParams.get('sort') ?? 'created_at') as SortKey
  const sortDir    = (searchParams.get('dir') ?? 'desc') as 'asc' | 'desc'

  // Local search state — synced to URL with 300 ms debounce
  const [localSearch, setLocalSearch] = useState(searchParams.get('q') ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep localSearch in sync when URL changes externally (e.g. saved view applied)
  useEffect(() => {
    setLocalSearch(searchParams.get('q') ?? '')
  }, [searchParams.get('q')])

  // Saved views state
  const [savedViews, setSavedViews]   = useState<SavedView[]>([])
  const [saveOpen, setSaveOpen]       = useState(false)
  const [saveName, setSaveName]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editName, setEditName]       = useState('')
  const [editSaving, setEditSaving]   = useState(false)

  useEffect(() => {
    fetch('/api/saved-views').then(r => r.ok ? r.json() : []).then(setSavedViews).catch(() => {})
  }, [])

  const setParam = useCallback((key: string, value: string | null, resetPage = true) => {
    const p = new URLSearchParams(searchParams.toString())
    if (value) p.set(key, value); else p.delete(key)
    if (resetPage) p.delete('p')
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, searchParams])

  // Debounced search: update local state immediately, sync URL after 300 ms
  function handleSearchChange(v: string) {
    setLocalSearch(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const p = new URLSearchParams(searchParams.toString())
      if (v.trim()) p.set('q', v.trim()); else p.delete('q')
      p.delete('p')
      router.replace(`?${p.toString()}`, { scroll: false })
    }, 300)
  }

  const toggleSev = useCallback((s: string) => {
    const next = new Set(severities); next.has(s) ? next.delete(s) : next.add(s)
    setParam('sev', next.size ? [...next].join(',') : null)
  }, [severities, setParam])

  const toggleStatus = useCallback((s: string) => {
    const next = new Set(statuses); next.has(s) ? next.delete(s) : next.add(s)
    setParam('status', next.size ? [...next].join(',') : null)
  }, [statuses, setParam])

  const setSort = useCallback((key: SortKey) => {
    if (!SERVER_SORTABLE.has(key)) return
    const dir: 'asc' | 'desc' = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
    const p = new URLSearchParams(searchParams.toString())
    p.set('sort', key); p.set('dir', dir); p.delete('p')
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [sortKey, sortDir, searchParams, router])

  const setPage = useCallback((p: number) => {
    setParam('p', p > 1 ? String(p) : null, false)
  }, [setParam])

  const clearAll = useCallback(() => {
    setLocalSearch('')
    router.replace('?', { scroll: false })
  }, [router])

  const applyView = useCallback((view: SavedView) => {
    setLocalSearch(view.filters_json.q ?? '')
    const p = new URLSearchParams()
    Object.entries(view.filters_json).forEach(([k, v]) => { if (v) p.set(k, v) })
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router])

  const currentFilters = useCallback((): Record<string, string> => {
    const f: Record<string, string> = {}
    const q = localSearch.trim()
    if (q) f.q = q
    if (severities.size) f.sev = [...severities].join(',')
    if (statuses.size) f.status = [...statuses].join(',')
    if (target) f.target = target
    if (scanType) f.scan = scanType
    if (sortKey !== 'created_at') f.sort = sortKey
    if (sortDir !== 'desc') f.dir = sortDir
    return f
  }, [localSearch, severities, statuses, target, scanType, sortKey, sortDir])

  const saveView = useCallback(async () => {
    if (!saveName.trim()) return
    setSaving(true)
    const res = await fetch('/api/saved-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: saveName.trim(), filters_json: currentFilters() }),
    })
    if (res.ok) { const v = await res.json(); setSavedViews(prev => [...prev, v]) }
    setSaving(false); setSaveOpen(false); setSaveName('')
  }, [saveName, currentFilters])

  const deleteView = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/saved-views/${id}`, { method: 'DELETE' })
    setSavedViews(prev => prev.filter(v => v.id !== id))
    if (editingId === id) setEditingId(null)
  }, [editingId])

  const saveEdit = useCallback(async (id: string, updateFilters: boolean) => {
    if (!editName.trim()) return
    setEditSaving(true)
    const body: Record<string, unknown> = { name: editName.trim() }
    if (updateFilters) body.filters_json = currentFilters()
    const res = await fetch(`/api/saved-views/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) setSavedViews(prev => prev.map(v => v.id === id ? {} as SavedView : v).filter(v => v.id))
    if (res.ok) {
      const updated = await res.json()
      setSavedViews(prev => prev.map(v => v.id === id ? updated : v))
    }
    setEditSaving(false); setEditingId(null)
  }, [editName, currentFilters])

  const hasFilters = severities.size > 0 || statuses.size > 0 || target || scanType || localSearch.trim()
  const totalPages = Math.ceil(filteredCount / pageSize)

  function SortTh({ col, label, style: s }: { col: SortKey; label: string; style?: React.CSSProperties }) {
    const active = sortKey === col
    const sortable = SERVER_SORTABLE.has(col)
    return (
      <th
        onClick={() => sortable && setSort(col)}
        style={{ cursor: sortable ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap', ...s }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          {sortable && (
            <span style={{ opacity: active ? 1 : 0.25, fontSize: 9 }}>
              {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
            </span>
          )}
        </span>
      </th>
    )
  }

  return (
    <>
      {/* Saved views bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, flexShrink: 0 }}>Saved Views</span>
          {savedViews.length === 0 && (
            <span style={{ fontSize: 11, color: '#334155', fontStyle: 'italic' }}>None yet — filter and save a view below</span>
          )}
          {savedViews.map(view => (
            <div key={view.id} style={{ position: 'relative', display: 'inline-flex' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 6, border: '1px solid rgba(66,165,245,0.3)', background: 'rgba(66,165,245,0.06)', overflow: 'hidden' }}>
                <button onClick={() => applyView(view)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: 'none', border: 'none', color: '#42a5f5' }}>
                  <span style={{ fontSize: 10 }}>⊞</span>{view.name}
                </button>
                <button onClick={(e) => { setEditingId(view.id); setEditName(view.name); e.stopPropagation() }} style={{ padding: '5px 6px', background: 'none', border: 'none', borderLeft: '1px solid rgba(66,165,245,0.15)', cursor: 'pointer', color: '#42a5f5', opacity: 0.6, fontSize: 11 }}>✎</button>
                <button onClick={(e) => deleteView(view.id, e)} style={{ padding: '5px 6px', background: 'none', border: 'none', borderLeft: '1px solid rgba(66,165,245,0.15)', cursor: 'pointer', color: '#64748b', opacity: 0.6, fontSize: 13 }}>×</button>
              </div>
              {editingId === view.id && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, background: '#0d1428', border: '1px solid rgba(66,165,245,0.35)', borderRadius: 10, padding: 14, width: 260, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Edit View</p>
                  <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Escape' && setEditingId(null)} placeholder="View name" style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, fontSize: 12, color: '#e2e8f0', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => saveEdit(view.id, false)} disabled={editSaving || !editName.trim()} style={{ padding: '7px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#1976d2', color: '#fff', border: 'none', cursor: 'pointer', opacity: !editName.trim() ? 0.5 : 1 }}>{editSaving ? '…' : '✓ Rename only'}</button>
                    <button onClick={() => saveEdit(view.id, true)} disabled={editSaving || !editName.trim()} style={{ padding: '7px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer', opacity: !editName.trim() ? 0.5 : 1 }}>{editSaving ? '…' : '↺ Rename + overwrite filters'}</button>
                    <button onClick={() => setEditingId(null)} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, background: 'none', color: '#64748b', border: 'none', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {hasFilters && !saveOpen && (
            <button onClick={() => { setSaveOpen(true); setSaveName('') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, border: '1px dashed rgba(255,255,255,0.15)', background: 'transparent', color: '#64748b' }}>
              + Save current view
            </button>
          )}
          {saveOpen && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 10px', borderRadius: 8, border: '1px solid rgba(66,165,245,0.4)', background: 'rgba(66,165,245,0.06)' }}>
              <input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveView(); if (e.key === 'Escape') setSaveOpen(false) }} placeholder="View name…" style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: '#e2e8f0', width: 140 }} />
              <button onClick={saveView} disabled={saving || !saveName.trim()} style={{ padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: '#1976d2', color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: !saveName.trim() ? 0.5 : 1 }}>{saving ? '…' : 'Save'}</button>
              <button onClick={() => setSaveOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
          )}
        </div>
      </div>

      {/* Severity pills — counts from server (unfiltered) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SEV_ORDER.map(sev => {
          const active = severities.has(sev)
          const color  = SEV_COLOR[sev]
          const count  = sevCounts[sev] ?? 0
          return (
            <button key={sev} onClick={() => toggleSev(sev)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`, background: active ? `${color}18` : 'rgba(13,20,40,0.5)', transition: 'all 0.15s' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, opacity: count === 0 ? 0.3 : 1 }} />
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: active ? color : '#94a3b8', letterSpacing: '0.04em' }}>{sev}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: active ? color : '#e2e8f0' }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#475569', pointerEvents: 'none' }}>🔍</span>
          <input
            value={localSearch}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search title, OWASP…"
            style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, background: 'rgba(13,20,40,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 12, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {STATUS_ALL.map(s => {
            const active = statuses.has(s)
            const colors: Record<string, string> = { open: '#ef4444', in_progress: '#f59e0b', remediated: '#22c55e', verified_fixed: '#4ade80', accepted_risk: '#8b5cf6', false_positive: '#64748b' }
            const c = colors[s] ?? '#64748b'
            return (
              <button key={s} onClick={() => toggleStatus(s)} style={{ padding: '7px 11px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600, border: `1px solid ${active ? c : 'rgba(255,255,255,0.08)'}`, background: active ? `${c}18` : 'rgba(13,20,40,0.5)', color: active ? c : '#64748b', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                {s.replace(/_/g, ' ')}
              </button>
            )
          })}
        </div>
        {availableTargets.length > 0 && (
          <Select value={target} onChange={v => setParam('target', v || null)} placeholder="All targets">
            {availableTargets.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}
        {availableScanTypes.length > 0 && (
          <Select value={scanType} onChange={v => setParam('scan', v || null)} placeholder="All scan types">
            {availableScanTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}
      </div>

      {/* Active chips + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Showing <strong style={{ color: '#e2e8f0' }}>{findings.length}</strong> of <strong style={{ color: '#e2e8f0' }}>{filteredCount}</strong> findings
          {filteredCount !== totalCount && <span style={{ color: '#475569' }}> (filtered from {totalCount})</span>}
        </span>
        {hasFilters && (
          <>
            <span style={{ color: '#334155', fontSize: 11 }}>·</span>
            {[...severities].map(s => <Chip key={s} label={s} color={SEV_COLOR[s]} onRemove={() => toggleSev(s)} />)}
            {[...statuses].map(s => <Chip key={s} label={s.replace(/_/g, ' ')} color="#64748b" onRemove={() => toggleStatus(s)} />)}
            {target && <Chip label={target} color="#3b82f6" onRemove={() => setParam('target', null)} />}
            {scanType && <Chip label={scanType} color="#8b5cf6" onRemove={() => setParam('scan', null)} />}
            {localSearch.trim() && <Chip label={`"${localSearch.trim()}"`} color="#06b6d4" onRemove={() => handleSearchChange('')} />}
            <button onClick={clearAll} style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>
              Clear all
            </button>
          </>
        )}
        <ExportButton dataType="findings" canExport={canExport} />
      </div>

      {/* Table */}
      <div className="gs au1" style={{ padding: 0, overflow: 'hidden' }}>
        {findings.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <SortTh col="title"          label="Title" />
                <SortTh col="severity"       label="Severity" />
                <SortTh col="cvss_score"     label="CVSS" />
                <SortTh col="owasp_category" label="OWASP" />
                <th style={{ whiteSpace: 'nowrap' }}>Target</th>
                <th style={{ whiteSpace: 'nowrap' }}>Scan</th>
                <SortTh col="status"         label="Status" />
                <SortTh col="created_at"     label="Found" />
              </tr>
            </thead>
            <tbody>
              {findings.map(f => (
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
                    <span onClick={() => toggleSev(f.severity)} style={{ cursor: 'pointer', padding: '2px 7px', borderRadius: 3, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: `${SEV_COLOR[f.severity]}18`, border: `1px solid ${SEV_COLOR[f.severity]}40`, color: SEV_COLOR[f.severity] }}>
                      {f.severity}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{f.cvss_score ?? '—'}</td>
                  <td>
                    {f.owasp_category
                      ? <button onClick={() => handleSearchChange(f.owasp_category!)} style={{ fontSize: 10, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>{f.owasp_category}</button>
                      : <span style={{ color: '#334155' }}>—</span>}
                  </td>
                  <td>
                    {f.scans?.attack_surfaces?.name
                      ? <button onClick={() => setParam('target', f.scans!.attack_surfaces!.name)} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>{f.scans.attack_surfaces.name}</button>
                      : <span style={{ color: '#334155' }}>—</span>}
                  </td>
                  <td>
                    {f.scans?.scan_type
                      ? <button onClick={() => setParam('scan', f.scans!.scan_type)} style={{ fontSize: 10, color: '#8b5cf6', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}>{f.scans.scan_type}</button>
                      : <span style={{ color: '#334155' }}>—</span>}
                  </td>
                  <td>
                    <button onClick={() => toggleStatus(f.status)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
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
        ) : totalCount === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No findings yet</p>
            <p style={{ fontSize: 13 }}>Run a scan to discover vulnerabilities.</p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#475569' }}>
            <p style={{ fontSize: 14, marginBottom: 8 }}>No findings match your filters</p>
            <button onClick={clearAll} style={{ fontSize: 12, color: '#42a5f5', background: 'none', border: 'none', cursor: 'pointer' }}>Clear all filters →</button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#475569' }}>
            Page {page} of {totalPages} · {filteredCount} results
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="btn-s"
              style={{ fontSize: 11, padding: '6px 14px', opacity: page <= 1 ? 0.3 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}
            >
              ← Previous
            </button>
            {/* Page number chips (show up to 7 around current) */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
              .reduce<(number | '…')[]>((acc, n, i, arr) => {
                if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…')
                acc.push(n)
                return acc
              }, [])
              .map((n, i) =>
                n === '…' ? (
                  <span key={`ellipsis-${i}`} style={{ fontSize: 11, color: '#334155', padding: '6px 4px', alignSelf: 'center' }}>…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n as number)}
                    style={{
                      fontSize: 11, padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: n === page ? '#1976d2' : 'rgba(255,255,255,0.05)',
                      color: n === page ? '#fff' : '#94a3b8',
                      fontWeight: n === page ? 700 : 400,
                    }}
                  >
                    {n}
                  </button>
                )
              )}
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="btn-s"
              style={{ fontSize: 11, padding: '6px 14px', opacity: page >= totalPages ? 0.3 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Select({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: '7px 10px', background: 'rgba(13,20,40,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11, color: value ? '#e2e8f0' : '#64748b', cursor: 'pointer', outline: 'none' }}>
      <option value="">{placeholder}</option>
      {children}
    </select>
  )
}

function Chip({ label, color, onRemove }: { label: string; color: string; onRemove: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 8px', borderRadius: 4, background: `${color}18`, border: `1px solid ${color}40`, color }}>
      {label}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label?: string }> = {
    open:           { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    in_progress:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    remediated:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    verified_fixed: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', label: '✓ verified fixed' },
    accepted_risk:  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', label: 'accepted risk' },
    false_positive: { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: 'false positive' },
  }
  const s = map[status] ?? { color: '#64748b', bg: 'rgba(100,116,139,0.1)' }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      {s.label ?? status.replace(/_/g, ' ')}
    </span>
  )
}
