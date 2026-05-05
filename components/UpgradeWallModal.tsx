'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { PLANS, fmtTokens } from '@/lib/plans'
import type { PlanId } from '@/lib/plans'

export type UpgradeReason = 'scan_limit' | 'token_limit' | 'target_limit'

interface Props {
  reason: UpgradeReason
  currentPlanId: string
  scansUsed?: number
  scansLimit?: number | null
  tokensUsed?: number
  tokensLimit?: number | null
  targetsUsed?: number
  targetsMax?: number | null
  onClose: () => void
}

const REASON_COPY: Record<UpgradeReason, { icon: string; title: string; sub: (p: Props) => string }> = {
  scan_limit: {
    icon: '⚡',
    title: 'Scan limit reached',
    sub: p => `You've used ${p.scansUsed ?? 0} of ${p.scansLimit ?? 0} scans this month. Upgrade to keep scanning.`,
  },
  token_limit: {
    icon: '🧠',
    title: 'Token budget exhausted',
    sub: p => `${fmtTokens(p.tokensUsed ?? 0)} of ${fmtTokens(p.tokensLimit ?? 0)} tokens used. Upgrade for more AI capacity.`,
  },
  target_limit: {
    icon: '🎯',
    title: 'Target limit reached',
    sub: p => `Your plan allows ${p.targetsMax ?? 1} target${(p.targetsMax ?? 1) > 1 ? 's' : ''}. Upgrade to add more.`,
  },
}

async function startCheckout(planId: string, period: 'monthly' | 'annual') {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, period }),
  })
  const data = await res.json()
  if (data.url) window.location.href = data.url
}

const UPGRADE_PLANS: PlanId[] = ['starter', 'professional', 'enterprise']

export default function UpgradeWallModal(props: Props) {
  const { currentPlanId, onClose } = props
  const [annual, setAnnual] = useState(true)
  const [loading, setLoading] = useState<string | null>(null)

  const copy = REASON_COPY[props.reason]

  async function handleUpgrade(planId: string) {
    setLoading(planId)
    await startCheckout(planId, annual ? 'annual' : 'monthly')
    setLoading(null)
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(7,11,20,0.92)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#0d1428', border: '1px solid rgba(25,118,210,0.3)', borderRadius: 18, width: '100%', maxWidth: 680, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>{copy.icon}</span>
              <h2 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em' }}>{copy.title.toUpperCase()}</h2>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', maxWidth: 440 }}>{copy.sub(props)}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '2px 4px', marginTop: -2 }}>×</button>
        </div>

        {/* Billing toggle */}
        <div style={{ padding: '16px 28px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: annual ? '#475569' : '#e2e8f0', fontWeight: annual ? 400 : 600 }}>Monthly</span>
          <button
            onClick={() => setAnnual(a => !a)}
            style={{ width: 44, height: 24, borderRadius: 12, background: 'rgba(66,165,245,0.15)', border: '1px solid rgba(66,165,245,0.35)', cursor: 'pointer', position: 'relative', padding: 0, flexShrink: 0 }}
          >
            <span style={{ position: 'absolute', top: 3, left: annual ? 22 : 3, width: 16, height: 16, borderRadius: '50%', background: '#42a5f5', transition: 'left 0.2s' }} />
          </button>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: annual ? '#e2e8f0' : '#475569', fontWeight: annual ? 600 : 400 }}>Annual</span>
            {annual && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}>SAVE 20%</span>}
          </span>
        </div>

        {/* Plan cards */}
        <div style={{ padding: '16px 28px 28px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {UPGRADE_PLANS.map(planId => {
            const p = PLANS[planId]
            const isCurrent = planId === currentPlanId
            const monthlyPrice = Math.round(p.priceMonthly * 1.25)
            const displayPrice = annual ? p.priceMonthly : monthlyPrice
            const isEnterprise = planId === 'enterprise'

            return (
              <div
                key={planId}
                style={{
                  background: planId === 'professional' ? 'rgba(66,165,245,0.05)' : '#0a0e1a',
                  border: `1px solid ${planId === 'professional' ? 'rgba(66,165,245,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 12, padding: '20px 18px',
                  display: 'flex', flexDirection: 'column',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {planId === 'professional' && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: p.color }} />
                )}
                {planId === 'professional' && (
                  <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(66,165,245,0.15)', border: '1px solid rgba(66,165,245,0.3)', color: '#42a5f5' }}>POPULAR</div>
                )}
                {planId === 'starter' && (
                  <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}>BEST VALUE</div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: p.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{p.label}</span>
                  </div>
                  <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>
                    {isEnterprise ? 'POA' : `€${displayPrice}`}
                    {!isEnterprise && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>/mo</span>}
                  </div>
                  {!isEnterprise && (
                    <p style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                      {annual ? `€${p.priceMonthly * 12} billed annually` : 'billed monthly'}
                    </p>
                  )}
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                  {p.features.slice(0, 4).map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: '#94a3b8' }}>
                      <span style={{ color: p.color, flexShrink: 0 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, border: `1px solid ${p.color}40`, color: p.color, fontSize: 12, fontWeight: 600 }}>
                    Current Plan
                  </div>
                ) : isEnterprise ? (
                  <a
                    href="mailto:sales@breachr.io?subject=Enterprise plan enquiry"
                    style={{ display: 'block', textAlign: 'center', padding: '9px', borderRadius: 8, background: p.color, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                  >
                    Contact Sales →
                  </a>
                ) : (
                  <button
                    onClick={() => handleUpgrade(planId)}
                    disabled={!!loading}
                    style={{ width: '100%', padding: '9px', borderRadius: 8, background: loading === planId ? `${p.color}80` : p.color, color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: loading ? 'wait' : 'pointer' }}
                  >
                    {loading === planId ? 'Loading…' : `Upgrade to ${p.label} →`}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ padding: '0 28px 18px', textAlign: 'center' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 12, cursor: 'pointer' }}>
            Maybe later — stay on {PLANS[(currentPlanId as PlanId)]?.label ?? 'Freemium'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
