'use client'

import { useState, useEffect, useCallback } from 'react'
import { PERMISSION_GROUPS, type Permission } from '@/lib/permissions'

type Mode = 'users' | 'role-defaults'
type SelectedRole = 'admin' | 'member'

interface Member {
  id: string
  email: string
  role: string
  first_name: string | null
  last_name: string | null
}

type UserPerms = Record<string, { value: boolean; overridden: boolean }>
type RolePerms = Record<string, boolean>

const cell: React.CSSProperties = {
  fontSize: 12, color: '#94a3b8',
  padding: '10px 0',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}
const label: React.CSSProperties = { fontSize: 12, color: '#94a3b8' }
const groupHeader: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#64748b',
  letterSpacing: '0.08em', textTransform: 'uppercase',
  padding: '16px 0 6px', marginTop: 8,
}

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: value ? '#22c55e' : 'rgba(255,255,255,0.1)',
        position: 'relative', transition: 'background 0.15s',
        opacity: disabled ? 0.5 : 1,
      }}
      aria-checked={value}
      role="switch"
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 19 : 3,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fff', transition: 'left 0.15s',
      }} />
    </button>
  )
}

export default function PermissionsTab() {
  const [mode, setMode]                 = useState<Mode>('users')
  const [members, setMembers]           = useState<Member[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<SelectedRole>('admin')
  const [userPerms, setUserPerms]       = useState<{ role: string; permissions: UserPerms } | null>(null)
  const [rolePerms, setRolePerms]       = useState<RolePerms | null>(null)
  const [loading, setLoading]           = useState(false)
  const [saving, setSaving]             = useState<string | null>(null)
  const [error, setError]               = useState('')

  // Load team members once
  useEffect(() => {
    fetch('/api/team')
      .then(r => r.json())
      .then(data => {
        const nonOwners = (data.members as Member[]).filter(m => m.role !== 'account_owner')
        setMembers(nonOwners)
        if (nonOwners.length > 0) setSelectedUserId(nonOwners[0].id)
      })
      .catch(() => {})
  }, [])

  // Load user permissions when selection changes
  const loadUserPerms = useCallback(async (userId: string) => {
    setLoading(true)
    setError('')
    setUserPerms(null)
    const res = await fetch(`/api/permissions/users/${userId}`)
    if (res.ok) setUserPerms(await res.json())
    else setError('Failed to load permissions')
    setLoading(false)
  }, [])

  useEffect(() => {
    if (mode === 'users' && selectedUserId) loadUserPerms(selectedUserId)
  }, [mode, selectedUserId, loadUserPerms])

  // Load role defaults when role changes
  const loadRolePerms = useCallback(async (role: SelectedRole) => {
    setLoading(true)
    setError('')
    setRolePerms(null)
    const res = await fetch(`/api/permissions/roles?role=${role}`)
    if (res.ok) {
      const data = await res.json()
      setRolePerms(data.permissions)
    } else {
      setError('Failed to load role defaults')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (mode === 'role-defaults') loadRolePerms(selectedRole)
  }, [mode, selectedRole, loadRolePerms])

  async function handleUserToggle(permission: Permission, enabled: boolean) {
    if (!selectedUserId) return
    setSaving(permission)
    const res = await fetch(`/api/permissions/users/${selectedUserId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ permission, enabled }),
    })
    if (res.ok) await loadUserPerms(selectedUserId)
    else setError('Failed to save')
    setSaving(null)
  }

  async function handleUserReset(permission: Permission) {
    if (!selectedUserId) return
    setSaving(permission)
    const res = await fetch(`/api/permissions/users/${selectedUserId}/${permission}`, { method: 'DELETE' })
    if (res.ok) await loadUserPerms(selectedUserId)
    else setError('Failed to reset')
    setSaving(null)
  }

  async function handleRoleToggle(permission: Permission, enabled: boolean) {
    setSaving(permission)
    const res = await fetch('/api/permissions/roles', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role: selectedRole, permission, enabled }),
    })
    if (res.ok) {
      setRolePerms(prev => prev ? { ...prev, [permission]: enabled } : prev)
    } else {
      setError('Failed to save')
    }
    setSaving(null)
  }

  const selectedMember = members.find(m => m.id === selectedUserId)

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        {(['users', 'role-defaults'] as Mode[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError('') }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 16px', fontSize: 12, fontWeight: 600,
              color: mode === m ? '#42a5f5' : '#64748b',
              borderBottom: `2px solid ${mode === m ? '#42a5f5' : 'transparent'}`,
              letterSpacing: '0.03em',
            }}
          >
            {m === 'users' ? 'By User' : 'Role Defaults'}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</p>
      )}

      {/* ── Users mode ───────────────────────────────────────────────── */}
      {mode === 'users' && (
        <div>
          {/* User picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <select
              value={selectedUserId ?? ''}
              onChange={e => setSelectedUserId(e.target.value)}
              className="form-input"
              style={{ maxWidth: 260, fontSize: 12 }}
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}
                </option>
              ))}
            </select>
            {selectedMember && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.3)', letterSpacing: '0.05em',
              }}>
                {selectedMember.role.toUpperCase()}
              </span>
            )}
            {selectedMember && (
              <button
                type="button"
                onClick={() => { setMode('role-defaults'); setSelectedRole((selectedMember.role as SelectedRole) === 'admin' ? 'admin' : 'member') }}
                style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Edit {selectedMember.role} defaults
              </button>
            )}
          </div>

          {loading && <p style={{ fontSize: 13, color: '#64748b' }}>Loading…</p>}

          {!loading && userPerms && (
            <div>
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label}>
                  <p style={groupHeader}>{group.label}</p>
                  {group.permissions.map(({ key, label: permLabel }) => {
                    const entry = userPerms.permissions[key]
                    const isOverridden = entry?.overridden ?? false
                    const value       = entry?.value ?? false
                    const isSaving    = saving === key
                    return (
                      <div key={key} style={cell}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={label}>{permLabel}</span>
                          {isOverridden && (
                            <button
                              type="button"
                              onClick={() => handleUserReset(key)}
                              disabled={isSaving}
                              style={{
                                fontSize: 10, color: '#64748b', background: 'none', border: 'none',
                                cursor: 'pointer', textDecoration: 'underline', padding: 0,
                              }}
                              title="Revert to role default"
                            >
                              ↩ Reset
                            </button>
                          )}
                        </div>
                        <Toggle
                          value={value}
                          onChange={v => handleUserToggle(key, v)}
                          disabled={isSaving}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Role Defaults mode ───────────────────────────────────────── */}
      {mode === 'role-defaults' && (
        <div>
          {/* Role picker */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['admin', 'member'] as SelectedRole[]).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 14px', borderRadius: 4,
                  border: `1px solid ${selectedRole === r ? '#42a5f5' : 'rgba(255,255,255,0.1)'}`,
                  background: selectedRole === r ? 'rgba(66,165,245,0.1)' : 'none',
                  color: selectedRole === r ? '#42a5f5' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
            These are the default permissions for all <strong style={{ color: '#94a3b8' }}>{selectedRole}</strong> users.
            Individual overrides take precedence.
          </p>

          {loading && <p style={{ fontSize: 13, color: '#64748b' }}>Loading…</p>}

          {!loading && rolePerms && (
            <div>
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label}>
                  <p style={groupHeader}>{group.label}</p>
                  {group.permissions.map(({ key, label: permLabel }) => {
                    const value    = rolePerms[key] ?? false
                    const isSaving = saving === key
                    return (
                      <div key={key} style={cell}>
                        <span style={label}>{permLabel}</span>
                        <Toggle
                          value={value}
                          onChange={v => handleRoleToggle(key, v)}
                          disabled={isSaving}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
