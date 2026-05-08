import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

const ALLOWED_ROLES   = ['admin', 'account_owner']
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
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { data_type, format, filters } = body

  if (!ALLOWED_TYPES.includes(data_type)) {
    return NextResponse.json({ error: 'Invalid data_type' }, { status: 400 })
  }
  if (!ALLOWED_FORMATS.includes(format)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  }

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
  return NextResponse.json({ id: data.id })
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
