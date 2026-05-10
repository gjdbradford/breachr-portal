import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { ALL_PERMISSIONS } from '@/lib/permissions'

function admin() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string; permission: string }> },
) {
  const { userId, permission } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await admin()
    .from('users')
    .select('tenant_id, role')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!(ALL_PERMISSIONS as readonly string[]).includes(permission)) {
    return NextResponse.json({ error: 'Invalid permission' }, { status: 400 })
  }

  const { data: target } = await admin()
    .from('users')
    .select('permissions, tenant_id')
    .eq('id', userId)
    .single()
  if (!target || target.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const current = (target.permissions ?? {}) as Record<string, boolean>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [permission]: _removed, ...rest } = current
  await admin().from('users').update({ permissions: rest }).eq('id', userId)

  return NextResponse.json({ ok: true })
}
