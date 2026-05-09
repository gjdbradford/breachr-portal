'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type State = 'form' | 'sent'

export default function ForgotPasswordPage() {
  const [state, setState]   = useState<State>('form')
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const origin   = window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/reset-password`,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setState('sent')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(ellipse at top, rgba(25,118,210,0.06) 0%, transparent 60%)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#1976d2,#42a5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="font-display" style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>BREACHR</span>
          </div>
        </div>

        {state === 'sent' ? (
          <div className="gs au1" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Check your email</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
              We sent a password reset link to <strong style={{ color: '#94a3b8' }}>{email}</strong>. It expires in 1 hour.
            </p>
            <Link href="/login" style={{ color: '#42a5f5', fontSize: 13 }}>Back to sign in</Link>
          </div>
        ) : (
          <div className="gs au1" style={{ padding: 32 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Reset your password</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Enter your email and we&apos;ll send a reset link.</p>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="email" className="form-label">Work email</label>
                <input
                  id="email" type="email" required autoFocus
                  className="form-input"
                  placeholder="you@company.eu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              {error && (
                <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </p>
              )}
              <button type="submit" className="btn-p" style={{ width: '100%', padding: 13, fontSize: 14 }} disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link →'}
              </button>
            </form>
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Link href="/login" style={{ color: '#42a5f5', fontSize: 12 }}>Back to sign in</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
