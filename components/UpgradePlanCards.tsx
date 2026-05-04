'use client'

import { useState } from 'react'
import { PLANS, fmtTokens } from '@/lib/plans'
import type { PlanId } from '@/lib/plans'

async function startCheckout(planId: string, period: 'monthly' | 'annual') {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, period }),
  })
  const data = await res.json()
  if (data.url) window.location.href = data.url
}

async function openPortal() {
  const res = await fetch('/api/stripe/portal', { method: 'POST' })
  const data = await res.json()
  if (data.url) window.location.href = data.url
}

const PLAN_ORDER: PlanId[] = ['free', 'starter', 'professional', 'enterprise']

function Limit({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</p>
    </div>
  )
}

export default function UpgradePlanCards({
  currentPlanId,
  hasStripeCustomer,
}: {
  currentPlanId: string
  hasStripeCustomer: boolean
}) {
  const [annual, setAnnual] = useState(true)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(planId: string) {
    setLoading(planId)
    await startCheckout(planId, annual ? 'annual' : 'monthly')
    setLoading(null)
  }

  async function handlePortal() {
    setLoading('portal')
    await openPortal()
    setLoading(null)
  }
  const currentPlan = PLANS[(currentPlanId as PlanId) ?? 'free'] ?? PLANS.free

  return (
    <>
      {/* Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
        <span style={{ fontSize: 12, color: annual ? '#475569' : '#e2e8f0', fontWeight: annual ? 400 : 600, transition: 'color 0.2s' }}>Monthly</span>
        <button
          onClick={() => setAnnual(a => !a)}
          aria-label="Toggle billing period"
          style={{
            width: 48, height: 26, borderRadius: 13,
            background: 'rgba(66,165,245,0.15)',
            border: '1px solid rgba(66,165,245,0.35)',
            cursor: 'pointer', position: 'relative', padding: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: 3,
            left: annual ? 24 : 3,
            width: 18, height: 18, borderRadius: '50%',
            background: '#42a5f5', transition: 'left 0.2s',
            boxShadow: '0 0 6px rgba(66,165,245,0.5)',
          }} />
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: annual ? '#e2e8f0' : '#475569', fontWeight: annual ? 600 : 400, transition: 'color 0.2s' }}>Annual</span>
          {annual && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
              color: '#22c55e', letterSpacing: '0.06em',
            }}>SAVE 20%</span>
          )}
        </span>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {PLAN_ORDER.map(planId => {
          const p = PLANS[planId]
          const isCurrent = p.id === currentPlan.id
          const isDowngrade = PLAN_ORDER.indexOf(planId) < PLAN_ORDER.indexOf(currentPlan.id as PlanId)
          const monthlyPrice = p.priceMonthly === 0 ? 0 : Math.round(p.priceMonthly * 1.25)
          const displayPrice = annual ? p.priceMonthly : monthlyPrice
          const annualTotal = p.priceMonthly * 12

          return (
            <div
              key={planId}
              style={{
                background: isCurrent ? `${p.color}08` : '#0d1428',
                border: `1px solid ${isCurrent ? p.color + '50' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 12, padding: '24px 20px',
                display: 'flex', flexDirection: 'column',
                position: 'relative', overflow: 'hidden',
              }}
            >
              {isCurrent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: p.color }} />}
              {planId === 'starter' && !isCurrent && (
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', letterSpacing: '0.08em' }}>BEST VALUE</div>
              )}
              {planId === 'professional' && !isCurrent && (
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(66,165,245,0.15)', border: '1px solid rgba(66,165,245,0.3)', color: '#42a5f5', letterSpacing: '0.08em' }}>POPULAR</div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{p.label}</span>
                  {isCurrent && <span style={{ fontSize: 9, color: '#64748b' }}>· current</span>}
                </div>

                <p className="font-display" style={{ fontSize: 28, fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>
                  {p.price === 'POA' ? 'POA' : p.priceMonthly === 0 ? '€0' : `€${displayPrice}`}
                  {p.price !== 'POA' && p.priceMonthly > 0 && (
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>/mo</span>
                  )}
                </p>
                {p.price === 'POA' ? (
                  <p style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>Contact us for pricing</p>
                ) : p.priceMonthly > 0 && (
                  <p style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                    {annual
                      ? `€${annualTotal.toLocaleString()} billed annually`
                      : 'billed monthly · no commitment'}
                  </p>
                )}
              </div>

              <div style={{ flex: 1, marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <Limit label="Scans/mo" value={p.scansPerMonth === null ? 'Unlimited' : String(p.scansPerMonth)} color={p.color} />
                  <Limit label="Targets" value={p.targetsMax === null ? 'Unlimited' : String(p.targetsMax)} color={p.color} />
                  <Limit label="Tokens/mo" value={p.tokensPerMonth === null ? 'Unlimited' : fmtTokens(p.tokensPerMonth)} color={p.color} />
                  <Limit label="Extra tokens" value={p.extraTokenPrice} color={p.color} />
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 11, color: '#94a3b8' }}>
                      <span style={{ color: p.color, flexShrink: 0, marginTop: 1 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                {isCurrent ? (
                  <div>
                    <div style={{ textAlign: 'center', padding: '9px', borderRadius: 8, border: `1px solid ${p.color}30`, color: p.color, fontSize: 12, fontWeight: 600, marginBottom: hasStripeCustomer && planId !== 'free' ? 8 : 0 }}>
                      Current Plan
                    </div>
                    {hasStripeCustomer && planId !== 'free' && (
                      <button
                        onClick={handlePortal}
                        disabled={loading === 'portal'}
                        style={{ width: '100%', padding: '7px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'none', color: '#64748b', fontSize: 11, cursor: 'pointer' }}
                      >
                        {loading === 'portal' ? 'Loading…' : 'Manage subscription →'}
                      </button>
                    )}
                  </div>
                ) : isDowngrade ? (
                  <div style={{ textAlign: 'center', padding: '9px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', color: '#475569', fontSize: 12 }}>
                    Downgrade
                  </div>
                ) : planId === 'enterprise' ? (
                  <a
                    href="mailto:sales@breachr.io?subject=Enterprise plan enquiry"
                    style={{ display: 'block', textAlign: 'center', padding: '9px', borderRadius: 8, background: p.color, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.04em' }}
                  >
                    Contact Sales →
                  </a>
                ) : (
                  <button
                    onClick={() => handleUpgrade(planId)}
                    disabled={loading === planId}
                    style={{ width: '100%', padding: '9px', borderRadius: 8, background: loading === planId ? 'rgba(66,165,245,0.5)' : p.color, color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: loading === planId ? 'wait' : 'pointer', letterSpacing: '0.04em' }}
                  >
                    {loading === planId ? 'Loading…' : `Upgrade to ${p.label} →`}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
