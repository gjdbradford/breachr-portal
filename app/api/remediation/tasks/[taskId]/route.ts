import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { can } from '@/lib/permissions'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resolved = await resolvePermissions(user.id)
  if (!can(resolved, 'remediation.tasks.read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: actorUser } = await admin
    .from('users')
    .select('id, tenant_id, role')
    .eq('supabase_uid', user.id)
    .single()
  if (!actorUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  let query = admin
    .from('remediation_tasks')
    .select(`
      id, batch_id, tenant_id, finding_id, assigned_to, status,
      verification_attempts, jira_issue_key, jira_issue_url,
      resolved_by, resolved_at, resolution_source, created_at, updated_at,
      finding:findings(id, title, description, severity, cvss_score, owasp_category, remediation),
      batch:remediation_batches(id, name, priority, due_date, jira_push_enabled)
    `)
    .eq('id', taskId)
    .eq('tenant_id', actorUser.tenant_id)

  if (actorUser.role === 'developer') {
    query = query.eq('assigned_to', actorUser.id)
  }

  const { data: task, error: taskErr } = await query.single()
  if (taskErr || !task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const { data: statusLog } = await admin
    .from('remediation_status_log')
    .select('id, from_status, to_status, changed_by, source, note, scan_result_summary, created_at')
    .eq('task_id', taskId)
    .eq('tenant_id', actorUser.tenant_id)
    .order('created_at', { ascending: true })

  const changedByIds = [
    ...new Set(
      ((statusLog ?? []).map(l => l.changed_by).filter(Boolean)) as string[]
    ),
  ]
  let changedByMap: Record<string, string> = {}
  if (changedByIds.length > 0) {
    const { data: actors } = await admin
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', changedByIds)
    for (const a of actors ?? []) {
      changedByMap[a.id] = a.first_name
        ? `${a.first_name} ${a.last_name ?? ''}`.trim()
        : a.email
    }
  }

  const log = (statusLog ?? []).map(l => ({
    ...l,
    changed_by_name: l.changed_by
      ? (changedByMap[l.changed_by] ?? 'Unknown')
      : 'System',
  }))

  return NextResponse.json({ task, statusLog: log, actorRole: actorUser.role })
}
