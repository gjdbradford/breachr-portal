'use client'
import { useMemo, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

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

type SavedView = {
  id: string
  name: string
  filters_json: Record<string, string>
  created_at: string
}

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info']
const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#64748b',
}
const STATUS_ALL = ['open', 'in_progress', 'remediated', 'verified_fixed', 'accepted_risk']
type SortKey = 'title' | 'severity' | 'cvss_score' | 'status' | 'created_at' | 'target' | 'scan_type' | 'owasp_category'
type SortDir = 'asc' | 'desc'
const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
const STATUS_RANK: Record<string, number> = { open: 0, in_progress: 1, remediated: 2 }

function parseSet(raw: string | null): Set<string> {
  if (!raw) return new Set()
  return new Set(raw.split(',').filter(Boolean))
}

export default function FindingsTable({ findings }: { findings: Finding[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // All filter state lives in the URL
  const search     = searchParams.get('q') ?? ''
  const severities = parseSet(searchParams.get('sev'))
  const statuses   = parseSet(searchParams.get('status'))
  const target     = searchParams.get('target') ?? ''
  const scanType   = searchParams.get('scan') ?? ''
  const sortKey    = (searchParams.get('sort') ?? 'created_at') as SortKey
  const sortDir    = (searchParams.get('dir') ?? 'desc') as SortDir

  // Saved views state
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  // Edit popover: which view id is open
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    fetch('/api/saved-views')
      .then(r => r.ok ? r.json() : [])
      .then(setSavedViews)
      .catch(() => {})
  }, [])

  const setParam = useCallback((key: string, value: string | null) => {
    const p = new URLSearchParams(searchParams.toString())
    if (value) p.set(key, value); else p.delete(key)
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router, searchParams])

  const setSearch   = (v: string) => setParam('q', v || null)
  const setTarget   = (v: string) => setParam('target', v || null)
  const setScanType = (v: string) => setParam('scan', v || null)

  const toggleSev = useCallback((s: string) => {
    const next = new Set(severities); next.has(s) ? next.delete(s) : next.add(s)
    setParam('sev', next.size ? [...next].join(',') : null)
  }, [severities, setParam])

  const toggleStatus = useCallback((s: string) => {
    const next = new Set(statuses); next.has(s) ? next.delete(s) : next.add(s)
    setParam('status', next.size ? [...next].join(',') : null)
  }, [statuses, setParam])

  const setSort = useCallback((key: SortKey) => {
    const dir: SortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
    const p = new URLSearchParams(searchParams.toString())
    p.set('sort', key); p.set('dir', dir)
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [sortKey, sortDir, searchParams, router])

  const clearAll = useCallback(() => router.replace('?', { scroll: false }), [router])

  // Apply a saved view — replace all params with the view's filters
  const applyView = useCallback((view: SavedView) => {
    const p = new URLSearchParams()
    Object.entries(view.filters_json).forEach(([k, v]) => { if (v) p.set(k, v) })
    router.replace(`?${p.toString()}`, { scroll: false })
  }, [router])

  const saveView = useCallback(async () => {
    if (!saveName.trim()) return
    setSaving(true)
    const filters_json: Record<string, string> = {}
    if (search) filters_json.q = search
    if (severities.size) filters_json.sev = [...severities].join(',')
    if (statuses.size) filters_json.status = [...statuses].join(',')
    if (target) filters_json.target = target
    if (scanType) filters_json.scan = scanType
    if (sortKey !== 'created_at') filters_json.sort = sortKey
    if (sortDir !== 'desc') filters_json.dir = sortDir

    const res = await fetch('/api/saved-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: saveName.trim(), filters_json }),
    })
    if (res.ok) {
      const newView = await res.json()
      setSavedViews(prev => [...prev, newView])
    }
    setSaving(false)
    setSaveOpen(false)
    setSaveName('')
  }, [saveName, search, severities, statuses, target, scanType, sortKey, sortDir])

  const deleteView = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/saved-views/${id}`, { method: 'DELETE' })
    setSavedViews(prev => prev.filter(v => v.id !== id))
    if (editingId === id) setEditingId(null)
  }, [editingId])

  const openEdit = useCallback((view: SavedView, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(view.id)
    setEditName(view.name)
  }, [])

  const currentFilters = useCallback((): Record<string, string> => {
    const f: Record<string, string> = {}
    if (search) f.q = search
    if (severities.size) f.sev = [...severities].join(',')
    if (statuses.size) f.status = [...statuses].join(',')
    if (target) f.target = target
    if (scanType) f.scan = scanType
    if (sortKey !== 'created_at') f.sort = sortKey
    if (sortDir !== 'desc') f.dir = sortDir
    return f
  }, [search, severities, statuses, target, scanType, sortKey, sortDir])

  const saveEdit = useCallback(async (id: string, updateFilters: boolean) => {
    if (!editName.trim()) return
    setEditSaving(true)
    const body: Record<string, unknown> = { name: editName.trim() }
    if (updateFilters) body.filters_json = currentFilters()
    const res = await fetch(`/api/saved-views/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const updated = await res.json()
      setSavedViews(prev => prev.map(v => v.id === id ? updated : v))
    }
    setEditSaving(false)
    setEditingId(null)
  }, [editName, currentFilters])

  // Unique values for dropdowns
  const targets = useMemo(() => {
    const seen = new Set<string>()
    findings.forEach(f => { const n = f.scans?.attack_surfaces?.name; if (n) seen.add(n) })
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

  const q = search.toLowerCase().trim()

  const filtered = useMemo(() => findings.filter(f => {
    if (severities.size > 0 && !severities.has(f.severity)) return false
    if (statuses.size > 0 && !statuses.has(f.status)) return false
    if (target && f.scans?.attack_surfaces?.name !== target) return false
    if (scanType && f.scans?.scan_type !== scanType) return false
    if (q) {
      const hay = [f.title, f.owasp_category ?? '', f.scans?.attack_surfaces?.name ?? '', f.scans?.attack_surfaces?.target_url ?? '', f.scans?.scan_type ?? '', f.ai_model ?? '', f.status].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }), [findings, severities, statuses, target, scanType, q])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'severity':       cmp = (SEV_RANK[a.severity] ?? 99) - (SEV_RANK[b.severity] ?? 99); break
      case 'cvss_score':     cmp = (a.cvss_score ?? 0) - (b.cvss_score ?? 0); break
      case 'status':         cmp = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9); break
      case 'created_at':     cmp = a.created_at.localeCompare(b.created_at); break
      case 'title':          cmp = a.title.localeCompare(b.title); break
      case 'target':         cmp = (a.scans?.attack_surfaces?.name ?? '').localeCompare(b.scans?.attack_surfaces?.name ?? ''); break
      case 'scan_type':      cmp = (a.scans?.scan_type ?? '').localeCompare(b.scans?.scan_type ?? ''); break
      case 'owasp_category': cmp = (a.owasp_category ?? '').localeCompare(b.owasp_category ?? ''); break
    }
    return sortDir === 'asc' ? cmp : -cmp
  }), [filtered, sortKey, sortDir])

  const hasFilters = severities.size > 0 || statuses.size > 0 || target || scanType || q

  function SortTh({ col, label, style }: { col: SortKey; label: string; style?: React.CSSProperties }) {
    const active = sortKey === col
    return (
      <th onClick={() => setSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          <span style={{ opacity: active ? 1 : 0.25, fontSize: 9 }}>{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
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
              {/* The chip */}
              <div
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 0,
                  borderRadius: 6, border: '1px solid rgba(66,165,245,0.3)',
                  background: 'rgba(66,165,245,0.06)', overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => applyView(view)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: 'none', border: 'none', color: '#42a5f5' }}
                >
                  <span style={{ fontSize: 10 }}>⊞</span>
                  {view.name}
                </button>
                {/* Edit pencil */}
                <button
                  onClick={(e) => openEdit(view, e)}
                  title="Edit view"
                  style={{ padding: '5px 6px', background: 'none', border: 'none', borderLeft: '1px solid rgba(66,165,245,0.15)', cursor: 'pointer', color: '#42a5f5', opacity: 0.6, fontSize: 11, lineHeight: 1 }}
                >✎</button>
                {/* Delete */}
                <button
                  onClick={(e) => deleteView(view.id, e)}
                  title="Delete view"
                  style={{ padding: '5px 6px', background: 'none', border: 'none', borderLeft: '1px solid rgba(66,165,245,0.15)', cursor: 'pointer', color: '#64748b', opacity: 0.6, fontSize: 13, lineHeight: 1 }}
                >×</button>
              </div>

              {/* Edit popover */}
              {editingId === view.id && (
                <div
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
                    background: '#0d1428', border: '1px solid rgba(66,165,245,0.35)',
                    borderRadius: 10, padding: 14, width: 260,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                >
                  <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Edit View</p>
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setEditingId(null) }}
                    placeholder="View name"
                    style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, fontSize: 12, color: '#e2e8f0', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      onClick={() => saveEdit(view.id, false)}
                      disabled={editSaving || !editName.trim()}
                      style={{ padding: '7px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#1976d2', color: '#fff', border: 'none', cursor: 'pointer', opacity: !editName.trim() ? 0.5 : 1, textAlign: 'left' }}
                    >
                      {editSaving ? '…' : '✓ Rename only'}
                    </button>
                    <button
                      onClick={() => saveEdit(view.id, true)}
                      disabled={editSaving || !editName.trim()}
                      style={{ padding: '7px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer', opacity: !editName.trim() ? 0.5 : 1, textAlign: 'left' }}
                    >
                      {editSaving ? '…' : '↺ Rename + overwrite filters with current'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, background: 'none', color: '#64748b', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {hasFilters && !saveOpen && (
            <button
              onClick={() => { setSaveOpen(true); setSaveName('') }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, border: '1px dashed rgba(255,255,255,0.15)', background: 'transparent', color: '#64748b', transition: 'all 0.15s' }}
            >
              + Save current view
            </button>
          )}

          {saveOpen && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 10px', borderRadius: 8, border: '1px solid rgba(66,165,245,0.4)', background: 'rgba(66,165,245,0.06)' }}>
              <input
                autoFocus
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveView(); if (e.key === 'Escape') setSaveOpen(false) }}
                placeholder="View name…"
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: '#e2e8f0', width: 140 }}
              />
              <button
                onClick={saveView}
                disabled={saving || !saveName.trim()}
                style={{ padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: '#1976d2', color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: !saveName.trim() ? 0.5 : 1 }}
              >
                {saving ? '…' : 'Save'}
              </button>
              <button onClick={() => setSaveOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
          )}
        </div>
      </div>

      {/* Severity pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SEV_ORDER.map(sev => {
          const active = severities.has(sev)
          const color = SEV_COLOR[sev]
          return (
            <button key={sev} onClick={() => toggleSev(sev)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`, background: active ? `${color}18` : 'rgba(13,20,40,0.5)', transition: 'all 0.15s' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, opacity: sevCounts[sev] === 0 ? 0.3 : 1 }} />
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: active ? color : '#94a3b8', letterSpacing: '0.04em' }}>{sev}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: active ? color : '#e2e8f0' }}>{sevCounts[sev]}</span>
            </button>
          )
        })}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#475569', pointerEvents: 'none' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, OWASP, target, model…" style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, background: 'rgba(13,20,40,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 12, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {STATUS_ALL.map(s => {
            const active = statuses.has(s)
            const colors: Record<string, string> = { open: '#ef4444', in_progress: '#f59e0b', remediated: '#22c55e', verified_fixed: '#4ade80', accepted_risk: '#8b5cf6' }
            const c = colors[s] ?? '#64748b'
            return (
              <button key={s} onClick={() => toggleStatus(s)} style={{ padding: '7px 11px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600, border: `1px solid ${active ? c : 'rgba(255,255,255,0.08)'}`, background: active ? `${c}18` : 'rgba(13,20,40,0.5)', color: active ? c : '#64748b', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                {s.replace('_', ' ')}
              </button>
            )
          })}
        </div>

        {targets.length > 0 && (
          <Select value={target} onChange={setTarget} placeholder="All targets">
            {targets.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}
        {scanTypes.length > 0 && (
          <Select value={scanType} onChange={setScanType} placeholder="All scan types">
            {scanTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}
      </div>

      {/* Active chips + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Showing <strong style={{ color: '#e2e8f0' }}>{sorted.length}</strong> of <strong style={{ color: '#e2e8f0' }}>{findings.length}</strong> findings
        </span>
        {hasFilters && (
          <>
            <span style={{ color: '#334155', fontSize: 11 }}>·</span>
            {[...severities].map(s => <Chip key={s} label={s} color={SEV_COLOR[s]} onRemove={() => toggleSev(s)} />)}
            {[...statuses].map(s => <Chip key={s} label={s.replace('_', ' ')} color="#64748b" onRemove={() => toggleStatus(s)} />)}
            {target && <Chip label={target} color="#3b82f6" onRemove={() => setTarget('')} />}
            {scanType && <Chip label={scanType} color="#8b5cf6" onRemove={() => setScanType('')} />}
            {q && <Chip label={`"${search}"`} color="#06b6d4" onRemove={() => setSearch('')} />}
            <button onClick={clearAll} style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>
              Clear all
            </button>
          </>
        )}
      </div>

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
                    <span onClick={() => toggleSev(f.severity)} style={{ cursor: 'pointer', padding: '2px 7px', borderRadius: 3, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: `${SEV_COLOR[f.severity]}18`, border: `1px solid ${SEV_COLOR[f.severity]}40`, color: SEV_COLOR[f.severity] }}>
                      {f.severity}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{f.cvss_score ?? '—'}</td>
                  <td>
                    {f.owasp_category
                      ? <button onClick={() => setSearch(f.owasp_category!)} style={{ fontSize: 10, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>{f.owasp_category}</button>
                      : <span style={{ color: '#334155' }}>—</span>}
                  </td>
                  <td>
                    {f.scans?.attack_surfaces?.name
                      ? <button onClick={() => setTarget(f.scans!.attack_surfaces!.name)} style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>{f.scans.attack_surfaces.name}</button>
                      : <span style={{ color: '#334155' }}>—</span>}
                  </td>
                  <td>
                    {f.scans?.scan_type
                      ? <button onClick={() => setScanType(f.scans!.scan_type)} style={{ fontSize: 10, color: '#8b5cf6', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}>{f.scans.scan_type}</button>
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
        ) : findings.length === 0 ? (
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
  }
  const s = map[status] ?? { color: '#64748b', bg: 'rgba(100,116,139,0.1)' }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      {s.label ?? status.replace(/_/g, ' ')}
    </span>
  )
}
