'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const e = params.get('error')
    if (e) {
      const known: Record<string, string> = {
        invite_link_expired: 'This invite link has expired or already been used. Ask the account owner to send a new one.',
        invite_link_invalid: 'Invalid invite link. Ask the account owner to send a new one.',
        auth_failed:         'Authentication failed. Please try again or request a new link.',
        no_token:            'No authentication token found.',
        invalid_token:       'Invalid authentication token.',
        no_account:          'No account found for this email. Contact your account owner to send you an invitation.',
      }
      setError(known[e] ?? decodeURIComponent(e))
      // Sign out any stale session so the user isn't looped back to dashboard.
      createClient().auth.signOut()
      return
    }

    // Supabase falls back to Site URL when redirectTo isn't allowlisted —
    // the browser then preserves the hash through the server redirect to /login.
    // Forward to /auth/confirm so the token gets properly exchanged.
    const hash = window.location.hash.slice(1)
    if (hash && new URLSearchParams(hash).get('access_token')) {
      window.location.replace('/auth/confirm' + window.location.hash)
      return
    }

    // Use getUser() (server-verified) not getSession() (local JWT only) to avoid
    // a redirect loop when a user's account has been deleted but their cookie remains.
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) window.location.href = '/dashboard'
    })
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      fetch('/api/events/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'user.logged_in' }),
      }).catch(() => {})
      window.location.href = '/dashboard'
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
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Sign in to your security dashboard</p>
        </div>

        {/* Card */}
        <div className="gs au1" style={{ padding: 32 }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="email" className="form-label">Work email</label>
              <input
                id="email" type="email" required autoComplete="email"
                className="form-input" placeholder="you@company.eu"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label htmlFor="password" className="form-label">Password</label>
              <input
                id="password" type="password" required autoComplete="current-password"
                className="form-input" placeholder="••••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </p>
            )}
            <button type="submit" className="btn-p pulse" style={{ width: '100%', padding: 13, fontSize: 14 }} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <a href="/auth/forgot-password" style={{ color: '#42a5f5', fontSize: 12 }}>
              Forgot password?
            </a>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#94a3b8' }}>
          Don&apos;t have an account?{' '}
          <a href="https://breachr-website.vercel.app/#register" style={{ color: '#42a5f5' }}>Start free on breachr.ai</a>
        </p>
      </div>
    </div>
  )
}
