'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LaunchScanButton from '@/components/LaunchScanButton'
import { formatFriendly } from '@/lib/format-date'
import UpgradeWallModal from '@/components/UpgradeWallModal'

const TYPE_LABEL: Record<string, string> = {
  webapp: 'Web App',
  api: 'API',
  mobile: 'Mobile',
  network: 'Network',
}

const TYPE_COLOR: Record<string, string> = {
  webapp: '#3b82f6',
  api: '#8b5cf6',
  mobile: '#f59e0b',
  network: '#22c55e',
}

type Surface = {
  id: string
  name: string
  target_url: string
  target_type: string
  active: boolean
  created_at: string
  latestScan: { status: string; completed_at: string | null; progress_pct: number } | null
  openCritical: number
  openTotal: number
}

export default function TargetList({
  surfaces,
  tenantId,
  planId = 'free',
  targetsMax = 1,
  timezone = 'UTC',
}: {
  surfaces: Surface[]
  tenantId: string
  planId?: string
  targetsMax?: number | null
  timezone?: string
}) {
  const [items, setItems] = useState(surfaces)
  const [showAdd, setShowAdd] = useState(false)
  const [showUpgradeWall, setShowUpgradeWall] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all')

  const atTargetLimit = targetsMax !== null && items.length >= targetsMax

  function tryAddTarget() {
    if (atTargetLimit) { setShowUpgradeWall(true); return }
    setShowAdd(true)
  }

  const visible = items.filter(s =>
    filter === 'all' ? true : filter === 'active' ? s.active : !s.active
  )

  function onToggled(id: string, active: boolean) {
    setItems(prev => prev.map(s => s.id === id ? { ...s, active } : s))
  }

  function onAdded(surface: Surface) {
    setItems(prev => [surface, ...prev])
    setShowAdd(false)
  }

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['all', 'active', 'paused'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${filter === f ? 'rgba(25,118,210,0.5)' : 'rgba(255,255,255,0.08)'}`,
              background: filter === f ? 'rgba(25,118,210,0.12)' : 'rgba(13,20,40,0.5)',
              color: filter === f ? '#42a5f5' : '#64748b',
              textTransform: 'capitalize',
            }}
          >
            {f} {f === 'all' ? `(${items.length})` : f === 'active' ? `(${items.filter(s => s.active).length})` : `(${items.filter(s => !s.active).length})`}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={tryAddTarget}
          className="btn-p"
          style={{ fontSize: 13, padding: '8px 18px' }}
        >
          + Add Target
        </button>
      </div>

      {/* Target cards */}
      {visible.length === 0 ? (
        <div className="gs au1" style={{ padding: '60px 24px', textAlign: 'center', color: '#475569' }}>
          <p style={{ fontSize: 14, marginBottom: 8 }}>No {filter !== 'all' ? filter : ''} targets yet</p>
          <button onClick={tryAddTarget} style={{ fontSize: 13, color: '#42a5f5', background: 'none', border: 'none', cursor: 'pointer' }}>
            Add your first target →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(s => (
            <TargetCard key={s.id} surface={s} tenantId={tenantId} onToggled={onToggled} timezone={timezone} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddTargetModal tenantId={tenantId} onAdded={onAdded} onClose={() => setShowAdd(false)} />
      )}

      {showUpgradeWall && (
        <UpgradeWallModal
          reason="target_limit"
          currentPlanId={planId}
          targetsUsed={items.length}
          targetsMax={targetsMax}
          onClose={() => setShowUpgradeWall(false)}
        />
      )}
    </>
  )
}

function TargetCard({ surface: s, tenantId, onToggled, timezone = 'UTC' }: {
  surface: Surface
  tenantId: string
  onToggled: (id: string, active: boolean) => void
  timezone?: string
}) {
  const [toggling, startToggle] = useTransition()
  const typeColor = TYPE_COLOR[s.target_type] ?? '#64748b'

  async function toggle() {
    startToggle(async () => {
      const supabase = createClient()
      const next = !s.active
      await supabase.from('attack_surfaces').update({ active: next }).eq('id', s.id)
      onToggled(s.id, next)
    })
  }

  const scan = s.latestScan
  const scanStatusColor: Record<string, string> = {
    complete: '#22c55e', running: '#42a5f5', queued: '#f59e0b', failed: '#ef4444',
  }

  return (
    <div
      className="gs au1"
      style={{
        padding: '16px 20px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 16,
        alignItems: 'center',
        opacity: s.active ? 1 : 0.55,
        borderLeft: `3px solid ${s.active ? typeColor : '#334155'}`,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Left: info */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: s.active ? '#e2e8f0' : '#64748b' }}>{s.name}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.06em',
            background: `${typeColor}18`, border: `1px solid ${typeColor}40`, color: typeColor,
          }}>
            {TYPE_LABEL[s.target_type] ?? s.target_type}
          </span>
          {!s.active && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3, color: '#64748b', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)' }}>
              PAUSED
            </span>
          )}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b', marginBottom: 8 }}>{s.target_url}</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {scan ? (
            <span style={{ fontSize: 11, color: scanStatusColor[scan.status] ?? '#64748b' }}>
              Last scan: {scan.status}{scan.completed_at ? ` · ${formatFriendly(scan.completed_at, timezone)}` : ''}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: '#475569' }}>No scans yet</span>
          )}
          {s.openCritical > 0 && (
            <span style={{ fontSize: 11, color: '#ef4444' }}>{s.openCritical} critical open</span>
          )}
          {s.openTotal > 0 && s.openCritical === 0 && (
            <span style={{ fontSize: 11, color: '#f59e0b' }}>{s.openTotal} findings open</span>
          )}
          {s.openTotal === 0 && scan?.status === 'complete' && (
            <span style={{ fontSize: 11, color: '#22c55e' }}>✓ No open findings</span>
          )}
          <span style={{ fontSize: 11, color: '#334155' }}>
            Added {formatFriendly(s.created_at, timezone)}
          </span>
        </div>
      </div>

      {/* Right: actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {s.active && (
          <LaunchScanButton
            surfaces={[{ id: s.id, name: s.name, target_url: s.target_url }]}
            tenantId={tenantId}
          />
        )}
        <button
          onClick={toggle}
          disabled={toggling}
          title={s.active ? 'Pause this target' : 'Activate this target'}
          style={{
            padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${s.active ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            background: s.active ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
            color: s.active ? '#ef4444' : '#22c55e',
            transition: 'all 0.15s',
            opacity: toggling ? 0.5 : 1,
          }}
        >
          {toggling ? '…' : s.active ? 'Pause' : 'Activate'}
        </button>
      </div>
    </div>
  )
}

function AddTargetModal({ tenantId, onAdded, onClose }: {
  tenantId: string
  onAdded: (s: any) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState('webapp')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    setError('')
    if (!name.trim() || !url.trim()) { setError('Name and URL are required'); return }

    let finalUrl = url.trim()
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl

    setSaving(true)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('attack_surfaces')
      .insert({ tenant_id: tenantId, name: name.trim(), target_url: finalUrl, target_type: type, active: true })
      .select('*')
      .single()

    if (err) { setError(err.message); setSaving(false); return }
    onAdded({ ...data, latestScan: null, openCritical: 0, openTotal: 0 })
  }

  const TYPES = [
    { id: 'webapp', label: 'Web App', desc: 'Website or web application' },
    { id: 'api', label: 'API', desc: 'REST or GraphQL API' },
    { id: 'mobile', label: 'Mobile', desc: 'iOS or Android backend' },
    { id: 'network', label: 'Network', desc: 'Infrastructure / IP range' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(7,11,20,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#0d1428', border: '1px solid rgba(25,118,210,0.3)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 460 }}>
        <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em', marginBottom: 4 }}>ADD TARGET</h2>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 24 }}>Only add systems you own or have written permission to test.</p>

        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Name</label>
          <input
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Production Portal"
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Target URL</label>
          <input
            className="form-input"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="e.g. https://app.example.com"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label className="form-label">Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {TYPES.map(t => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, border: `1px solid ${type === t.id ? 'rgba(25,118,210,0.5)' : 'rgba(255,255,255,0.06)'}`, background: type === t.id ? 'rgba(25,118,210,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                <input type="radio" name="type" value={t.id} checked={type === t.id} onChange={() => setType(t.id)} style={{ accentColor: '#42a5f5' }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{t.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn-s" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleAdd} className="btn-p" style={{ flex: 2 }} disabled={saving}>
            {saving ? 'Adding…' : 'Add Target →'}
          </button>
        </div>
      </div>
    </div>
  )
}
