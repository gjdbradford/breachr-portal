import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { can } from '@/lib/permissions'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resolved = await resolvePermissions(user.id)
  if (!can(resolved, 'findings.read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const url = new URL(req.url)
  const status   = url.searchParams.get('status')
  const severity = url.searchParams.get('severity')

  let q = supabase
    .from('findings')
    .select('id, title, severity, owasp_category, status')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })

  if (status)   q = q.eq('status', status)
  if (severity) q = q.eq('severity', severity)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ findings: data ?? [] })
}
