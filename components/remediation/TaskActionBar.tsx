'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', review_requested: 'Review Requested',
  verified_fixed: 'Verified Fixed', failed_verification: 'Failed Verification', reopened: 'Reopened',
}
const STATUS_COLOR: Record<string, string> = {
  open: '#94a3b8', in_progress: '#42a5f5', review_requested: '#f97316',
  verified_fixed: '#4ade80', failed_verification: '#ef4444', reopened: '#fbbf24',
}

export default function TaskActionBar({
  taskId,
  initialStatus,
  actorRole,
  reopenNote,
}: {
  taskId: string
  initialStatus: string
  actorRole: string
  reopenNote?: string | null
}) {
  const router             = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [note, setNote]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState('')

  const isDeveloper    = actorRole === 'developer'
  const isAdminOrOwner = actorRole === 'admin' || actorRole === 'account_owner'

  async function transition(toStatus: string, noteText?: string) {
    setLoading(true)
    setError('')
    setSuccess('')
    const res = await fetch(`/api/remediation/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus, note: noteText }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to update status')
      setLoading(false)
      return
    }
    const d = await res.json()
    setStatus(d.status)
    setSuccess(`Status updated to ${STATUS_LABEL[d.status] ?? d.status}`)
    setNote('')
    setLoading(false)
    router.refresh()
  }

  const stColor = STATUS_COLOR[status] ?? '#94a3b8'

  return (
    <div>
      {/* Current status chip */}
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Current Status</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: stColor, padding: '4px 10px', borderRadius: 6, background: `${stColor}15`, border: `1px solid ${stColor}30` }}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {error   && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}
      {success && <p style={{ fontSize: 12, color: '#4ade80', marginBottom: 12, padding: '8px 12px', background: 'rgba(74,222,128,0.08)', borderRadius: 6, border: '1px solid rgba(74,222,128,0.2)' }}>{success}</p>}

      {/* Developer actions */}
      {isDeveloper && status === 'open' && (
        <button className="btn-p" style={{ width: '100%', padding: 10, fontSize: 13 }} onClick={() => transition('in_progress')} disabled={loading}>
          {loading ? 'Updating…' : 'Start working →'}
        </button>
      )}
      {isDeveloper && status === 'in_progress' && (
        <button className="btn-p" style={{ width: '100%', padding: 10, fontSize: 13 }} onClick={() => transition('review_requested')} disabled={loading}>
          {loading ? 'Updating…' : 'Request review →'}
        </button>
      )}
      {isDeveloper && status === 'review_requested' && (
        <p style={{ fontSize: 13, color: '#64748b', padding: '10px 0' }}>
          Awaiting admin review and verification scan.
        </p>
      )}
      {isDeveloper && (status === 'failed_verification' || status === 'reopened') && (
        <button className="btn-p" style={{ width: '100%', padding: 10, fontSize: 13 }} onClick={() => transition('in_progress')} disabled={loading}>
          {loading ? 'Updating…' : 'Start working →'}
        </button>
      )}
      {isDeveloper && status === 'verified_fixed' && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', fontSize: 13 }}>
          ✓ Fix confirmed
        </div>
      )}

      {/* Admin actions */}
      {isAdminOrOwner && status === 'review_requested' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn-p" style={{ width: '100%', padding: 10, fontSize: 13, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
            onClick={() => transition('verified_fixed')} disabled={loading}>
            {loading ? 'Updating…' : '✓ Verify fix'}
          </button>
          <div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Reason for reopening (required)"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 12, resize: 'vertical', minHeight: 64, boxSizing: 'border-box' }}
              rows={2}
            />
            <button
              style={{ width: '100%', padding: 10, fontSize: 13, borderRadius: 6, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', cursor: note.trim() ? 'pointer' : 'not-allowed', marginTop: 6 }}
              onClick={() => transition('reopened', note.trim())}
              disabled={loading || !note.trim()}
            >
              {loading ? 'Updating…' : '↩ Reopen with note'}
            </button>
          </div>
        </div>
      )}

      {/* Reopen note from admin */}
      {isDeveloper && status === 'reopened' && reopenNote && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 6, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', fontSize: 12, color: '#fbbf24' }}>
          <span style={{ fontWeight: 700, display: 'block', marginBottom: 2 }}>Admin note:</span>
          {reopenNote}
        </div>
      )}
    </div>
  )
}
