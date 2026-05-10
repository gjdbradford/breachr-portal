import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const { data: profile } = await supabase.from('users').select('tenant_id, role').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['admin', 'account_owner'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: sensor } = await supabase.from('sensors').select('id, name').eq('id', id).eq('tenant_id', profile.tenant_id).single()
  if (!sensor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: logs, error } = await supabase
    .from('sensor_logs')
    .select('id, event_type, message, metadata, created_at')
    .eq('sensor_id', id)
    .order('created_at', { ascending: false })
    .limit(10000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = logs ?? []
  const header = 'id,event_type,message,metadata,created_at'
  const csvRows = rows.map(r => [
    r.id,
    `"${(r.event_type ?? '').replace(/"/g, '""')}"`,
    `"${(r.message ?? '').replace(/"/g, '""')}"`,
    `"${JSON.stringify(r.metadata ?? {}).replace(/"/g, '""')}"`,
    r.created_at,
  ].join(','))

  const csv = [header, ...csvRows].join('\n')
  const filename = `sensor-${sensor.name.replace(/[^a-z0-9]/gi, '-')}-logs.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
