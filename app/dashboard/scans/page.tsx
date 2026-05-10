import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import LaunchScanButton from '@/components/LaunchScanButton'
import ScansEmptyState from '@/components/ScansEmptyState'
import { formatFriendly } from '@/lib/format-date'

const STATUS_COLOR: Record<string, string> = {
  complete: '#22c55e',
  running:  '#42a5f5',
  queued:   '#f59e0b',
  failed:   '#ef4444',
}

const STATUS_BG: Record<string, string> = {
  complete: 'rgba(34,197,94,0.08)',
  running:  'rgba(66,165,245,0.08)',
  queued:   'rgba(245,158,11,0.08)',
  failed:   'rgba(239,68,68,0.08)',
}

function fmtDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return '—'
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

export default async function ScansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) redirect('/login')

  const tenantId = profile.tenant_id

  const [{ data: scans }, { data: surfaces }, { data: findingCounts }, { data: tenant }] = await Promise.all([
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
      .select('scan_id, severity, status')
      .eq('tenant_id', tenantId),
    supabase
      .from('tenants')
      .select('plan, plan_scans_limit, plan_targets_limit, plan_tokens_limit, scans_this_month, tokens_used_this_month, timezone')
      .eq('id', tenantId)
      .single(),
  ])

  // Build findings count map
  const countByScan: Record<string, { total: number; critical: number; high: number; medium: number; open: number }> = {}
  for (const f of findingCounts ?? []) {
    if (!countByScan[f.scan_id]) countByScan[f.scan_id] = { total: 0, critical: 0, high: 0, medium: 0, open: 0 }
    countByScan[f.scan_id].total++
    if (f.severity === 'critical') countByScan[f.scan_id].critical++
    if (f.severity === 'high')     countByScan[f.scan_id].high++
    if (f.severity === 'medium')   countByScan[f.scan_id].medium++
    if (f.status === 'open' || f.status === 'in_progress') countByScan[f.scan_id].open++
  }

  const total     = scans?.length ?? 0
  const running   = scans?.filter(s => s.status === 'running' || s.status === 'queued').length ?? 0
  const completed = scans?.filter(s => s.status === 'complete').length ?? 0
  const failed    = scans?.filter(s => s.status === 'failed').length ?? 0
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
  const totalFindings = (findingCounts ?? []).length
  const criticalFindings = (findingCounts ?? []).filter(f => f.severity === 'critical').length

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>SCANS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {total} total · {running > 0 ? <><span style={{ color: '#42a5f5' }}>{running} active</span> · </> : null}{completed} completed{failed > 0 ? ` · ${failed} failed` : ''}
          </p>
        </div>
        {surfaces && surfaces.length > 0 && (
          <LaunchScanButton
            surfaces={surfaces}
            tenantId={tenantId}
            planId={tenant?.plan ?? 'free'}
            scansThisMonth={tenant?.scans_this_month ?? 0}
            tokensThisMonth={tenant?.tokens_used_this_month ?? 0}
          />
        )}
      </div>

      {/* Summary stats */}
      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Scans',      value: String(total),          color: '#e2e8f0', sub: `${completed} completed` },
            { label: 'Completion Rate',  value: `${completionRate}%`,   color: completionRate >= 80 ? '#22c55e' : completionRate >= 50 ? '#f59e0b' : '#ef4444', sub: `${failed} failed` },
            { label: 'Total Findings',   value: String(totalFindings),  color: totalFindings > 0 ? '#f59e0b' : '#22c55e', sub: `${criticalFindings} critical` },
            { label: 'Active Now',       value: String(running),        color: running > 0 ? '#42a5f5' : '#475569', sub: running > 0 ? 'scanning…' : 'no active scans' },
          ].map(stat => (
            <div key={stat.label} className="gs" style={{ padding: '14px 16px', borderRadius: 10 }}>
              <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{stat.label}</p>
              <p className="font-display" style={{ fontSize: 24, fontWeight: 800, color: stat.color, lineHeight: 1, marginBottom: 4 }}>{stat.value}</p>
              <p style={{ fontSize: 10, color: '#334155' }}>{stat.sub}</p>
            </div>
          ))}
        </div>
      )}

      {(!scans || scans.length === 0) && (
        <ScansEmptyState
          surfaces={surfaces ?? []}
          tenantId={tenantId}
          planId={tenant?.plan ?? 'free'}
          scansThisMonth={tenant?.scans_this_month ?? 0}
          tokensThisMonth={tenant?.tokens_used_this_month ?? 0}
        />
      )}

      <div className="gs au1" style={{ overflow: 'hidden', display: scans && scans.length > 0 ? 'block' : 'none' }}>
        {scans && scans.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Type</th>
                <th>Findings</th>
                <th>Duration</th>
                <th>Cost</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan: any) => {
                const counts = countByScan[scan.id]
                const color  = STATUS_COLOR[scan.status] ?? '#64748b'
                const bg     = STATUS_BG[scan.status]   ?? 'rgba(100,116,139,0.08)'
                const href   = `/dashboard/scans/${scan.id}`
                const duration = fmtDuration(scan.started_at, scan.completed_at)
                return (
                  <tr key={scan.id}>
                    <td>
                      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>
                          {scan.attack_surfaces?.name ?? '—'}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569', marginTop: 1 }}>
                          {scan.attack_surfaces?.target_url ?? '—'}
                        </div>
                      </Link>
                    </td>
                    <td>
                      <Link href={href} style={{ textDecoration: 'none', display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
                        {scan.scan_type ?? '—'}
                      </Link>
                    </td>
                    <td>
                      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
                        {counts ? (
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
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
                            {counts.medium > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                                {counts.medium}M
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: '#64748b' }}>{counts.total}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#334155' }}>—</span>
                        )}
                      </Link>
                    </td>
                    <td>
                      <Link href={href} style={{ textDecoration: 'none', display: 'block', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>
                        {duration}
                      </Link>
                    </td>
                    <td>
                      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
                        {scan.cost_usd > 0 ? (
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#22c55e' }}>
                            ${Number(scan.cost_usd).toFixed(4)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#334155' }}>—</span>
                        )}
                      </Link>
                    </td>
                    <td>
                      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: bg, color, border: `1px solid ${color}40` }}>
                          {scan.status === 'running' ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#42a5f5', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                              {scan.status}
                            </span>
                          ) : scan.status}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link href={href} style={{ textDecoration: 'none', display: 'block', color: '#64748b', fontSize: 12 }}>
                        {scan.completed_at
                          ? formatFriendly(scan.completed_at, tenant?.timezone ?? 'UTC')
                          : scan.started_at
                            ? formatFriendly(scan.started_at, tenant?.timezone ?? 'UTC')
                            : '—'}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  )
}
