import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const tenantId = profile.tenant_id

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, onboarding_complete, plan')
    .eq('id', tenantId)
    .single()

  if (tenant && !tenant.onboarding_complete) redirect('/dashboard/onboarding')

  const [{ count: scanCount }, { count: findingCount }, { data: recentScans }] = await Promise.all([
    supabase.from('scans').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'running'),
    supabase.from('findings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['open', 'in_progress']),
    supabase.from('scans')
      .select('id, status, scan_type, created_at, attack_surfaces(name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const { count: critCount } = await supabase
    .from('findings')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('severity', 'critical')
    .in('status', ['open', 'in_progress'])

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
            OVERVIEW
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{tenant?.name ?? 'Security Dashboard'}</p>
        </div>
        <Link href="/dashboard/scans" className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }}>
          + New Scan
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Active Scans" value={scanCount ?? 0} accent="#42a5f5" />
        <StatCard label="Open Findings" value={findingCount ?? 0} accent="#f59e0b" />
        <StatCard label="Critical Issues" value={critCount ?? 0} accent="#ef4444" />
        <StatCard label="DORA Score" value="—" accent="#22c55e" suffix="" />
      </div>

      {/* Recent scans */}
      <div className="gs au1" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Recent Scans
        </h2>
        {recentScans && recentScans.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Type</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentScans.map((scan: any) => (
                <tr key={scan.id}>
                  <td>{(scan.attack_surfaces as any)?.name ?? '—'}</td>
                  <td style={{ textTransform: 'uppercase', fontSize: 11 }}>{scan.scan_type}</td>
                  <td><span className={`status-${scan.status}`}>{scan.status}</span></td>
                  <td style={{ color: '#64748b' }}>{new Date(scan.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>
            <p style={{ marginBottom: 12 }}>No scans yet.</p>
            <Link href="/dashboard/scans" className="btn-p" style={{ fontSize: 13 }}>Launch your first scan →</Link>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, suffix = '' }: { label: string; value: number | string; accent: string; suffix?: string }) {
  return (
    <div className="stat-card">
      <p style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 36, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums' }}>
        {value}{suffix}
      </p>
    </div>
  )
}
