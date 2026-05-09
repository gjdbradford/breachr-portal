import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: members }, { data: invitations }] = await Promise.all([
    admin
      .from('users')
      .select('id, email, role, first_name, last_name, created_at, last_login_at')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: true }),
    admin
      .from('invitations')
      .select('id, email, role, expires_at, created_at')
      .eq('tenant_id', profile.tenant_id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({ members: members ?? [], invitations: invitations ?? [] })
}
