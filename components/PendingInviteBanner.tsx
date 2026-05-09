'use client'

import { useEffect, useState } from 'react'

interface Invite {
  id: string
  tenant_id: string
  role: string
  expires_at: string
  tenants: { name: string } | null
}

export default function PendingInviteBanner() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [accepting, setAccepting] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/team/my-invitations')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.invitations)) setInvites(data.invitations)
      })
      .catch(() => {})
  }, [])

  const visible = invites.filter(i => !dismissed.has(i.id))
  if (visible.length === 0) return null

  async function accept(invite: Invite) {
    setAccepting(invite.id)
    try {
      const res = await fetch('/api/team/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: invite.tenant_id }),
      })
      if (res.ok) {
        setDismissed(prev => new Set([...prev, invite.id]))
      }
    } finally {
      setAccepting(null)
    }
  }

  function dismiss(id: string) {
    setDismissed(prev => new Set([...prev, id]))
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9000, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 }}>
      {visible.map(invite => (
        <div key={invite.id} style={{
          background: '#1a2235',
          border: '1px solid #2a3a5c',
          borderRadius: 8,
          padding: '14px 16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <p style={{ margin: 0, color: '#e2e8f0', fontSize: 14, lineHeight: 1.5 }}>
            You have been invited to join <strong style={{ color: '#60a5fa' }}>{invite.tenants?.name ?? 'an organisation'}</strong> as {invite.role}.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => accept(invite)}
              disabled={accepting === invite.id}
              style={{
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 13,
                cursor: accepting === invite.id ? 'not-allowed' : 'pointer',
                opacity: accepting === invite.id ? 0.7 : 1,
                fontWeight: 500,
              }}
            >
              {accepting === invite.id ? 'Accepting…' : 'Accept'}
            </button>
            <button
              onClick={() => dismiss(invite.id)}
              style={{
                background: 'transparent',
                color: '#94a3b8',
                border: '1px solid #2a3a5c',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
