import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { can } from '@/lib/permissions'
import TaskListClient from '@/components/remediation/TaskListClient'
import Link from 'next/link'

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6',
}

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params

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

  const { data: batch } = await admin
    .from('remediation_batches')
    .select(`
      id, name, description, priority, status, due_date, jira_push_enabled, assigned_to,
      assignee:users!assigned_to(first_name, last_name, email)
    `)
    .eq('id', batchId)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!batch) redirect('/dashboard/remediation')

  const isAdmin = profile.role === 'admin' || profile.role === 'account_owner'

  if (!isAdmin && (batch as any).assigned_to !== profile.id) {
    redirect('/dashboard/remediation')
  }

  const { data: rawTasks } = await admin
    .from('remediation_tasks')
    .select(`
      id, status, finding_id, jira_issue_key, updated_at,
      finding:findings(title, severity, owasp_category)
    `)
    .eq('batch_id', batchId)
    .eq('tenant_id', profile.tenant_id)
    .order('updated_at', { ascending: false })

  const tasks = (rawTasks ?? []).map((t: any) => ({
    id:             t.id,
    status:         t.status,
    finding_id:     t.finding_id,
    jira_issue_key: t.jira_issue_key,
    updated_at:     t.updated_at,
    finding:        t.finding ?? null,
  }))

  const pColor     = PRIORITY_COLOR[(batch as any).priority] ?? '#94a3b8'
  const backHref   = isAdmin ? '/dashboard/remediation/admin' : '/dashboard/remediation'
  const totalTasks = tasks.length
  const doneTasks  = tasks.filter(t => t.status === 'verified_fixed').length

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em', margin: 0 }}>
              {(batch as any).name.toUpperCase()}
            </h1>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${pColor}15`, color: pColor, border: `1px solid ${pColor}30`, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {(batch as any).priority}
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            {doneTasks}/{totalTasks} tasks complete
            {(batch as any).due_date && ` · Due ${new Date((batch as any).due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
        <Link href={backHref} style={{ fontSize: 13, color: '#64748b' }}>← Back</Link>
      </div>

      <TaskListClient batchId={batchId} tasks={tasks} isAdmin={isAdmin} />
    </div>
  )
}
