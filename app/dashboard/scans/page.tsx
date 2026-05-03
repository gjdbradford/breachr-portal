import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import LaunchScanButton from '@/components/LaunchScanButton'

const STATUS_COLOR: Record<string, string> = {
  complete: '#22c55e',
  running: '#42a5f5',
  queued: '#f59e0b',
  failed: '#ef4444',
}

const STATUS_BG: Record<string, string> = {
  complete: 'rgba(34,197,94,0.08)',
  running: 'rgba(66,165,245,0.08)',
  queued: 'rgba(245,158,11,0.08)',
  failed: 'rgba(239,68,68,0.08)',
}

export default async function ScansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const tenantId = profile.tenant_id

  const [{ data: scans }, { data: surfaces }, { data: findingCounts }] = await Promise.all([
    supabase
      .from('scans')
      .select('*, attack_surfaces(name, target_url)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase
      .from('attack_surfaces')
      .select('id, name, target_url')
      .eq('tenant_id', tenantId)
      .eq('active', true),
    supabase
      .from('findings')
      .select('scan_id, severity')
      .eq('tenant_id', tenantId),
  ])

  // Build findings count map
  const countByScan: Record<string, { total: number; critical: number; high: number }> = {}
  for (const f of findingCounts ?? []) {
    if (!countByScan[f.scan_id]) countByScan[f.scan_id] = { total: 0, critical: 0, high: 0 }
    countByScan[f.scan_id].total++
    if (f.severity === 'critical') countByScan[f.scan_id].critical++
    if (f.severity === 'high') countByScan[f.scan_id].high++
  }

  const running = scans?.filter(s => s.status === 'running' || s.status === 'queued').length ?? 0
  const completed = scans?.filter(s => s.status === 'complete').length ?? 0

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>SCANS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {scans?.length ?? 0} total · {running} active · {completed} completed
          </p>
        </div>
        {surfaces && surfaces.length > 0 && (
          <LaunchScanButton surfaces={surfaces} tenantId={tenantId} />
        )}
      </div>

      <div className="gs au1" style={{ overflow: 'hidden' }}>
        {scans && scans.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Type</th>
                <th>Model</th>
                <th>Findings</th>
                <th>Status</th>
                <th>Started</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan: any) => {
                const counts = countByScan[scan.id]
                const color = STATUS_COLOR[scan.status] ?? '#64748b'
                const bg = STATUS_BG[scan.status] ?? 'rgba(100,116,139,0.08)'
                return (
                  <tr key={scan.id} style={{ cursor: 'pointer' }} onClick={() => {}}>
                    <td>
                      <Link href={`/dashboard/scans/${scan.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>
                          {scan.attack_surfaces?.name ?? '—'}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569', marginTop: 1 }}>
                          {scan.attack_surfaces?.target_url ?? '—'}
                        </div>
                      </Link>
                    </td>
                    <td>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
                        {scan.scan_type}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                        {scan.model_used ?? '—'}
                      </span>
                    </td>
                    <td>
                      {counts ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {counts.critical > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                              {counts.critical}C
                            </span>
                          )}
                          {counts.high > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                              {counts.high}H
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: '#64748b' }}>{counts.total} total</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: '#334155' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: bg, color, border: `1px solid ${color}40` }}>
                        {scan.status}
                      </span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>
                      {scan.started_at ? new Date(scan.started_at).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>
                      {scan.completed_at ? new Date(scan.completed_at).toLocaleDateString('en-GB') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No scans yet</p>
            <p style={{ fontSize: 13, marginBottom: 24 }}>Launch your first scan to start finding vulnerabilities.</p>
            {surfaces && surfaces.length === 0 && (
              <Link href="/dashboard/targets" className="btn-p" style={{ fontSize: 13 }}>Add a Target →</Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
