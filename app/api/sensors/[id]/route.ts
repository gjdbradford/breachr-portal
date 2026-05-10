import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { logAuditEvent } from '@/lib/audit-log'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: sensor, error } = await supabase
    .from('sensors')
    .select('id, name, location, last_seen, status, deployment_type, config')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (error || !sensor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(sensor)
}

export async function PATCH(
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
  const updates: Record<string, string | null> = {}
  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    if (name.length > 200) return NextResponse.json({ error: 'name too long' }, { status: 400 })
    updates.name = name
  }
  if ('location' in body) {
    updates.location = typeof body.location === 'string' ? body.location.trim() || null : null
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: existing } = await admin.from('sensors').select('tenant_id').eq('id', id).single()
  if (!existing || existing.tenant_id !== profile.tenant_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await admin.from('sensors').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    tenantId: profile.tenant_id,
    userId: profile.id,
    action: 'sensor.updated',
    detail: { sensorId: id, changes: updates },
  }).catch(err => console.error('[sensor] audit log failed:', err))

  await admin.from('sensor_logs').insert({
    sensor_id: id,
    tenant_id: profile.tenant_id,
    event_type: 'updated',
    message: `Sensor updated: ${Object.keys(updates).join(', ')}`,
    metadata: updates,
  })

  return NextResponse.json({ ok: true })
}
