'use client'

export type SubscriptionData = {
  packageName:  string
  packageSlug:  string
  priceMonthly: number | null
  scansLimit:   number | null
  tokensLimit:  number | null
  targetsLimit: number | null
  ownerEmail:   string | null
  ownerName:    string | null
}

const SALES_EMAIL = 'sales@breachr.ai'

const UPGRADE_CTA: Record<string, { label: string; subject: string }> = {
  freemium:     { label: 'Upgrade Plan →',                           subject: 'Plan upgrade enquiry'    },
  starter:      { label: 'Upgrade Plan →',                           subject: 'Plan upgrade enquiry'    },
  professional: { label: 'Upgrade to Enterprise — Speak to Sales →', subject: 'Enterprise plan enquiry' },
  enterprise:   { label: 'Speak to Sales →',                         subject: 'Enterprise plan enquiry' },
}

function fmtLimit(n: number | null) {
  return n === null ? 'Unlimited' : n.toLocaleString()
}

function fmtPrice(slug: string, price: number | null) {
  if (slug === 'freemium') return 'Free'
  if (slug === 'enterprise' || price === null) return 'Custom pricing'
  return `€${price.toLocaleString()}/month`
}

export default function SubscriptionTab({ data }: { data: SubscriptionData }) {
  const cta = UPGRADE_CTA[data.packageSlug] ?? UPGRADE_CTA.enterprise
  const metrics: [string, string][] = [
    ['Scans / month', fmtLimit(data.scansLimit)],
    ['Scan targets',  fmtLimit(data.targetsLimit)],
    ['AI tokens',     fmtLimit(data.tokensLimit)],
  ]

  return (
    <div style={{ maxWidth: 520 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Current Plan
      </p>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
            background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
            border: '1px solid rgba(59,130,246,0.2)', letterSpacing: '0.08em',
          }}>
            {data.packageName}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
            {fmtPrice(data.packageSlug, data.priceMonthly)}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {metrics.map(([label, value]) => (
            <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '10px 12px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {(data.ownerEmail || data.ownerName) && (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Billing Contact
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
            {data.ownerName ? `${data.ownerName} · ` : ''}{data.ownerEmail}
          </p>
        </>
      )}

      <a
        href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(cta.subject)}`}
        style={{
          display: 'inline-block', padding: '10px 22px',
          background: 'linear-gradient(135deg,#1565c0,#1976d2)',
          color: '#fff', fontSize: 13, fontWeight: 600,
          textDecoration: 'none', borderRadius: 8,
        }}
      >
        {cta.label}
      </a>
    </div>
  )
}
