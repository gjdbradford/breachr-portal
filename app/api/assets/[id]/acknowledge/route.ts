import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { logAuditEvent } from '@/lib/audit-log'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assetId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await admin
    .from('assets')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', assetId)
    .eq('tenant_id', profile.tenant_id)
    .is('acknowledged_at', null)

  if (error) {
    console.error('[acknowledge]', error.message)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }

  await logAuditEvent({
    tenantId: profile.tenant_id,
    userId:   user.id,
    action:   'asset.acknowledged',
    detail:   { assetId },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
