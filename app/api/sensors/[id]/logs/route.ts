import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAGE_SIZE = 100

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify sensor belongs to tenant
  const { data: sensor } = await supabase.from('sensors').select('id').eq('id', id).eq('tenant_id', profile.tenant_id).single()
  if (!sensor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('p') ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const { data: logs, count, error } = await supabase
    .from('sensor_logs')
    .select('id, event_type, message, metadata, created_at', { count: 'exact' })
    .eq('sensor_id', id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: logs ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE })
}
