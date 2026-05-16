'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

type Step = 'loading' | 'form' | 'error'

export default function InviteAcceptPage() {
  const router = useRouter()
  const [step, setStep]               = useState<Step>('loading')
  const [user, setUser]               = useState<User | null>(null)
  const [tenantId, setTenantId]       = useState('')
  const [tenantName, setTenantName]   = useState('')
  const [isExisting, setIsExisting]   = useState(false)
  const [inviteId, setInviteId]       = useState<string | null>(null)
  const [firstName, setFirstName]     = useState('')
  const [lastName, setLastName]       = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [terms, setTerms]             = useState(false)
  const [privacyAccepted, setPrivacy] = useState(false)
  const [inviteRole, setInviteRole]   = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    const supabase = createClient()
    const iid = new URLSearchParams(window.location.search).get('invite_id')
    setInviteId(iid)

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setStep('error')
        setError('Session not found. This invite link may have expired.')
        return
      }
      setUser(user)

      if (iid) {
        const res = await fetch(`/api/team/invitations/${iid}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setStep('error')
          setError(data.error ?? 'This invite link has expired or already been used. Ask the account owner to send a new one.')
          return
        }
        const data = await res.json()
        setTenantId(data.tenant_id)
        setTenantName(data.tenant_name ?? '')
        setIsExisting(data.is_existing_user === true)
        setInviteRole(data.role ?? '')
      } else {
        // Fallback: legacy inviteUserByEmail flow without invite_id
        const tid = user.user_metadata?.invited_tenant_id as string | undefined
        if (!tid) {
          setStep('error')
          setError('Invite metadata missing. Ask the account owner to send a new invitation.')
          return
        }
        setTenantId(tid)
        const { data: tenant } = await supabase.from('tenants').select('name').eq('id', tid).single()
        if (tenant?.name) setTenantName(tenant.name)
        setIsExisting(false)
      }

      setStep('form')
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!terms) { setError('You must accept the Terms & Conditions to continue'); return }
    if (!privacyAccepted) { setError('You must accept the Privacy Policy to continue'); return }

    if (!isExisting) {
      if (password.length < 8) { setError('Password must be at least 8 characters'); return }
      if (password !== confirmPw) { setError('Passwords do not match'); return }
    }

    setLoading(true)
    setError('')
    const supabase = createClient()

    if (!isExisting) {
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
        data: { first_name: firstName, last_name: lastName },
      })
      if (updateErr) { setError(updateErr.message); setLoading(false); return }
    }

    const body: Record<string, string> = {}
    if (inviteId) body.invite_id = inviteId
    if (!inviteId) body.tenant_id = tenantId
    if (!isExisting) { body.first_name = firstName; body.last_name = lastName }

    const { error: profileErr } = await fetch('/api/team/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()).then(d => ({ error: d.error })).catch(() => ({ error: 'Network error' }))

    if (profileErr) { setError(profileErr); setLoading(false); return }

    fetch('/api/events/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'user.logged_in' }),
    }).catch(() => {})

    router.push(inviteRole === 'developer' ? '/dashboard/remediation' : '/dashboard')
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#e2e8f0', outline: 'none', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b',
    marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase',
  }

  if (step === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2px solid #42a5f5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b', fontSize: 13 }}>Verifying your invitation…</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Invitation Error</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>{error}</p>
          <a href="/login" style={{ color: '#42a5f5', fontSize: 13 }}>Back to sign in</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(ellipse at top, rgba(25,118,210,0.06) 0%, transparent 60%)' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#1976d2,#42a5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="font-display" style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>BREACHR</span>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>
            You&apos;ve been invited{tenantName ? ` to ${tenantName}` : ''}
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            {user?.email} · {isExisting ? 'Accept your invitation to continue' : 'Set up your account to continue'}
          </p>
        </div>

        <div className="gs au1" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit}>

            {/* Role badge */}
            <div style={{ marginBottom: 24, padding: '10px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Your role in {tenantName || 'this organisation'}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', letterSpacing: '0.05em' }}>
                ADMIN
              </span>
            </div>

            {/* New user: name + password fields */}
            {!isExisting && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={lbl}>First name</label>
                    <input style={inp} required autoFocus value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" />
                  </div>
                  <div>
                    <label style={lbl}>Last name</label>
                    <input style={inp} required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Set password</label>
                  <input type="password" required autoComplete="new-password" style={inp} minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={lbl}>Confirm password</label>
                  <input type="password" required autoComplete="new-password" style={inp} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat your password" />
                </div>
              </>
            )}

            {/* Terms & privacy — two separate required checkboxes */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
              <input type="checkbox" required checked={terms} onChange={e => setTerms(e.target.checked)} style={{ marginTop: 2, flexShrink: 0, accentColor: '#42a5f5' }} />
              <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                I agree to the{' '}
                <a href="https://breachr.ai/terms" target="_blank" rel="noreferrer" style={{ color: '#42a5f5' }}>Terms &amp; Conditions</a>
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24, cursor: 'pointer' }}>
              <input type="checkbox" required checked={privacyAccepted} onChange={e => setPrivacy(e.target.checked)} style={{ marginTop: 2, flexShrink: 0, accentColor: '#42a5f5' }} />
              <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                I have read and accept the{' '}
                <a href="https://breachr.ai/privacy" target="_blank" rel="noreferrer" style={{ color: '#42a5f5' }}>Privacy Policy</a>
              </span>
            </label>

            {error && (
              <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 16, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </p>
            )}

            <button type="submit" className="btn-p pulse" style={{ width: '100%', padding: 13, fontSize: 14 }} disabled={loading}>
              {loading
                ? 'Setting up…'
                : isExisting
                  ? `Join ${tenantName || 'Organisation'} →`
                  : 'Complete Setup →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
