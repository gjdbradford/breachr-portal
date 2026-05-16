import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { can } from '@/lib/permissions'
import TaskActionBar from '@/components/remediation/TaskActionBar'
import Link from 'next/link'

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#64748b',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', review_requested: 'Review Requested',
  verified_fixed: 'Verified Fixed', failed_verification: 'Failed Verification', reopened: 'Reopened',
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ batchId: string; taskId: string }>
}) {
  const { batchId, taskId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) redirect('/login')

  const resolved = await resolvePermissions(user.id)
  if (!can(resolved, 'remediation.tasks.read')) redirect('/dashboard')

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let taskQuery = admin
    .from('remediation_tasks')
    .select(`
      id, batch_id, status, jira_issue_key,
      resolved_by, resolved_at, resolution_source, verification_attempts,
      finding:findings(id, title, description, severity, cvss_score, owasp_category, remediation),
      batch:remediation_batches(id, name)
    `)
    .eq('id', taskId)
    .eq('tenant_id', profile.tenant_id)

  if (profile.role === 'developer') {
    taskQuery = taskQuery.eq('assigned_to', profile.id)
  }

  const { data: task } = await taskQuery.single()
  if (!task) redirect(`/dashboard/remediation/${batchId}`)

  const { data: statusLog } = await admin
    .from('remediation_status_log')
    .select('id, from_status, to_status, changed_by, source, note, scan_result_summary, created_at')
    .eq('task_id', taskId)
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: true })

  const changedByIds = [
    ...new Set(((statusLog ?? []).map(l => l.changed_by).filter(Boolean)) as string[]),
  ]
  let actorMap: Record<string, string> = {}
  if (changedByIds.length > 0) {
    const { data: actors } = await admin
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', changedByIds)
    for (const a of actors ?? []) {
      actorMap[a.id] = a.first_name ? `${a.first_name} ${a.last_name ?? ''}`.trim() : a.email
    }
  }

  const finding  = (task as any).finding  as { title: string; description: string | null; severity: string; cvss_score: number | null; owasp_category: string | null; remediation: string | null } | null
  const sColor   = SEV_COLOR[finding?.severity ?? ''] ?? '#64748b'
  const isAdmin  = profile.role === 'admin' || profile.role === 'account_owner'

  const lastReopenNote = [...(statusLog ?? [])].reverse().find(l => l.to_status === 'reopened')?.note ?? null

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em', margin: 0, maxWidth: 600 }}>
            {finding?.title ?? taskId}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: `${sColor}15`, color: sColor }}>
              {(finding?.severity ?? '').toUpperCase()}
            </span>
            {finding?.cvss_score && (
              <span style={{ fontSize: 11, color: '#64748b' }}>CVSS {finding.cvss_score}</span>
            )}
            {finding?.owasp_category && (
              <span style={{ fontSize: 11, color: '#64748b' }}>{finding.owasp_category}</span>
            )}
            {(task as any).jira_issue_key && (
              <span style={{ fontSize: 10, color: '#0079b9', padding: '2px 6px', borderRadius: 3, background: 'rgba(0,121,185,0.1)', border: '1px solid rgba(0,121,185,0.2)' }}>
                {(task as any).jira_issue_key}
              </span>
            )}
          </div>
        </div>
        <Link href={`/dashboard/remediation/${batchId}`} style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
          ← {(task as any).batch?.name ?? 'Back'}
        </Link>
      </div>

      {/* Three-panel layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: 16, padding: '0 24px 24px', alignItems: 'start' }}>

        {/* Left — Finding details */}
        <div className="gs au1" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Finding Details</h2>

          <section style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Description / Replication Steps</h3>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {finding?.description ?? 'No description provided.'}
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Remediation Guidance</h3>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {finding?.remediation ?? 'No remediation guidance provided.'}
            </p>
          </section>
        </div>

        {/* Centre — Status + history */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="gs au1" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Actions</h2>
            <TaskActionBar
              taskId={taskId}
              initialStatus={(task as any).status}
              actorRole={profile.role}
              reopenNote={lastReopenNote}
            />
          </div>

          {/* Status history */}
          {(statusLog ?? []).length > 0 && (
            <div className="gs au1" style={{ padding: 20 }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>History</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(statusLog ?? []).map((entry: any) => (
                  <div key={entry.id} style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#42a5f5', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{STATUS_LABEL[entry.to_status] ?? entry.to_status}</span>
                      <span style={{ color: '#64748b' }}> by {actorMap[entry.changed_by] ?? 'System'}</span>
                      <span style={{ color: '#475569', marginLeft: 6 }}>
                        {new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {entry.note && (
                        <p style={{ color: '#94a3b8', marginTop: 2, fontStyle: 'italic' }}>{entry.note}</p>
                      )}
                      {entry.scan_result_summary && (
                        <p style={{ color: '#f97316', marginTop: 2, fontSize: 11 }}>{entry.scan_result_summary}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — AI Assist placeholder (Plan 5 replaces this) */}
        <div className="gs au1" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>AI Assist</span>
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}>COMING SOON</span>
          </div>
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
            AI assist will be available here. Pre-loaded with finding context for this task.
          </div>
        </div>
      </div>
    </div>
  )
}
