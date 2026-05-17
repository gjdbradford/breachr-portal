import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { can } from '@/lib/permissions'
import Link from 'next/link'

type Batch = {
  id: string
  name: string
  description: string | null
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'active' | 'completed' | 'archived'
  due_date: string | null
  jira_push_enabled: boolean
  total_tasks: number
  completed_tasks: number
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6',
}

const STATUS_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',    color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  completed: { label: 'Completed', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  archived:  { label: 'Archived',  color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
}

function isDueUrgent(due_date: string | null): boolean {
  if (!due_date) return false
  const due = new Date(due_date)
  const now = new Date()
  return due <= new Date(now.getTime() + 48 * 60 * 60 * 1000)
}

const PRIORITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

export default async function RemediationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) redirect('/login')

  const resolved = await resolvePermissions(user.id)
  if (!can(resolved, 'remediation.tasks.read')) redirect('/dashboard')

  // Admins/owners get the admin view (Plan 3)
  if (profile.role === 'account_owner' || profile.role === 'admin') {
    redirect('/dashboard/remediation/admin')
  }

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Verification queue for this developer's verified_fixed tasks
  const { data: devProfile } = await admin
    .from('users').select('id').eq('supabase_uid', user.id).single()

  let devVerificationQueue: Array<{
    taskId: string; batchId: string; batchName: string
    findingTitle: string; scanStatus: string; progressPct: number | null; queuedAt: string
  }> = []

  if (devProfile?.id) {
    const { data: verifiedTasks } = await admin
      .from('remediation_tasks')
      .select('id, batch_id, finding_id, finding:findings(title, scan_id), batch:remediation_batches(name)')
      .eq('tenant_id', profile.tenant_id)
      .eq('assigned_to', devProfile.id)
      .eq('status', 'verified_fixed')

    const origScanIds = [...new Set((verifiedTasks ?? []).map((t: any) => t.finding?.scan_id).filter(Boolean) as string[])]
    if (origScanIds.length > 0) {
      const { data: origScans } = await admin.from('scans').select('id, attack_surface_id').in('id', origScanIds)
      const scanToSurface = Object.fromEntries((origScans ?? []).map((s: any) => [s.id, s.attack_surface_id]))
      const surfaceIds = [...new Set(Object.values(scanToSurface) as string[])]
      if (surfaceIds.length > 0) {
        const { data: verifyScans } = await admin
          .from('scans').select('attack_surface_id, status, progress_pct, created_at')
          .eq('tenant_id', profile.tenant_id).eq('scan_type', 'verification')
          .in('attack_surface_id', surfaceIds).order('created_at', { ascending: false })
        const latestBySurface: Record<string, any> = {}
        for (const s of verifyScans ?? []) {
          if (!latestBySurface[s.attack_surface_id]) latestBySurface[s.attack_surface_id] = s
        }
        for (const t of verifiedTasks ?? []) {
          const tAny = t as any
          const surfaceId = scanToSurface[tAny.finding?.scan_id]
          const vs = surfaceId ? latestBySurface[surfaceId] : null
          if (vs) {
            devVerificationQueue.push({
              taskId: tAny.id, batchId: tAny.batch_id,
              batchName: tAny.batch?.name ?? '—',
              findingTitle: tAny.finding?.title ?? 'Unknown finding',
              scanStatus: vs.status, progressPct: vs.progress_pct, queuedAt: vs.created_at,
            })
          }
        }
      }
    }
  }

  // Developer: RLS scopes to assigned_to automatically
  const { data: rawBatches } = await supabase
    .from('remediation_batches')
    .select(`
      id, name, description, priority, status, due_date,
      jira_push_enabled,
      tasks:remediation_tasks(id, status)
    `)

  const batches: Batch[] = (rawBatches ?? []).map(b => {
    const tasks = (b.tasks as Array<{ id: string; status: string }>) ?? []
    return {
      id:              b.id,
      name:            b.name,
      description:     b.description,
      priority:        b.priority as Batch['priority'],
      status:          b.status as Batch['status'],
      due_date:        b.due_date,
      jira_push_enabled: b.jira_push_enabled,
      total_tasks:     tasks.length,
      completed_tasks: tasks.filter(t => t.status === 'verified_fixed').length,
    }
  })

  batches.sort((a, b) => {
    const aUrgent = isDueUrgent(a.due_date) ? 1 : 0
    const bUrgent = isDueUrgent(b.due_date) ? 1 : 0
    if (bUrgent !== aUrgent) return bUrgent - aUrgent
    const pDiff = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0)
    if (pDiff !== 0) return pDiff
    if (!a.due_date && b.due_date) return 1
    if (a.due_date && !b.due_date) return -1
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    return 0
  })

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>MY TASKS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Your assigned remediation batches</p>
        </div>
      </div>

      {/* Verification queue for developer */}
      {devVerificationQueue.length > 0 && (
        <div style={{ padding: '0 24px 8px' }}>
          <div className="gs au1" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>Your Fixes Being Verified</h2>
              <span style={{ fontSize: 11, color: '#475569' }}>Breachr AI is re-scanning to confirm your fixes</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {devVerificationQueue.map(q => {
                const isActive  = q.scanStatus === 'queued' || q.scanStatus === 'running'
                const isFailed  = q.scanStatus === 'failed'
                const scanColor = isActive ? '#42a5f5' : isFailed ? '#ef4444' : '#4ade80'
                const scanLabel = q.scanStatus === 'queued'  ? 'Queued — awaiting scanner'
                  : q.scanStatus === 'running' ? `Running ${q.progressPct ?? 0}%`
                  : q.scanStatus === 'failed'  ? 'Scan failed'
                  : 'Scan complete'
                return (
                  <div key={q.taskId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                    {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: scanColor, display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />}
                    {!isActive && <span style={{ fontSize: 13, color: scanColor, flexShrink: 0 }}>{isFailed ? '✕' : '✓'}</span>}
                    <span style={{ color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.findingTitle}</span>
                    <span style={{ color: '#64748b', flexShrink: 0 }}>{q.batchName}</span>
                    <span style={{ color: scanColor, fontWeight: 600, flexShrink: 0 }}>{scanLabel}</span>
                    <Link href={`/dashboard/remediation/${q.batchId}/${q.taskId}`} style={{ color: '#42a5f5', flexShrink: 0 }}>View →</Link>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {batches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px', color: '#64748b' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>&#x2713;</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>No active batches</p>
          <p style={{ fontSize: 13 }}>Your admin will assign remediation work here when it&apos;s ready.</p>
        </div>
      ) : (
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {batches.map(batch => {
            const pct    = batch.total_tasks > 0 ? Math.round((batch.completed_tasks / batch.total_tasks) * 100) : 0
            const urgent = isDueUrgent(batch.due_date)
            const chip   = STATUS_CHIP[batch.status] ?? STATUS_CHIP.active
            const pColor = PRIORITY_COLOR[batch.priority] ?? '#94a3b8'

            return (
              <Link key={batch.id} href={`/dashboard/remediation/${batch.id}`} style={{ textDecoration: 'none' }}>
                <div className="gs au1" style={{ padding: 20, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', flex: 1, marginRight: 8 }}>{batch.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: chip.bg, color: chip.color, border: `1px solid ${chip.color}33`, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>
                      {chip.label}
                    </span>
                  </div>

                  {batch.description && (
                    <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {batch.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${pColor}15`, color: pColor, border: `1px solid ${pColor}30`, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {batch.priority}
                    </span>
                    {batch.due_date && (
                      <span style={{ fontSize: 11, color: urgent ? '#ef4444' : '#64748b' }}>
                        {urgent ? '⚠ ' : ''}Due {new Date(batch.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {batch.jira_push_enabled && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,121,185,0.12)', color: '#0079b9', border: '1px solid rgba(0,121,185,0.25)', marginLeft: 'auto' }}>Jira</span>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{batch.completed_tasks} of {batch.total_tasks} tasks complete</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: pct === 100 ? '#4ade80' : '#42a5f5', width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
