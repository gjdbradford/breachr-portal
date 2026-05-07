import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function RiskBar({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return null
  const colors: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e',
  }
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {(['critical', 'high', 'medium', 'low'] as const).map(s => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[s] }} />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            <span style={{ color: colors[s], fontWeight: 700 }}>{counts[s] ?? 0}</span> {s}
          </span>
        </div>
      ))}
    </div>
  )
}

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: assets } = await supabase
    .from('assets')
    .select('id, ip, mac, hostname, vendor, os_guess, last_seen, is_active, risk_score')
    .eq('tenant_id', profile.tenant_id)
    .order('risk_score', { ascending: false })

  // Count open ports per asset
  const assetIds = (assets ?? []).map(a => a.id)
  const { data: portCounts } = assetIds.length > 0
    ? await supabase
        .from('asset_ports')
        .select('asset_id')
        .in('asset_id', assetIds)
    : { data: [] }

  const portCountMap: Record<string, number> = {}
  for (const p of portCounts ?? []) {
    portCountMap[p.asset_id] = (portCountMap[p.asset_id] ?? 0) + 1
  }

  // Risk severity counts
  const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const a of assets ?? []) {
    const score = a.risk_score ?? 0
    if (score >= 80)      riskCounts.critical++
    else if (score >= 50) riskCounts.high++
    else if (score >= 20) riskCounts.medium++
    else if (score > 0)   riskCounts.low++
  }

  const activeCount = (assets ?? []).filter(a => a.is_active).length

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>INVENTORY</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {activeCount} active assets · {(assets ?? []).length} total
          </p>
        </div>
      </div>

      {(assets ?? []).length > 0 && (
        <div style={{ padding: '0 24px 16px' }}>
          <RiskBar counts={riskCounts} />
        </div>
      )}

      <div className="gs au1" style={{ padding: 24 }}>
        {(assets ?? []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No assets discovered yet</p>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              Deploy a sensor in your network to start discovering assets.{' '}
              <Link href="/dashboard/sensors" style={{ color: '#42a5f5' }}>Add a sensor →</Link>
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>IP</th>
                <th>Hostname</th>
                <th>Vendor / OS</th>
                <th>Ports</th>
                <th>Risk</th>
                <th>Last seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(assets ?? []).map(a => {
                const score = a.risk_score ?? 0
                const riskColor = score >= 80 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 20 ? '#f59e0b' : '#22c55e'
                return (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 13, color: '#e2e8f0' }}>{a.ip}</td>
                    <td style={{ fontSize: 12, color: '#94a3b8' }}>{a.hostname ?? '—'}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>
                      {[a.vendor, a.os_guess].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{portCountMap[a.id] ?? 0}</td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 700, color: score > 0 ? riskColor : '#475569' }}>
                        {score > 0 ? score : '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>
                      {new Date(a.last_seen).toLocaleDateString('en-GB')}
                      {!a.is_active && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: '#475569',
                          background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>
                          offline
                        </span>
                      )}
                    </td>
                    <td>
                      <Link href={`/dashboard/inventory/${a.id}`} className="btn-s"
                        style={{ fontSize: 12, padding: '4px 12px' }}>
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
