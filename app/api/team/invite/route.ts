import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { logAuditEvent } from '@/lib/audit-log'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
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
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { email } = body
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('email', email)
    .single()
  if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 409 })

  const { data: pendingInvite } = await admin
    .from('invitations')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()
  if (pendingInvite) return NextResponse.json({ error: 'Invitation already sent' }, { status: 409 })

  const origin = new URL(req.url).origin
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { invited_tenant_id: profile.tenant_id, role: 'admin' },
    redirectTo: `${origin}/invite/confirm`,
  })
  if (inviteError) {
    console.error('[team/invite]', inviteError)
    const status = inviteError.status ?? 503
    let message = inviteError.message ?? 'Failed to send invitation'
    if (status === 429) message = 'Email rate limit reached — please wait a few minutes and try again'
    else if (message.includes('already been registered') || status === 422) message = 'A user with this email already exists'
    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 503 })
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await admin.from('invitations').insert({
    tenant_id: profile.tenant_id,
    email,
    invited_by: user.id,
    role: 'admin',
    expires_at: expiresAt,
  })

  await logAuditEvent({
    tenantId: profile.tenant_id,
    userId:   user.id,
    action:   'user.invited',
    detail:   { invited_email: email, role: 'admin', expires_at: expiresAt },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
