import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { can } from '@/lib/permissions'

export async function GET(_req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resolved = await resolvePermissions(user.id)
  if (!can(resolved, 'remediation.tasks.read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // RLS scopes: developer sees only assigned_to batches; admin/owner sees all in tenant
  const { data: batches, error } = await supabase
    .from('remediation_batches')
    .select(`
      id, name, description, priority, status, due_date,
      jira_push_enabled, assigned_to, created_by, created_at, updated_at,
      tasks:remediation_tasks(id, status)
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = (batches ?? []).map(b => {
    const tasks = (b.tasks as Array<{ id: string; status: string }>) ?? []
    return {
      ...b,
      tasks:           undefined,
      total_tasks:     tasks.length,
      completed_tasks: tasks.filter(t => t.status === 'verified_fixed').length,
    }
  })

  return NextResponse.json({ batches: enriched })
}
