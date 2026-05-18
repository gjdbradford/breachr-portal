'use client'

import { useState } from 'react'
import { fmtTokens } from '@/lib/plans'

export interface UpgradePackage {
  id: string
  name: string
  slug: string
  price_monthly: number
  price_annual: number | null
  is_poa: boolean
  scans_limit: number | null
  tokens_limit: number | null
  targets_limit: number | null
  features: Array<{ id: string; text: string; kind: string; icon?: string }>
  badge: string | null
  cta_label: string | null
  stripe_price_monthly_id: string | null
  stripe_price_annual_id: string | null
}

const SLUG_COLORS: Record<string, string> = {
  freemium:     '#64748b',
  starter:      '#22c55e',
  professional: '#42a5f5',
  enterprise:   '#a78bfa',
}
function pkgColor(slug: string): string {
  return SLUG_COLORS[slug] ?? '#64748b'
}

async function startCheckout(packageId: string, period: 'monthly' | 'annual') {
  const res = await fetch('/api/payment/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageId, period }),
  })
  const data = await res.json()
  if (data.url) window.location.href = data.url
  if (data.error) alert(data.error)
}

async function openPortal() {
  const res = await fetch('/api/stripe/portal', { method: 'POST' })
  const data = await res.json()
  if (data.url) window.location.href = data.url
}

function Limit({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</p>
    </div>
  )
}

function fmtLimit(n: number | null): string {
  return n === null ? 'Unlimited' : n >= 1_000_000 ? fmtTokens(n) : String(n)
}

export default function UpgradePlanCards({
  packages,
  currentPlanSlug,
  hasStripeCustomer,
}: {
  packages: UpgradePackage[]
  currentPlanSlug: string
  hasStripeCustomer: boolean
}) {
  const [annual, setAnnual]   = useState(true)
  const [loading, setLoading] = useState<string | null>(null)

  const currentIdx = packages.findIndex(p => p.slug === currentPlanSlug)

  async function handleUpgrade(pkg: UpgradePackage) {
    setLoading(pkg.id)
    await startCheckout(pkg.id, annual ? 'annual' : 'monthly')
    setLoading(null)
  }

  async function handlePortal() {
    setLoading('portal')
    await openPortal()
    setLoading(null)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
        <span style={{ fontSize: 12, color: annual ? '#475569' : '#e2e8f0', fontWeight: annual ? 400 : 600, transition: 'color 0.2s' }}>Monthly</span>
        <button
          onClick={() => setAnnual(a => !a)}
          aria-label="Toggle billing period"
          style={{ width: 48, height: 26, borderRadius: 13, background: 'rgba(66,165,245,0.15)', border: '1px solid rgba(66,165,245,0.35)', cursor: 'pointer', position: 'relative', padding: 0 }}
        >
          <span style={{ position: 'absolute', top: 3, left: annual ? 24 : 3, width: 18, height: 18, borderRadius: '50%', background: '#42a5f5', transition: 'left 0.2s', boxShadow: '0 0 6px rgba(66,165,245,0.5)' }} />
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: annual ? '#e2e8f0' : '#475569', fontWeight: annual ? 600 : 400, transition: 'color 0.2s' }}>Annual</span>
          {annual && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', letterSpacing: '0.06em' }}>SAVE 20%</span>
          )}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${packages.length}, 1fr)`, gap: 16, marginBottom: 32 }}>
        {packages.map((pkg, idx) => {
          const color     = pkgColor(pkg.slug)
          const isCurrent = pkg.slug === currentPlanSlug
          const isDowngrade = idx < currentIdx
          const monthlyPrice = pkg.price_monthly === 0 ? 0 : Math.round(pkg.price_monthly * 1.25)
          const displayPrice = annual ? pkg.price_monthly : monthlyPrice
          const annualTotal  = pkg.price_monthly * 12
          const hasCheckout  = annual ? !!pkg.stripe_price_annual_id : !!pkg.stripe_price_monthly_id

          return (
            <div
              key={pkg.id}
              style={{ background: isCurrent ? `${color}08` : '#0d1428', border: `1px solid ${isCurrent ? color + '50' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: '24px 20px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}
            >
              {isCurrent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }} />}
              {pkg.badge === 'best_value' && !isCurrent && (
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', letterSpacing: '0.08em' }}>BEST VALUE</div>
              )}
              {pkg.badge === 'most_popular' && !isCurrent && (
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(66,165,245,0.15)', border: '1px solid rgba(66,165,245,0.3)', color: '#42a5f5', letterSpacing: '0.08em' }}>POPULAR</div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{pkg.name}</span>
                  {isCurrent && <span style={{ fontSize: 9, color: '#64748b' }}>· current</span>}
                </div>
                <p className="font-display" style={{ fontSize: 28, fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>
                  {pkg.is_poa ? 'POA' : pkg.price_monthly === 0 ? '€0' : `€${displayPrice}`}
                  {!pkg.is_poa && pkg.price_monthly > 0 && <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>/mo</span>}
                </p>
                {pkg.is_poa ? (
                  <p style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>Contact us for pricing</p>
                ) : pkg.price_monthly > 0 && (
                  <p style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                    {annual ? `€${annualTotal.toLocaleString()} billed annually` : 'billed monthly · no commitment'}
                  </p>
                )}
              </div>

              <div style={{ flex: 1, marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <Limit label="Scans/mo"  value={fmtLimit(pkg.scans_limit)}   color={color} />
                  <Limit label="Targets"   value={fmtLimit(pkg.targets_limit)} color={color} />
                  <Limit label="Tokens/mo" value={fmtLimit(pkg.tokens_limit)}  color={color} />
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pkg.features.map(f => (
                    <li key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 11, color: '#94a3b8' }}>
                      <span style={{ color, flexShrink: 0, marginTop: 1 }}>✓</span>
                      {f.text}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                {isCurrent ? (
                  <div>
                    <div style={{ textAlign: 'center', padding: '9px', borderRadius: 8, border: `1px solid ${color}30`, color, fontSize: 12, fontWeight: 600, marginBottom: hasStripeCustomer && pkg.price_monthly > 0 ? 8 : 0 }}>
                      Current Plan
                    </div>
                    {hasStripeCustomer && pkg.price_monthly > 0 && (
                      <button onClick={handlePortal} disabled={loading === 'portal'} style={{ width: '100%', padding: '7px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'none', color: '#64748b', fontSize: 11, cursor: 'pointer' }}>
                        {loading === 'portal' ? 'Loading…' : 'Manage subscription →'}
                      </button>
                    )}
                  </div>
                ) : isDowngrade ? (
                  <div style={{ textAlign: 'center', padding: '9px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', color: '#475569', fontSize: 12 }}>Downgrade</div>
                ) : pkg.is_poa ? (
                  <a href="mailto:sales@breachr.io?subject=Enterprise plan enquiry" style={{ display: 'block', textAlign: 'center', padding: '9px', borderRadius: 8, background: color, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.04em' }}>
                    {pkg.cta_label ?? 'Contact Sales →'}
                  </a>
                ) : !hasCheckout ? (
                  <div style={{ textAlign: 'center', padding: '9px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', color: '#475569', fontSize: 12 }}>Not available</div>
                ) : (
                  <button onClick={() => handleUpgrade(pkg)} disabled={loading === pkg.id} style={{ width: '100%', padding: '9px', borderRadius: 8, background: loading === pkg.id ? `${color}80` : color, color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: loading === pkg.id ? 'wait' : 'pointer', letterSpacing: '0.04em' }}>
                    {loading === pkg.id ? 'Loading…' : (pkg.cta_label ?? `Upgrade to ${pkg.name} →`)}
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
