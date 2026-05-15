import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

const VALID_ROLES = new Set(['admin', 'member', 'viewer', 'developer'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await admin
    .from('users')
    .select('id, tenant_id, role')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (userId === profile.id) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { role } = body
  if (!VALID_ROLES.has(role)) {
    return NextResponse.json({ error: 'role must be admin, member, viewer, or developer' }, { status: 400 })
  }

  const { data: target } = await admin
    .from('users')
    .select('role, tenant_id')
    .eq('id', userId)
    .single()
  if (!target || target.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (target.role === 'account_owner') {
    return NextResponse.json({ error: 'Cannot change account owner role' }, { status: 403 })
  }

  const { error: updateError } = await admin.from('users').update({ role }).eq('id', userId)
  if (updateError) return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
