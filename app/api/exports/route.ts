import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { logAuditEvent } from '@/lib/audit-log'
import { resolvePermissions } from '@/lib/resolve-permissions'

const ALLOWED_TYPES   = ['findings', 'inventory', 'audit_trail']
const ALLOWED_FORMATS = ['csv', 'xlsx']

function admin() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resolved = await resolvePermissions(user.id)
  if (!resolved['exports.create']) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { data_type?: unknown; format?: unknown; filters?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const data_type = String(body.data_type ?? '')
  const format    = String(body.format    ?? '')
  const filters   = (body.filters ?? {}) as Record<string, string>

  if (!ALLOWED_TYPES.includes(data_type))   return NextResponse.json({ error: 'Invalid data_type' }, { status: 400 })
  if (!ALLOWED_FORMATS.includes(format))    return NextResponse.json({ error: 'Invalid format' },    { status: 400 })

  const { data, error } = await admin()
    .from('data_exports')
    .insert({
      tenant_id:    profile.tenant_id,
      requested_by: user.id,
      data_type,
      format,
      filters: filters ?? {},
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const hasFilters = Object.keys(filters).length > 0
  await logAuditEvent({
    tenantId: profile.tenant_id,
    userId:   user.id,
    action:   'export.requested',
    detail:   {
      exportId: data.id, data_type, format, requested_by_role: profile.role,
      ...(hasFilters ? { filters: JSON.stringify(filters) } : {}),
    },
  }).catch(() => {})

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  fetch(`${baseUrl}/api/crons/process-exports`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {})

  return NextResponse.json({ id: data.id })
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resolved = await resolvePermissions(user.id)
  if (!resolved['exports.read']) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = admin()
  const { data: exports_ } = await db
    .from('data_exports')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })

  const result = await Promise.all(
    (exports_ ?? []).map(async (e: any) => {
      if (e.status === 'ready' && e.file_path) {
        const { data: signed } = await db.storage
          .from('exports')
          .createSignedUrl(e.file_path, 30 * 24 * 3600)
        return { ...e, signed_url: signed?.signedUrl ?? null }
      }
      return { ...e, signed_url: null }
    })
  )

  return NextResponse.json(result)
}
