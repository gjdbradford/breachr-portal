'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Step = 'loading' | 'form' | 'saving' | 'error'

export default function WelcomePage() {
  const [step, setStep]       = useState<Step>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) {
      setError('No authentication token found. The link may have expired.')
      setStep('error')
      return
    }

    const params       = new URLSearchParams(hash)
    const access_token  = params.get('access_token')
    const refresh_token = params.get('refresh_token')

    if (!access_token || !refresh_token) {
      setError('Invalid authentication token. Please request a new setup link.')
      setStep('error')
      return
    }

    const supabase = createClient()
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error: sessionErr }) => {
      if (sessionErr) {
        setError(sessionErr.message)
        setStep('error')
      } else {
        window.history.replaceState(null, '', '/auth/welcome')
        setStep('form')
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm)  { setError('Passwords do not match'); return }

    setStep('saving')
    setError('')
    const supabase = createClient()
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) {
      setError(updateErr.message)
      setStep('form')
    } else {
      window.location.href = '/onboarding'
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 8, fontSize: 13,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#e2e8f0', outline: 'none', boxSizing: 'border-box',
  }

  if (step === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at top, rgba(25,118,210,0.06) 0%, transparent 60%)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2px solid #42a5f5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Verifying your link…</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at top, rgba(25,118,210,0.06) 0%, transparent 60%)', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Setup link expired</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>{error}</p>
          <a href="/auth/forgot-password" style={{ color: '#42a5f5', fontSize: 13 }}>Request a new link →</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(ellipse at top, rgba(25,118,210,0.06) 0%, transparent 60%)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#1976d2,#42a5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="font-display" style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>BREACHR</span>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>Set your password</h2>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Choose a password to complete your account setup</p>
        </div>

        <div className="gs au1" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Password
              </label>
              <input
                type="password" required autoFocus autoComplete="new-password"
                style={inp} minLength={8} placeholder="At least 8 characters"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Confirm password
              </label>
              <input
                type="password" required autoComplete="new-password"
                style={inp} placeholder="Repeat your password"
                value={confirm} onChange={e => setConfirm(e.target.value)}
              />
            </div>
            {error && (
              <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </p>
            )}
            <button type="submit" className="btn-p pulse" style={{ width: '100%', padding: 13, fontSize: 14 }} disabled={step === 'saving'}>
              {step === 'saving' ? 'Setting up…' : 'Set Password & Continue →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
