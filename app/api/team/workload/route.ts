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
  if (!can(resolved, 'team.read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: actorUser } = await admin
    .from('users')
    .select('id, tenant_id')
    .eq('supabase_uid', user.id)
    .single()
  if (!actorUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // All developers in the tenant
  const { data: devUsers, error } = await admin
    .from('users')
    .select('id')
    .eq('tenant_id', actorUser.tenant_id)
    .eq('role', 'developer')
    .order('id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const devIds = (devUsers ?? []).map(d => d.id)
  if (devIds.length === 0) return NextResponse.json({ workload: [] })

  // Active batches per developer
  const { data: activeBatches } = await admin
    .from('remediation_batches')
    .select('assigned_to')
    .eq('tenant_id', actorUser.tenant_id)
    .in('assigned_to', devIds)
    .neq('status', 'archived')

  const batchMap: Record<string, number> = {}
  for (const b of activeBatches ?? []) {
    batchMap[b.assigned_to] = (batchMap[b.assigned_to] ?? 0) + 1
  }

  // Task status counts per developer
  const { data: taskRows } = await admin
    .from('remediation_tasks')
    .select('assigned_to, status')
    .eq('tenant_id', actorUser.tenant_id)
    .in('assigned_to', devIds)
    .in('status', ['open', 'in_progress', 'review_requested'])

  const taskMap: Record<string, { open: number; inProgress: number; reviewRequested: number }> = {}
  for (const t of taskRows ?? []) {
    if (!taskMap[t.assigned_to]) taskMap[t.assigned_to] = { open: 0, inProgress: 0, reviewRequested: 0 }
    if (t.status === 'open')              taskMap[t.assigned_to].open++
    if (t.status === 'in_progress')       taskMap[t.assigned_to].inProgress++
    if (t.status === 'review_requested')  taskMap[t.assigned_to].reviewRequested++
  }

  // AI messages today per developer
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const { data: sessionRows } = await admin
    .from('remediation_ai_sessions')
    .select('user_id, messages')
    .eq('tenant_id', actorUser.tenant_id)
    .in('user_id', devIds)

  const aiMap: Record<string, number> = {}
  for (const s of sessionRows ?? []) {
    const msgs = (s.messages ?? []) as Array<{ role: string; timestamp: string }>
    const todayCount = msgs.filter(m => m.role === 'user' && m.timestamp >= todayISO).length
    aiMap[s.user_id] = (aiMap[s.user_id] ?? 0) + todayCount
  }

  const workload = devIds.map(id => ({
    id,
    activeBatches:    batchMap[id]             ?? 0,
    open:             taskMap[id]?.open         ?? 0,
    inProgress:       taskMap[id]?.inProgress   ?? 0,
    reviewRequested:  taskMap[id]?.reviewRequested ?? 0,
    aiMessagesToday:  aiMap[id]               ?? 0,
  }))

  return NextResponse.json({ workload })
}
