import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { logAuditEvent } from '@/lib/audit-log'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('id, tenant_id, role').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['admin', 'account_owner'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const activate = body.active !== false

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: existing } = await admin.from('sensors').select('tenant_id, status').eq('id', id).single()
  if (!existing || existing.tenant_id !== profile.tenant_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newStatus = activate ? 'active' : 'disabled'
  const { error } = await admin.from('sensors').update({ status: newStatus }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const action = activate ? 'sensor.activated' : 'sensor.deactivated'
  await logAuditEvent({
    tenantId: profile.tenant_id,
    userId: profile.id,
    action,
    detail: { sensorId: id },
  }).catch(err => console.error('[sensor] audit log failed:', err))

  await admin.from('sensor_logs').insert({
    sensor_id: id,
    tenant_id: profile.tenant_id,
    event_type: activate ? 'activated' : 'deactivated',
    message: activate ? 'Sensor activated' : 'Sensor deactivated',
    metadata: { by_user_id: profile.id },
  })

  return NextResponse.json({ ok: true, status: newStatus })
}
