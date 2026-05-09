import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { logAuditEvent } from '@/lib/audit-log'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const first_name = typeof body.first_name === 'string' ? body.first_name.trim() || null : null
  const last_name  = typeof body.last_name  === 'string' ? body.last_name.trim()  || null : null

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: existing } = await admin.from('users').select('id').eq('id', user.id).single()

  if (!existing) {
    // First time completing the invite — create the public.users row
    const tenantId = user.user_metadata?.invited_tenant_id as string | undefined
    const role     = (user.user_metadata?.role as string | undefined) ?? 'admin'
    if (!tenantId) return NextResponse.json({ error: 'Invite metadata missing' }, { status: 400 })

    await admin.from('users').insert({
      id: user.id,
      tenant_id: tenantId,
      email: user.email,
      role,
      first_name,
      last_name,
    })

    // Mark the invitation as accepted
    await admin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString(), supabase_user_id: user.id })
      .eq('email', user.email!)
      .eq('tenant_id', tenantId)
      .is('accepted_at', null)

    await logAuditEvent({
      tenantId,
      userId:  user.id,
      action:  'user.invite_accepted',
      detail:  { email: user.email, role },
    }).catch(() => {})
  } else {
    // Row exists — just update name
    await admin.from('users').update({ first_name, last_name }).eq('id', user.id)
  }

  return NextResponse.json({ ok: true })
}
