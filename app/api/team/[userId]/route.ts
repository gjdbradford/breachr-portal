import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (userId === user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 403 })
  }

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: target } = await admin
    .from('users')
    .select('role, tenant_id')
    .eq('id', userId)
    .single()
  if (!target || target.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (target.role === 'account_owner') {
    return NextResponse.json({ error: 'Cannot remove account owner' }, { status: 403 })
  }

  await admin.from('users').delete().eq('id', userId)
  return NextResponse.json({ ok: true })
}
