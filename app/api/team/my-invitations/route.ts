import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Get the tenants this user already belongs to so we don't show re-invites
  const { data: memberships } = await admin
    .from('users')
    .select('tenant_id')
    .eq('supabase_uid', user.id)

  const alreadyMemberOf = new Set((memberships ?? []).map((m: { tenant_id: string }) => m.tenant_id))

  const { data: invitations } = await admin
    .from('invitations')
    .select('id, tenant_id, role, expires_at, tenants(name)')
    .eq('email', user.email!)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  const filtered = (invitations ?? []).filter((inv: { tenant_id: string }) => !alreadyMemberOf.has(inv.tenant_id))

  return NextResponse.json({ invitations: filtered })
}
