import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPlan, fmtTokens } from '@/lib/plans'
import Link from 'next/link'
import UpgradePlanCards from '@/components/UpgradePlanCards'

export default async function UpgradePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan, scans_this_month, tokens_used_this_month, plan_scans_limit, plan_tokens_limit, stripe_customer_id')
    .eq('id', profile.tenant_id)
    .single()

  const currentPlan = getPlan(tenant?.plan)

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>UPGRADE PLAN</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Currently on <span style={{ color: currentPlan.color, fontWeight: 600 }}>{currentPlan.label}</span>
          </p>
        </div>
        <Link href="/dashboard/scans" className="btn-s" style={{ fontSize: 12 }}>← Back to Scans</Link>
      </div>

      {/* Current usage */}
      <div className="gs au1" style={{ padding: '16px 20px', marginBottom: 24 }}>
        <p style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontWeight: 600 }}>This Month's Usage</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <UsageStat
            label="Scans used"
            used={tenant?.scans_this_month ?? 0}
            limit={currentPlan.scansPerMonth}
            color="#42a5f5"
            fmt={String}
          />
          <UsageStat
            label="Tokens used"
            used={tenant?.tokens_used_this_month ?? 0}
            limit={currentPlan.tokensPerMonth}
            color="#a78bfa"
            fmt={fmtTokens}
          />
          <div>
            <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Scan types available</p>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['full', 'api', 'tlpt'].map(t => (
                <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: currentPlan.scanTypes.includes(t) ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', color: currentPlan.scanTypes.includes(t) ? '#22c55e' : '#334155', border: `1px solid ${currentPlan.scanTypes.includes(t) ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {currentPlan.scanTypes.includes(t) ? '✓' : '✗'} {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Plan cards with toggle */}
      <UpgradePlanCards currentPlanId={tenant?.plan ?? 'free'} hasStripeCustomer={!!tenant?.stripe_customer_id} />

      {/* Extra tokens CTA */}
      <div className="gs" style={{ padding: '20px 24px', borderRadius: 12, border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>Need more tokens without upgrading?</p>
            <p style={{ fontSize: 12, color: '#64748b' }}>
              Buy a one-time token top-up at <span style={{ color: '#a78bfa', fontWeight: 600 }}>{currentPlan.extraTokenPrice}</span>. Rolls over to next month if unused.
            </p>
          </div>
          <a
            href={`mailto:sales@breachr.io?subject=Token top-up request&body=I'd like to purchase extra tokens for my ${currentPlan.label} plan. My tenant ID is ${profile.tenant_id}.`}
            className="btn-p"
            style={{ fontSize: 12, padding: '9px 20px', textDecoration: 'none', display: 'inline-block' }}
          >
            Buy Extra Tokens →
          </a>
        </div>
      </div>
    </div>
  )
}

function UsageStat({ label, used, limit, color, fmt }: {
  label: string; used: number; limit: number | null; color: string; fmt: (n: number) => string
}) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0
  const over = limit !== null && used >= limit
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: over ? '#ef4444' : '#e2e8f0', fontWeight: 600 }}>
          {fmt(used)}{limit !== null ? ` / ${fmt(limit)}` : ''}
        </span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: limit ? `${pct}%` : '8%', background: over ? '#ef4444' : color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
      <p style={{ fontSize: 10, color: over ? '#ef4444' : '#475569' }}>
        {limit === null ? 'Unlimited' : over ? 'Limit reached' : `${fmt(Math.max(0, limit - used))} remaining`}
      </p>
    </div>
  )
}
