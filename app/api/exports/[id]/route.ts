import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

const ALLOWED_ROLES = ['admin', 'account_owner']

function admin() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = admin()
  const { data: job } = await db
    .from('data_exports')
    .select('id, file_path, tenant_id')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (job.file_path) {
    await db.storage.from('exports').remove([job.file_path])
  }

  await db.from('data_exports').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
