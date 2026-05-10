import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InventoryEmptyState from '@/components/InventoryEmptyState'
import InventoryTable from '@/components/InventoryTable'
import { resolvePermissions } from '@/lib/resolve-permissions'

const PAGE_SIZE = 50

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

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id, role').eq('supabase_uid', user.id).single()
  if (!profile) redirect('/login')

  const page = Math.max(1, parseInt(params.p ?? '1') || 1)

  const [
    { data: assets, count: totalCount },
    { data: tenantRow },
    resolved,
  ] = await Promise.all([
    supabase
      .from('assets')
      .select('id, ip, mac, hostname, vendor, os_guess, last_seen, is_active, risk_score, acknowledged_at, criticality, owner_name', { count: 'exact' })
      .eq('tenant_id', profile.tenant_id)
      .order('risk_score', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('tenants').select('timezone').eq('id', profile.tenant_id).single(),
    resolvePermissions(user.id),
  ])
  const timezone = tenantRow?.timezone ?? 'UTC'

  const assetIds = (assets ?? []).map(a => a.id)
  const { data: portCounts } = assetIds.length > 0
    ? await supabase.from('asset_ports').select('asset_id').in('asset_id', assetIds)
    : { data: [] }

  const portCountMap: Record<string, number> = {}
  for (const p of portCounts ?? []) {
    portCountMap[p.asset_id] = (portCountMap[p.asset_id] ?? 0) + 1
  }

  const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const a of assets ?? []) {
    const score = a.risk_score ?? 0
    if (score >= 80)      riskCounts.critical++
    else if (score >= 50) riskCounts.high++
    else if (score >= 20) riskCounts.medium++
    else if (score > 0)   riskCounts.low++
  }

  const activeCount  = (assets ?? []).filter(a => a.is_active).length
  const unackedCount = (assets ?? []).filter(a => !a.acknowledged_at).length
  const assetList    = assets ?? []
  const total        = totalCount ?? 0

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>INVENTORY</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {activeCount} active assets · {total} total
          </p>
        </div>
      </div>

      {assetList.length === 0 && total === 0 ? (
        <InventoryEmptyState />
      ) : (
        <>
          {unackedCount > 0 && (
            <div style={{ margin: '0 24px 16px', padding: '10px 16px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14 }}>⚠</span>
              <span style={{ fontSize: 13, color: '#fca5a5' }}>
                <strong>{unackedCount} new {unackedCount === 1 ? 'device' : 'devices'} detected</strong>
                {' '}— open each to acknowledge and clear this alert.
              </span>
            </div>
          )}
          <div style={{ padding: '0 24px 16px' }}>
            <RiskBar counts={riskCounts} />
          </div>
          <div className="gs au1" style={{ padding: 24 }}>
            <InventoryTable
              assets={assetList}
              portCountMap={portCountMap}
              canClassify={resolved['assets.update']}
              canExport={resolved['exports.create']}
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={total}
              timezone={timezone}
            />
          </div>
        </>
      )}
    </div>
  )
}
