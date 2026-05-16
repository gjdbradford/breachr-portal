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
  if (!can(resolved, 'remediation.batches.read')) {
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

  const { data: tasks, error } = await admin
    .from('remediation_tasks')
    .select(`
      id, batch_id, finding_id, assigned_to, updated_at,
      batch:remediation_batches(name, priority),
      finding:findings(title, severity, owasp_category),
      assignee:users!assigned_to(first_name, last_name, email)
    `)
    .eq('tenant_id', actorUser.tenant_id)
    .eq('status', 'review_requested')
    .order('updated_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tasks: tasks ?? [] })
}
