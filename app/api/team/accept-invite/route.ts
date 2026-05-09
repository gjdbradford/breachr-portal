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

  // Look up by supabase_uid so we find the user regardless of which org they're
  // currently in (multi-org: same auth identity, different tenant rows).
  const { data: existingRows } = await admin
    .from('users')
    .select('id, tenant_id')
    .eq('supabase_uid', user.id)

  // tenantId may come from Supabase user_metadata (email-link flow for new users)
  // or from the request body (in-app accept flow for existing users).
  const tenantId = (user.user_metadata?.invited_tenant_id as string | undefined)
    ?? (typeof body.tenant_id === 'string' ? body.tenant_id : undefined)
  const role = (user.user_metadata?.role as string | undefined) ?? 'admin'

  // Determine if the user already belongs to this specific tenant
  const alreadyInTenant = existingRows?.some(r => r.tenant_id === tenantId)

  if (!tenantId) return NextResponse.json({ error: 'Invite metadata missing' }, { status: 400 })

  if (!alreadyInTenant) {
    // Create a new public.users row for this org. For brand-new auth users
    // (existingRows empty) we set id = user.id for backward compat with
    // single-org RLS policies. For additional org memberships we use a fresh
    // UUID so we don't violate the PK.
    const isFirstOrg = !existingRows || existingRows.length === 0
    await admin.from('users').insert({
      ...(isFirstOrg ? { id: user.id } : {}),
      supabase_uid: user.id,
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
    // Already a member of this tenant — just update display name
    await admin.from('users').update({ first_name, last_name })
      .eq('supabase_uid', user.id)
      .eq('tenant_id', tenantId)
  }

  return NextResponse.json({ ok: true })
}
