import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ScansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: scans } = await supabase
    .from('scans')
    .select('*, attack_surfaces(name, target_url)')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })

  const { data: surfaces } = await supabase
    .from('attack_surfaces')
    .select('id, name')
    .eq('tenant_id', profile.tenant_id)
    .eq('active', true)

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>SCANS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{scans?.length ?? 0} total scans</p>
        </div>
        {surfaces && surfaces.length > 0 && (
          <LaunchScanButton surfaces={surfaces} tenantId={profile.tenant_id} />
        )}
      </div>

      <div className="gs au1" style={{ padding: 24 }}>
        {scans && scans.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>URL</th>
                <th>Type</th>
                <th>Status</th>
                <th>Started</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan: any) => (
                <tr key={scan.id}>
                  <td>{scan.attack_surfaces?.name ?? '—'}</td>
                  <td style={{ color: '#64748b', fontSize: 12 }}>{scan.attack_surfaces?.target_url ?? '—'}</td>
                  <td style={{ textTransform: 'uppercase', fontSize: 11 }}>{scan.scan_type}</td>
                  <td><span className={`status-${scan.status}`}>{scan.status}</span></td>
                  <td style={{ color: '#64748b', fontSize: 12 }}>
                    {scan.started_at ? new Date(scan.started_at).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td style={{ color: '#64748b', fontSize: 12 }}>
                    {scan.completed_at ? new Date(scan.completed_at).toLocaleDateString('en-GB') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No scans yet</p>
            <p style={{ fontSize: 13, marginBottom: 24 }}>Launch your first scan to start finding vulnerabilities.</p>
            {surfaces && surfaces.length === 0 && (
              <Link href="/dashboard/onboarding" className="btn-p" style={{ fontSize: 13 }}>Add Target URLs →</Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Inline client component for the launch button
function LaunchScanButton({ surfaces, tenantId }: { surfaces: any[]; tenantId: string }) {
  return null // Scan launch will be implemented when pentest engine is ready
}
