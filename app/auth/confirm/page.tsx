'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Handles Supabase implicit-flow emails: magic links, password reset, invite.
// Supabase redirects to Site URL with #access_token=...&refresh_token=...&type=...
// This page reads the fragment, exchanges it for a session, then redirects to /dashboard.
export default function AuthConfirmPage() {
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) {
      window.location.href = '/login?error=no_token'
      return
    }

    const params = new URLSearchParams(hash)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    const type = params.get('type')

    if (!access_token || !refresh_token) {
      window.location.href = '/login?error=invalid_token'
      return
    }

    const supabase = createClient()
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) {
        window.location.href = `/login?error=${encodeURIComponent(error.message)}`
      } else {
        window.location.href = type === 'invite' ? '/invite/accept' : '/dashboard'
      }
    })
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at top, rgba(25,118,210,0.06) 0%, transparent 60%)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #42a5f5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#94a3b8', fontSize: 13 }}>Signing you in…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
