import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { can } from '@/lib/permissions'
import Link from 'next/link'

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#64748b',
}

function timeInReview(updatedAt: string): string {
  const ms = Date.now() - new Date(updatedAt).getTime()
  const h  = Math.floor(ms / 3_600_000)
  if (h < 1) return '< 1 hour'
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

export default async function ReviewQueuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const resolved = await resolvePermissions(user.id)
  if (!can(resolved, 'remediation.batches.read')) redirect('/dashboard')

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: actorUser } = await admin
    .from('users')
    .select('tenant_id')
    .eq('supabase_uid', user.id)
    .single()
  if (!actorUser) redirect('/login')

  const { data: tasks } = await admin
    .from('remediation_tasks')
    .select(`
      id, batch_id, updated_at,
      batch:remediation_batches(name, priority),
      finding:findings(title, severity, owasp_category),
      assignee:users!assigned_to(first_name, last_name, email)
    `)
    .eq('tenant_id', actorUser.tenant_id)
    .eq('status', 'review_requested')
    .order('updated_at', { ascending: true })

  const rows = (tasks ?? []) as any[]

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>REVIEW QUEUE</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {rows.length} {rows.length === 1 ? 'task' : 'tasks'} awaiting review
          </p>
        </div>
        <Link href="/dashboard/remediation/admin" style={{ fontSize: 13, color: '#64748b' }}>← All batches</Link>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div className="gs au1" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Finding', 'Severity', 'Batch', 'Developer', 'Requested', 'Time in Review', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>No tasks awaiting review.</td></tr>
              ) : rows.map((task: any) => {
                const finding  = task.finding as { title: string; severity: string; owasp_category: string | null } | null
                const batch    = task.batch   as { name: string; priority: string } | null
                const assignee = task.assignee as { first_name?: string; last_name?: string; email?: string } | null
                const sColor   = SEVERITY_COLOR[finding?.severity ?? ''] ?? '#64748b'
                const name     = assignee?.first_name ? `${assignee.first_name} ${assignee.last_name ?? ''}`.trim() : (assignee?.email ?? '—')

                return (
                  <tr key={task.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 16px', color: '#e2e8f0', fontWeight: 600 }}>{finding?.title ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: `${sColor}15`, color: sColor }}>
                        {(finding?.severity ?? '').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{batch?.name ?? '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{name}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                      {new Date(task.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#f97316', fontFamily: 'monospace', fontSize: 12 }}>
                      {timeInReview(task.updated_at)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/dashboard/remediation/${task.batch_id}/${task.id}`} style={{ fontSize: 12, color: '#42a5f5' }}>Review →</Link>
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
