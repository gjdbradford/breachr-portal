import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
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

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resolved = await resolvePermissions(user.id)
  if (!can(resolved, 'remediation.batches.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.name || !body?.priority || !body?.assigned_to) {
    return NextResponse.json({ error: 'name, priority and assigned_to are required' }, { status: 400 })
  }

  const { name, description, priority, due_date, jira_push_enabled, assigned_to, finding_ids } = body as {
    name: string
    description?: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    due_date?: string
    jira_push_enabled?: boolean
    assigned_to: string
    finding_ids?: string[]
  }

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: creator } = await admin
    .from('users')
    .select('id, tenant_id')
    .eq('supabase_uid', user.id)
    .single()
  if (!creator) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: batch, error: batchErr } = await admin
    .from('remediation_batches')
    .insert({
      tenant_id:         creator.tenant_id,
      name,
      description:       description ?? null,
      assigned_to,
      created_by:        creator.id,
      due_date:          due_date ?? null,
      priority,
      jira_push_enabled: jira_push_enabled ?? false,
    })
    .select()
    .single()

  if (batchErr || !batch) {
    return NextResponse.json({ error: batchErr?.message ?? 'Failed to create batch' }, { status: 500 })
  }

  if (finding_ids && finding_ids.length > 0) {
    const tasks = finding_ids.map(fid => ({
      batch_id:    batch.id,
      tenant_id:   creator.tenant_id,
      finding_id:  fid,
      assigned_to,
    }))
    const { error: taskErr } = await admin.from('remediation_tasks').insert(tasks)
    if (taskErr) console.error('[batches POST] task insert failed:', taskErr.message)
  }

  await admin.from('audit_logs').insert({
    tenant_id: creator.tenant_id,
    user_id:   creator.id,
    action:    'remediation.batch_created',
    detail:    JSON.stringify({ batch_id: batch.id, name, assigned_to, finding_count: finding_ids?.length ?? 0 }),
  })

  return NextResponse.json({ batch }, { status: 201 })
}
