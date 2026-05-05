'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUSES = ['open', 'in_progress', 'remediated', 'verified_fixed', 'accepted_risk'] as const
type Status = typeof STATUSES[number]

const STATUS_STYLE: Record<Status, { color: string; bg: string; border: string }> = {
  open:           { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)' },
  in_progress:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  remediated:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)' },
  verified_fixed: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.4)' },
  accepted_risk:  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)' },
}

const STATUS_LABEL: Record<Status, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  remediated: 'Remediated',
  verified_fixed: '✓ Verified Fixed',
  accepted_risk: 'Accepted Risk',
}

// Set by the scan engine — shown but grayed in picker
const SYSTEM_STATUSES: Status[] = ['verified_fixed']

export default function FindingStatusButton({ findingId, currentStatus, findingTitle }: { findingId: string; currentStatus: string; findingTitle?: string }) {
  const [status, setStatus] = useState<Status>((STATUSES.includes(currentStatus as Status) ? currentStatus : 'open') as Status)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const style = STATUS_STYLE[status]

  async function updateStatus(next: Status) {
    if (next === status) { setOpen(false); return }
    setSaving(true)
    setOpen(false)
    const supabase = createClient()
    const prev = status
    await supabase.from('findings').update({ status: next }).eq('id', findingId)
    setStatus(next)
    setSaving(false)
    // Log to audit trail — fire and forget
    fetch('/api/audit/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'finding.status_changed',
        detail: { finding_id: findingId, title: findingTitle ?? findingId, from: prev, to: next },
      }),
    }).catch(() => {})
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
          padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
          color: style.color, background: style.bg, border: `1px solid ${style.border}`,
          transition: 'opacity 0.15s',
        }}
      >
        {saving ? '…' : STATUS_LABEL[status]}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 10, minWidth: 140,
            background: '#0d1428', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            {STATUSES.map(s => {
              const ss = STATUS_STYLE[s]
              const isSystem = SYSTEM_STATUSES.includes(s)
              return (
                <button
                  key={s}
                  onClick={() => !isSystem && updateStatus(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '9px 12px', fontSize: 12,
                    cursor: isSystem ? 'default' : 'pointer',
                    background: s === status ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: 'none', color: isSystem ? '#475569' : ss.color, textAlign: 'left',
                    opacity: isSystem && s !== status ? 0.4 : 1,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: isSystem ? '#475569' : ss.color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{STATUS_LABEL[s]}</span>
                  {isSystem && <span style={{ fontSize: 9, color: '#475569' }}>system</span>}
                  {s === status && <span style={{ fontSize: 10, color: ss.color }}>✓</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
