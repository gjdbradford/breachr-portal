import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { can } from '@/lib/permissions'
import Link from 'next/link'

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6',
}

function isOverdue(due_date: string | null): boolean {
  if (!due_date) return false
  return new Date(due_date) < new Date()
}

export default async function AdminRemediationPage() {
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
  if (!can(resolved, 'remediation.batches.read')) redirect('/dashboard')

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: rawBatches } = await admin
    .from('remediation_batches')
    .select(`
      id, name, priority, status, due_date, jira_push_enabled, assigned_to, created_at,
      tasks:remediation_tasks(id, status),
      assignee:users!assigned_to(first_name, last_name, email)
    `)
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })

  type BatchRow = {
    id: string; name: string; priority: string; status: string
    due_date: string | null; jira_push_enabled: boolean; assigned_to: string; created_at: string
    total_tasks: number; completed_tasks: number; review_requested_tasks: number; assignee_name: string
  }

  const batches: BatchRow[] = (rawBatches ?? []).map((b: any) => {
    const tasks = (b.tasks ?? []) as Array<{ id: string; status: string }>
    const assignee = b.assignee as { first_name?: string; last_name?: string; email?: string } | null
    return {
      id:                    b.id,
      name:                  b.name,
      priority:              b.priority,
      status:                b.status,
      due_date:              b.due_date,
      jira_push_enabled:     b.jira_push_enabled,
      assigned_to:           b.assigned_to,
      created_at:            b.created_at,
      total_tasks:           tasks.length,
      completed_tasks:       tasks.filter(t => t.status === 'verified_fixed').length,
      review_requested_tasks: tasks.filter(t => t.status === 'review_requested').length,
      assignee_name: assignee?.first_name
        ? `${assignee.first_name} ${assignee.last_name ?? ''}`.trim()
        : (assignee?.email ?? '—'),
    }
  })

  const activeBatches  = batches.filter(b => b.status === 'active').length
  const overdueBatches = batches.filter(b => isOverdue(b.due_date) && b.status === 'active').length
  const awaitingReview = batches.reduce((s, b) => s + b.review_requested_tasks, 0)

  // Verification queue: verified_fixed tasks → finding → original scan → latest verification scan
  const { data: verifiedTasks } = await admin
    .from('remediation_tasks')
    .select('id, batch_id, finding_id, finding:findings(title, severity, scan_id), batch:remediation_batches(name)')
    .eq('tenant_id', profile.tenant_id)
    .eq('status', 'verified_fixed')

  const origScanIds = [...new Set((verifiedTasks ?? []).map((t: any) => t.finding?.scan_id).filter(Boolean) as string[])]

  let verificationQueue: Array<{
    taskId: string; batchId: string; batchName: string
    findingTitle: string; severity: string
    scanStatus: string; progressPct: number | null; queuedAt: string
  }> = []

  if (origScanIds.length > 0) {
    const { data: origScans } = await admin
      .from('scans').select('id, attack_surface_id').in('id', origScanIds)

    const scanToSurface = Object.fromEntries((origScans ?? []).map((s: any) => [s.id, s.attack_surface_id]))

    const surfaceIds = [...new Set(Object.values(scanToSurface) as string[])]
    if (surfaceIds.length > 0) {
      const { data: verifyScans } = await admin
        .from('scans')
        .select('attack_surface_id, status, progress_pct, created_at')
        .eq('tenant_id', profile.tenant_id)
        .eq('scan_type', 'verification')
        .in('attack_surface_id', surfaceIds)
        .order('created_at', { ascending: false })

      const latestBySurface: Record<string, any> = {}
      for (const s of verifyScans ?? []) {
        if (!latestBySurface[s.attack_surface_id]) latestBySurface[s.attack_surface_id] = s
      }

      for (const t of verifiedTasks ?? []) {
        const tAny = t as any
        const surfaceId = scanToSurface[tAny.finding?.scan_id]
        const vs = surfaceId ? latestBySurface[surfaceId] : null
        if (vs) {
          verificationQueue.push({
            taskId:       tAny.id,
            batchId:      tAny.batch_id,
            batchName:    tAny.batch?.name ?? '—',
            findingTitle: tAny.finding?.title ?? 'Unknown finding',
            severity:     tAny.finding?.severity ?? 'info',
            scanStatus:   vs.status,
            progressPct:  vs.progress_pct,
            queuedAt:     vs.created_at,
          })
        }
      }
    }
  }

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>REMEDIATION</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Manage batches and track developer progress</p>
        </div>
        <Link href="/dashboard/remediation/new" className="btn-p" style={{ fontSize: 13, padding: '8px 16px' }}>
          + New Batch
        </Link>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '0 24px 24px' }}>
        {[
          { label: 'Active Batches',         value: activeBatches,  color: '#42a5f5', href: null },
          { label: 'Awaiting Review',         value: awaitingReview, color: '#f97316', href: '/dashboard/remediation/review' },
          { label: 'Overdue Batches',         value: overdueBatches, color: '#ef4444', href: null },
          { label: 'Verified Fixed (Month)',  value: 0,              color: '#4ade80', href: null },
        ].map(card => (
          card.href ? (
            <Link key={card.label} href={card.href} style={{ textDecoration: 'none' }}>
              <div className="gs au1" style={{ padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: card.color, fontFamily: 'monospace' }}>{card.value}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{card.label}</div>
              </div>
            </Link>
          ) : (
            <div key={card.label} className="gs au1" style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: card.color, fontFamily: 'monospace' }}>{card.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{card.label}</div>
            </div>
          )
        ))}
      </div>

      {/* Verification Queue */}
      <div style={{ padding: '0 24px 24px' }}>
        <div className="gs au1" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>Verification Queue</h2>
            {verificationQueue.filter(q => q.scanStatus === 'queued' || q.scanStatus === 'running').length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: 'rgba(66,165,245,0.12)', color: '#42a5f5', border: '1px solid rgba(66,165,245,0.2)' }}>
                {verificationQueue.filter(q => q.scanStatus === 'queued' || q.scanStatus === 'running').length} pending
              </span>
            )}
            <span style={{ fontSize: 11, color: '#475569', marginLeft: 4 }}>Breachr AI re-scans fixes automatically after admin verification</span>
          </div>
          {verificationQueue.length === 0 ? (
            <div style={{ padding: '20px 20px', fontSize: 12, color: '#475569' }}>
              No verification scans queued. Scans are triggered automatically when you mark a fix as Verified.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Finding', 'Batch', 'Severity', 'Scanner Status', 'Queued', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {verificationQueue.map(q => {
                  const isActive = q.scanStatus === 'queued' || q.scanStatus === 'running'
                  const isFailed = q.scanStatus === 'failed'
                  const sColor   = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#64748b' }[q.severity] ?? '#64748b'
                  const scanColor = isActive ? '#42a5f5' : isFailed ? '#ef4444' : '#4ade80'
                  const scanLabel = q.scanStatus === 'queued' ? 'Queued'
                    : q.scanStatus === 'running' ? `Running ${q.progressPct ?? 0}%`
                    : q.scanStatus === 'failed'  ? 'Failed'
                    : 'Complete'

                  return (
                    <tr key={q.taskId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 16px', color: '#e2e8f0', maxWidth: 280 }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.findingTitle}</span>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{q.batchName}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: `${sColor}15`, color: sColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {q.severity}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: scanColor, display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />}
                          <span style={{ fontSize: 12, color: scanColor, fontWeight: 600 }}>{scanLabel}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#475569', fontSize: 12 }}>
                        {new Date(q.queuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <Link href={`/dashboard/remediation/${q.batchId}/${q.taskId}`} style={{ fontSize: 12, color: '#42a5f5' }}>View →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Batch table */}
      <div style={{ padding: '0 24px 24px' }}>
        <div className="gs au1" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Name', 'Assigned To', 'Priority', 'Due Date', 'Progress', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>No batches yet — <Link href="/dashboard/remediation/new" style={{ color: '#42a5f5' }}>create one</Link> to get started.</td></tr>
              ) : batches.map(batch => {
                const pct    = batch.total_tasks > 0 ? Math.round((batch.completed_tasks / batch.total_tasks) * 100) : 0
                const overdue = isOverdue(batch.due_date) && batch.status === 'active'
                const pColor  = PRIORITY_COLOR[batch.priority] ?? '#94a3b8'

                return (
                  <tr key={batch.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 16px', color: '#e2e8f0', fontWeight: 600 }}>
                      <Link href={`/dashboard/remediation/${batch.id}`} style={{ color: '#e2e8f0', textDecoration: 'none' }}>{batch.name}</Link>
                      {batch.review_requested_tasks > 0 && (
                        <span style={{ marginLeft: 8, fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }}>
                          {batch.review_requested_tasks} review
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{batch.assignee_name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${pColor}15`, color: pColor, border: `1px solid ${pColor}30`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {batch.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: overdue ? '#ef4444' : '#94a3b8' }}>
                      {batch.due_date ? new Date(batch.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      {overdue && ' ⚠'}
                    </td>
                    <td style={{ padding: '12px 16px', minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                          <div style={{ height: '100%', borderRadius: 2, background: pct === 100 ? '#4ade80' : '#42a5f5', width: `${pct}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{batch.completed_tasks}/{batch.total_tasks}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: batch.status === 'active' ? 'rgba(74,222,128,0.1)' : 'rgba(148,163,184,0.1)',
                        color: batch.status === 'active' ? '#4ade80' : '#94a3b8', letterSpacing: '0.05em' }}>
                        {batch.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/dashboard/remediation/${batch.id}`} style={{ fontSize: 12, color: '#42a5f5' }}>View →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
