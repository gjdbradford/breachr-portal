'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Step = 'signing-out' | 'verifying' | 'error'

export default function InviteConfirmPage() {
  const [step, setStep]     = useState<Step>('signing-out')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    const supabase = createClient()

    const hashParams   = new URLSearchParams(window.location.hash.slice(1))
    const searchParams = new URLSearchParams(window.location.search)

    const accessToken  = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const code         = searchParams.get('code')

    // Sign out any existing session globally before processing invite
    supabase.auth.signOut({ scope: 'global' }).then(() => {
      setStep('verifying')

      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data, error }) => {
            if (error || !data.session) {
              setErrMsg(error?.message ?? 'Could not verify invite. The link may have expired.')
              setStep('error')
            } else {
              window.location.href = '/invite/accept'
            }
          })
      } else if (code) {
        supabase.auth
          .exchangeCodeForSession(code)
          .then(({ data, error }) => {
            if (error || !data.session) {
              setErrMsg(error?.message ?? 'Could not verify invite. The link may have expired.')
              setStep('error')
            } else {
              window.location.href = '/invite/accept'
            }
          })
      } else {
        setErrMsg('This invite link has expired or already been used. Ask the account owner to send a new one.')
        setStep('error')
      }
    })
  }, [])

  const bg = 'radial-gradient(ellipse at top, rgba(25,118,210,0.06) 0%, transparent 60%)'

  if (step === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Invite link invalid</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>{errMsg}</p>
          <a href="/login" style={{ color: '#42a5f5', fontSize: 13 }}>Back to sign in</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #42a5f5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b', fontSize: 13 }}>
          {step === 'signing-out' ? 'Preparing your account…' : 'Verifying your invitation…'}
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
