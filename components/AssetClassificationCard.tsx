'use client'

import { useState } from 'react'
import DepartmentCombobox from './DepartmentCombobox'
import { formatFriendly } from '@/lib/format-date'

export type Classification = {
  criticality:           string | null
  asset_type_label:      string | null
  department:            string | null
  owner_name:            string | null
  owner_email:           string | null
  physical_location:     string | null
  classification_notes:  string | null
  classified_at:         string | null
}

export const CRITICALITY_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  mission_critical:   { label: 'Mission Critical',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'   },
  business_essential: { label: 'Business Essential',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)'  },
  business_support:   { label: 'Business Support',    color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)'  },
  non_essential:      { label: 'Non-Essential',        color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)' },
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  server: 'Server', workstation: 'Workstation', network_device: 'Network Device',
  iot: 'IoT', cloud_service: 'Cloud Service', mobile: 'Mobile', other: 'Other',
}

function CriticalityBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ fontSize: 11, color: '#475569' }}>Unclassified</span>
  const m = CRITICALITY_META[value]
  if (!m) return null
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`, letterSpacing: '0.04em' }}>
      {m.label}
    </span>
  )
}

export default function AssetClassificationCard({
  assetId,
  initial,
  userRole,
  timezone = 'UTC',
}: {
  assetId: string
  initial: Classification
  userRole: string
  timezone?: string
}) {
  const canEdit = ['account_owner', 'admin'].includes(userRole)
  const [data, setData]     = useState<Classification>(initial)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]   = useState<Classification>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [saved, setSaved]   = useState(false)

  function startEdit() { setDraft(data); setEditing(true); setError('') }
  function cancelEdit() { setEditing(false); setError('') }

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/assets/${assetId}/classify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    if (res.ok) {
      setData(draft)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 12,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#e2e8f0', outline: 'none', boxSizing: 'border-box',
  }
  const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#475569', marginBottom: 4, display: 'block' }

  return (
    <div className="gs au1" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', margin: 0 }}>
          BUSINESS CLASSIFICATION
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved && <span style={{ fontSize: 11, color: '#22c55e' }}>Saved</span>}
          {canEdit && !editing && (
            <button type="button" onClick={startEdit}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Criticality</label>
              <select style={sel} value={draft.criticality ?? ''} onChange={e => setDraft(d => ({ ...d, criticality: e.target.value || null }))}>
                <option value="">— Unclassified —</option>
                {Object.entries(CRITICALITY_META).map(([v, m]) => (
                  <option key={v} value={v}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Asset type</label>
              <select style={sel} value={draft.asset_type_label ?? ''} onChange={e => setDraft(d => ({ ...d, asset_type_label: e.target.value || null }))}>
                <option value="">— Select type —</option>
                {Object.entries(ASSET_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Owner name</label>
              <input style={inp} value={draft.owner_name ?? ''} onChange={e => setDraft(d => ({ ...d, owner_name: e.target.value || null }))} placeholder="Jane Smith" />
            </div>
            <div>
              <label style={lbl}>Owner email</label>
              <input style={inp} type="email" value={draft.owner_email ?? ''} onChange={e => setDraft(d => ({ ...d, owner_email: e.target.value || null }))} placeholder="jane@company.com" />
            </div>
            <div>
              <label style={lbl}>Department</label>
              <DepartmentCombobox
                value={draft.department ?? ''}
                onChange={v => setDraft(d => ({ ...d, department: v || null }))}
              />
            </div>
            <div>
              <label style={lbl}>Physical location</label>
              <input style={inp} value={draft.physical_location ?? ''} onChange={e => setDraft(d => ({ ...d, physical_location: e.target.value || null }))} placeholder="Server Room A / AWS eu-west-1" />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 64 }}
              value={draft.classification_notes ?? ''}
              onChange={e => setDraft(d => ({ ...d, classification_notes: e.target.value || null }))}
              placeholder="Additional context…"
            />
          </div>
          {error && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-p" style={{ fontSize: 12, padding: '6px 16px' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={cancelEdit}
              style={{ fontSize: 12, padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
                background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={lbl}>Criticality</div>
            <CriticalityBadge value={data.criticality} />
          </div>
          <div>
            <div style={lbl}>Asset type</div>
            <div style={{ fontSize: 13, color: '#e2e8f0' }}>{data.asset_type_label ? ASSET_TYPE_LABELS[data.asset_type_label] : '—'}</div>
          </div>
          <div>
            <div style={lbl}>Department</div>
            <div style={{ fontSize: 13, color: '#e2e8f0' }}>{data.department ?? '—'}</div>
          </div>
          <div>
            <div style={lbl}>Owner</div>
            <div style={{ fontSize: 13, color: '#e2e8f0' }}>{data.owner_name ?? '—'}</div>
            {data.owner_email && <div style={{ fontSize: 11, color: '#64748b' }}>{data.owner_email}</div>}
          </div>
          <div>
            <div style={lbl}>Location</div>
            <div style={{ fontSize: 13, color: '#e2e8f0' }}>{data.physical_location ?? '—'}</div>
          </div>
          <div>
            <div style={lbl}>Last classified</div>
            <div style={{ fontSize: 13, color: '#e2e8f0' }}>
              {data.classified_at ? formatFriendly(data.classified_at, timezone) : '—'}
            </div>
          </div>
          {data.classification_notes && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={lbl}>Notes</div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{data.classification_notes}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
