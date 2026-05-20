// portal/app/onboarding/payment/PaymentWallClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  packageId:     string
  packageName:   string
  trialDays:     number
  priceMonthly:  number
  currency:      'eur' | 'usd'
  trialEndDate:  string
  cancelled?:    boolean
}

export default function PaymentWallClient({
  packageId, packageName, trialDays, priceMonthly, currency, trialEndDate, cancelled,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const router = useRouter()
  const symbol = currency === 'eur' ? '€' : '$'

  async function handleCheckout() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          period: 'monthly',
          returnTo: '/onboarding?step=2',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Checkout failed')
      window.location.href = json.url
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
      setLoading(false)
    }
  }

  const formattedDate = new Date(trialEndDate).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440, background: '#0d1428', border: '1px solid rgba(25,118,210,0.3)', borderRadius: 12, padding: 32 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#1976d2,#42a5f5)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 16 }}>🛡</span>
          </div>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: '0.08em' }}>BREACHR</span>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 6, letterSpacing: '0.05em' }}>
          START YOUR {trialDays > 0 ? 'FREE TRIAL' : packageName.toUpperCase()}
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
          {trialDays > 0
            ? `${trialDays} days free, then ${symbol}${priceMonthly}/month`
            : `${symbol}${priceMonthly}/month`}
        </p>

        <div style={{ background: 'rgba(25,118,210,0.06)', border: '1px solid rgba(25,118,210,0.2)', borderRadius: 8, padding: '14px 16px', marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#42a5f5', marginBottom: 4 }}>{packageName} Plan</div>
          {trialDays > 0 && (
            <>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#e2e8f0', marginBottom: 4 }}>Free until {formattedDate}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Then {symbol}{priceMonthly}/month · Cancel anytime before {formattedDate}
              </div>
            </>
          )}
          {trialDays === 0 && (
            <div style={{ fontSize: 22, fontWeight: 900, color: '#e2e8f0' }}>{symbol}{priceMonthly}/month</div>
          )}
        </div>

        {cancelled && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#ef4444' }}>
            Payment was cancelled. You can try again below.
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#ef4444' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={loading}
          style={{
            width: '100%', padding: '13px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700,
            background: loading ? 'rgba(25,118,210,0.4)' : 'linear-gradient(135deg,#1976d2,#42a5f5)',
            color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          {loading ? 'Redirecting to payment…' : trialDays > 0 ? `Start Free Trial →` : 'Subscribe →'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#475569', marginTop: 12 }}>
          {trialDays > 0 ? 'No charge until your trial ends. ' : ''}
          Secured by Stripe · Cancel anytime
        </p>
      </div>
    </div>
  )
}
