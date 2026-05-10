'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatFriendly } from '@/lib/format-date'

interface Member {
  id: string
  email: string
  role: string
  first_name: string | null
  last_name: string | null
  created_at: string
  last_login_at: string | null
}

interface Invitation {
  id: string
  email: string
  role: string
  expires_at: string
  created_at: string
}

const ROLE_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  account_owner: { label: 'Owner',  bg: 'rgba(99,102,241,0.1)',  color: '#818cf8', border: 'rgba(99,102,241,0.3)' },
  admin:         { label: 'Admin',  bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  member:        { label: 'Member', bg: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
}

function RoleBadge({ role }: { role: string }) {
  const b = ROLE_BADGE[role] ?? ROLE_BADGE.member
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: b.bg, color: b.color, border: `1px solid ${b.border}`,
      letterSpacing: '0.05em',
    }}>
      {b.label}
    </span>
  )
}

export default function TeamTab({
  currentUserId,
  currentUserRole,
  timezone = 'UTC',
}: {
  currentUserId: string
  currentUserRole: string
  timezone?: string
}) {
  const isOwner = currentUserRole === 'account_owner'
  const [members, setMembers]               = useState<Member[]>([])
  const [invitations, setInvitations]       = useState<Invitation[]>([])
  const [loading, setLoading]               = useState(true)
  const [inviteEmail, setInviteEmail]       = useState('')
  const [inviting, setInviting]             = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [error, setError]                   = useState('')
  const [success, setSuccess]               = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/team')
    if (res.ok) {
      const data = await res.json()
      setMembers(data.members)
      setInvitations(data.invitations)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setError('')
    setSuccess('')
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      if (data.emailSent === false) {
        setSuccess(`${inviteEmail} already has a Breachr account. They'll see the invitation on their dashboard next time they log in.`)
      } else {
        setSuccess(`Invitation email sent to ${inviteEmail}`)
      }
      setInviteEmail('')
      setShowInviteForm(false)
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to send invite')
    }
    setInviting(false)
  }

  async function handleRoleChange(userId: string, role: string) {
    setError('')
    setSuccess('')
    const res = await fetch(`/api/team/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (res.ok) { load() }
    else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to update role')
    }
  }

  async function handleRemove(userId: string, email: string) {
    if (!confirm(`Remove ${email}? They will lose access immediately.`)) return
    setError('')
    setSuccess('')
    const res = await fetch(`/api/team/${userId}`, { method: 'DELETE' })
    if (res.ok) { load() }
    else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to remove member')
    }
  }

  async function handleRevokeInvite(inviteId: string, email: string) {
    if (!confirm(`Revoke invitation for ${email}?`)) return
    setError('')
    setSuccess('')
    const res = await fetch(`/api/team/invitations/${inviteId}`, { method: 'DELETE' })
    if (res.ok) { load() }
    else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to revoke invite')
    }
  }

  const cell: React.CSSProperties = { fontSize: 12, color: '#94a3b8', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }
  const head: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#64748b', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }

  if (loading) {
    return <p style={{ fontSize: 13, color: '#64748b' }}>Loading team…</p>
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Team Members</h3>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        {isOwner && !showInviteForm && (
          <button
            type="button"
            onClick={() => { setShowInviteForm(true); setError(''); setSuccess('') }}
            className="btn-p"
            style={{ fontSize: 12, padding: '6px 16px' }}
          >
            + Invite Admin
          </button>
        )}
      </div>

      {error   && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}
      {success && <p style={{ fontSize: 12, color: '#22c55e', marginBottom: 12, padding: '8px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: 6, border: '1px solid rgba(34,197,94,0.2)' }}>{success}</p>}

      {showInviteForm && (
        <form onSubmit={handleInvite} style={{ marginBottom: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Email address</label>
            <input
              type="email" required autoFocus
              className="form-input"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              style={{ marginTop: 4 }}
            />
          </div>
          <button type="submit" className="btn-p" style={{ fontSize: 12, padding: '8px 16px' }} disabled={inviting}>
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
          <button type="button" onClick={() => setShowInviteForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, padding: '8px 8px' }}>
            Cancel
          </button>
        </form>
      )}

      {/* Members table */}
      <div className="gs au1" style={{ marginBottom: invitations.length > 0 ? 24 : 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={head}>Email</th>
              <th style={head}>Role</th>
              <th style={head}>Joined</th>
              <th style={head}>Last login</th>
              {isOwner && <th style={head}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id}>
                <td style={cell}>
                  {(m.first_name || m.last_name) && (
                    <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 2 }}>
                      {[m.first_name, m.last_name].filter(Boolean).join(' ')}
                    </div>
                  )}
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {m.email}
                    {m.id === currentUserId && <span style={{ marginLeft: 6 }}>(you)</span>}
                  </span>
                </td>
                <td style={cell}><RoleBadge role={m.role} /></td>
                <td style={cell}>{formatFriendly(m.created_at, timezone)}</td>
                <td style={cell}>{m.last_login_at ? formatFriendly(m.last_login_at, timezone) : '—'}</td>
                {isOwner && (
                  <td style={cell}>
                    {m.role !== 'account_owner' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {m.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleRoleChange(m.id, 'member')}
                            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)', cursor: 'pointer' }}
                          >
                            Demote
                          </button>
                        )}
                        {m.role === 'member' && (
                          <button
                            type="button"
                            onClick={() => handleRoleChange(m.id, 'admin')}
                            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer' }}
                          >
                            Promote
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemove(m.id, m.email)}
                          style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invitations.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>
            Pending Invitations ({invitations.length})
          </h3>
          <div className="gs au1">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={head}>Email</th>
                  <th style={head}>Role</th>
                  <th style={head}>Invited</th>
                  <th style={head}>Expires</th>
                  {isOwner && <th style={head}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id}>
                    <td style={cell}>{inv.email}</td>
                    <td style={cell}><RoleBadge role={inv.role} /></td>
                    <td style={cell}>{formatFriendly(inv.created_at, timezone)}</td>
                    <td style={cell}>{formatFriendly(inv.expires_at, timezone)}</td>
                    {isOwner && (
                      <td style={cell}>
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv.id, inv.email)}
                          style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}
                        >
                          Revoke
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
