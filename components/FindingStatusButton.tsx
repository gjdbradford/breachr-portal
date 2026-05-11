'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STATUSES = ['open', 'in_progress', 'remediated', 'verified_fixed', 'accepted_risk', 'false_positive'] as const
type Status = typeof STATUSES[number]

const STATUS_STYLE: Record<Status, { color: string; bg: string; border: string }> = {
  open:           { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)' },
  in_progress:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  remediated:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)' },
  verified_fixed: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.4)' },
  accepted_risk:  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)' },
  false_positive: { color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)' },
}

const STATUS_LABEL: Record<Status, string> = {
  open:           'Open',
  in_progress:    'In Progress',
  remediated:     'Remediated',
  verified_fixed: '✓ Verified Fixed',
  accepted_risk:  'Accepted Risk',
  false_positive: 'False Positive',
}

const REQUIRES_REASON: Status[] = ['accepted_risk', 'false_positive']
const SYSTEM_STATUSES: Status[] = ['verified_fixed']

const REASON_COPY: Record<string, { title: string; description: string; placeholder: string }> = {
  accepted_risk: {
    title: 'Accept Risk',
    description: 'You are accepting this risk without fixing it. This decision and your reasoning will be permanently recorded in the audit trail.',
    placeholder: 'e.g. Our WAF mitigates this at the network layer, and the endpoint does not return sensitive data...',
  },
  false_positive: {
    title: 'Mark as False Positive',
    description: 'You are dismissing this finding as a false positive. Your reasoning will be permanently recorded in the audit trail.',
    placeholder: 'e.g. This endpoint is only accessible from internal IPs, the scanner incorrectly flagged it as public...',
  },
}

export default function FindingStatusButton({
  findingId, currentStatus, findingTitle, canUpdate = true,
}: {
  findingId: string
  currentStatus: string
  findingTitle?: string
  canUpdate?: boolean
}) {
  if (!canUpdate) {
    const style = STATUS_STYLE[(STATUSES.includes(currentStatus as Status) ? currentStatus : 'open') as Status]
    return (
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 6, border: `1px solid ${style.border}`, background: style.bg, color: style.color }}>
        {STATUS_LABEL[(currentStatus as Status) ?? 'open'] ?? currentStatus}
      </span>
    )
  }
  const router = useRouter()
  const [status, setStatus] = useState<Status>(
    (STATUSES.includes(currentStatus as Status) ? currentStatus : 'open') as Status
  )
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reason modal state
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(false)

  const style = STATUS_STYLE[status]

  function handleSelect(next: Status) {
    if (next === status) { setOpen(false); return }
    setOpen(false)
    if (REQUIRES_REASON.includes(next)) {
      setPendingStatus(next)
      setReason('')
      setReasonError(false)
    } else {
      void updateStatus(next, null)
    }
  }

  async function updateStatus(next: Status, reasonText: string | null) {
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const prev = status

    const patch: Record<string, unknown> = { status: next }
    if (reasonText) {
      patch.risk_acceptance_reason = reasonText
      patch.risk_accepted_by = user?.id ?? null
    }

    const { error: updateError } = await supabase.from('findings').update(patch).eq('id', findingId)
    if (updateError) {
      setSaveError('Failed to save')
      setSaving(false)
      return
    }
    setStatus(next)
    setSaving(false)
    router.refresh()

    fetch('/api/audit/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'finding.status_changed',
        detail: {
          finding_id: findingId,
          title: findingTitle ?? findingId,
          from: prev,
          to: next,
          ...(reasonText ? { reason: reasonText } : {}),
        },
      }),
    }).catch(() => {})
  }

  async function confirmReason() {
    if (!reason.trim()) { setReasonError(true); return }
    if (!pendingStatus) return
    const r = reason.trim()
    setPendingStatus(null)
    setReason('')
    await updateStatus(pendingStatus, r)
  }

  function cancelReason() {
    setPendingStatus(null)
    setReason('')
    setReasonError(false)
  }

  const copy = pendingStatus ? REASON_COPY[pendingStatus] : null

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => { setSaveError(null); setOpen(o => !o) }}
          disabled={saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
            padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
            color: saveError ? '#ef4444' : style.color,
            background: saveError ? 'rgba(239,68,68,0.1)' : style.bg,
            border: `1px solid ${saveError ? 'rgba(239,68,68,0.3)' : style.border}`,
            transition: 'opacity 0.15s',
          }}
        >
          {saving ? '…' : saveError ? '⚠ Failed — retry' : STATUS_LABEL[status]}
          {!saveError && <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>}
        </button>

        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />
            <div style={{
              position: 'absolute', top: '110%', left: 0, zIndex: 10, minWidth: 160,
              background: '#0d1428', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {STATUSES.map(s => {
                const ss = STATUS_STYLE[s]
                const isSystem = SYSTEM_STATUSES.includes(s)
                const needsReason = REQUIRES_REASON.includes(s)
                return (
                  <button
                    key={s}
                    onClick={() => !isSystem && handleSelect(s)}
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
                    {needsReason && !isSystem && <span style={{ fontSize: 9, color: '#475569' }}>+ reason</span>}
                    {s === status && <span style={{ fontSize: 10, color: ss.color }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Reason modal */}
      {pendingStatus && copy && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#0d1428', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: 28, width: 460, maxWidth: '100%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                {STATUS_LABEL[pendingStatus]}
              </p>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>{copy.title}</h3>
              <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{copy.description}</p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Reason <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                autoFocus
                value={reason}
                onChange={e => { setReason(e.target.value); setReasonError(false) }}
                placeholder={copy.placeholder}
                rows={4}
                style={{
                  width: '100%', background: 'rgba(10,14,26,0.85)',
                  border: `1px solid ${reasonError ? '#ef4444' : 'rgba(25,118,210,0.22)'}`,
                  borderRadius: 8, padding: '10px 13px', fontSize: 13, color: '#e2e8f0',
                  fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                  lineHeight: 1.6,
                }}
              />
              {reasonError && (
                <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>A reason is required before proceeding.</p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={cancelReason} className="btn-s" style={{ padding: '8px 20px', fontSize: 13 }}>
                Cancel
              </button>
              <button
                onClick={confirmReason}
                disabled={saving}
                className="btn-p"
                style={{ padding: '8px 20px', fontSize: 13, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
