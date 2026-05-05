import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TargetList from '@/components/TargetList'

export default async function TargetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const tenantId = profile.tenant_id

  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan, plan_targets_limit')
    .eq('id', tenantId)
    .single()

  // All surfaces — active and paused — ordered newest first
  const { data: surfaces } = await supabase
    .from('attack_surfaces')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  // Latest scan per surface
  const { data: recentScans } = await supabase
    .from('scans')
    .select('attack_surface_id, status, completed_at, progress_pct')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  // Finding counts per surface (via scan join)
  const { data: findingCounts } = await supabase
    .from('findings')
    .select('scan_id, severity, status')
    .eq('tenant_id', tenantId)
    .in('status', ['open', 'in_progress'])

  // Scan IDs per surface for joining findings
  const { data: allScans } = await supabase
    .from('scans')
    .select('id, attack_surface_id')
    .eq('tenant_id', tenantId)

  type ScanRow = { attack_surface_id: string; status: string; completed_at: string | null; progress_pct: number }
  // Build enrichment maps
  const latestScanBySurface: Record<string, ScanRow> = {}
  for (const scan of recentScans ?? []) {
    if (!latestScanBySurface[scan.attack_surface_id]) {
      latestScanBySurface[scan.attack_surface_id] = scan
    }
  }

  const scanIdToSurface: Record<string, string> = {}
  for (const s of allScans ?? []) scanIdToSurface[s.id] = s.attack_surface_id

  const openCriticalBySurface: Record<string, number> = {}
  const openTotalBySurface: Record<string, number> = {}
  for (const f of findingCounts ?? []) {
    const surfaceId = scanIdToSurface[f.scan_id]
    if (!surfaceId) continue
    openTotalBySurface[surfaceId] = (openTotalBySurface[surfaceId] ?? 0) + 1
    if (f.severity === 'critical') {
      openCriticalBySurface[surfaceId] = (openCriticalBySurface[surfaceId] ?? 0) + 1
    }
  }

  const enriched = (surfaces ?? []).map(s => ({
    ...s,
    latestScan: latestScanBySurface[s.id] ?? null,
    openCritical: openCriticalBySurface[s.id] ?? 0,
    openTotal: openTotalBySurface[s.id] ?? 0,
  }))

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>TARGETS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {enriched.filter(s => s.active).length} active · {enriched.filter(s => !s.active).length} paused
          </p>
        </div>
      </div>
      <TargetList
        surfaces={enriched}
        tenantId={tenantId}
        planId={tenant?.plan ?? 'free'}
        targetsMax={tenant?.plan_targets_limit ?? 1}
      />
    </div>
  )
}
