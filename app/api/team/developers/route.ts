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
  if (!can(resolved, 'remediation.batches.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: actorUser } = await admin
    .from('users')
    .select('tenant_id')
    .eq('supabase_uid', user.id)
    .single()
  if (!actorUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: devUsers, error } = await admin
    .from('users')
    .select('id, first_name, last_name, email')
    .eq('tenant_id', actorUser.tenant_id)
    .eq('role', 'developer')
    .order('first_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const devIds = (devUsers ?? []).map(d => d.id)
  let activeCounts: Record<string, number> = {}

  if (devIds.length > 0) {
    const { data: taskRows } = await admin
      .from('remediation_tasks')
      .select('assigned_to')
      .eq('tenant_id', actorUser.tenant_id)
      .in('status', ['open', 'in_progress', 'review_requested'])
    for (const row of taskRows ?? []) {
      activeCounts[row.assigned_to] = (activeCounts[row.assigned_to] ?? 0) + 1
    }
  }

  const developers = (devUsers ?? []).map(d => ({
    id:          d.id,
    name:        d.first_name ? `${d.first_name} ${d.last_name ?? ''}`.trim() : d.email,
    email:       d.email,
    activeTasks: activeCounts[d.id] ?? 0,
  }))

  return NextResponse.json({ developers })
}
