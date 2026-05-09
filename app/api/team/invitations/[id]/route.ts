import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: invitation } = await admin
    .from('invitations')
    .select('tenant_id')
    .eq('id', id)
    .single()
  if (!invitation || invitation.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await admin.from('invitations').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
