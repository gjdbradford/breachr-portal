import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { logAuditEvent } from '@/lib/audit-log'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { sendTeamInviteEmail } from '@/lib/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const resolved = await resolvePermissions(user.id)
  if (!resolved['team.invite']) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { email } = body
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  // Check: already a member of THIS tenant
  const { data: existingMember } = await admin
    .from('users')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('email', email)
    .single()
  if (existingMember) return NextResponse.json({ error: 'This person is already a member of your organisation.' }, { status: 409 })

  // Check: pending invite for THIS tenant
  const { data: pendingInvite } = await admin
    .from('invitations')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()
  if (pendingInvite) return NextResponse.json({ error: 'An invitation has already been sent to this email.' }, { status: 409 })

  const origin = new URL(req.url).origin
  const isTestEmail = email.toLowerCase().endsWith('@breachr.ai')

  // Check whether this email already has a confirmed Supabase auth account.
  const { data: existingAuthRow } = await admin
    .from('users')
    .select('supabase_uid')
    .eq('email', email)
    .limit(1)
    .maybeSingle()

  // Create the invitation record first so we have its ID to embed in the email link.
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: invitation, error: insertError } = await admin
    .from('invitations')
    .insert({ tenant_id: profile.tenant_id, email, invited_by: user.id, role: 'admin', expires_at: expiresAt })
    .select('id')
    .single()

  if (insertError || !invitation) {
    console.error('[team/invite] insert error', insertError)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }

  // Track whether this is a re-invite (user exists in Supabase auth but never completed setup)
  let reinvited = false

  if (!isTestEmail) {
    // useGenerateLink: true for users who already have a Supabase auth account
    let useGenerateLink = !!existingAuthRow

    if (!useGenerateLink) {
      // New user: Supabase sends the invite email with a link to set up their account.
      const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { invited_tenant_id: profile.tenant_id, role: 'admin' },
        redirectTo: `${origin}/invite/confirm?invite_id=${invitation.id}`,
      })
      if (inviteError) {
        // Status 422 / "already been registered" means the user clicked a previous invite
        // link (creating a Supabase auth record) but never completed account setup.
        // Fall back to the generateLink path so they can finish registration.
        const isPartiallyRegistered =
          inviteError.status === 422 ||
          (inviteError.message ?? '').toLowerCase().includes('already been registered') ||
          (inviteError.message ?? '').toLowerCase().includes('already registered')

        if (!isPartiallyRegistered) {
          await admin.from('invitations').delete().eq('id', invitation.id)
          console.error('[team/invite]', inviteError)
          const status = inviteError.status ?? 503
          let message = inviteError.message ?? 'Failed to send invitation'
          if (status === 429) message = 'Email rate limit reached — please wait a few minutes and try again'
          return NextResponse.json({ error: message }, { status: status >= 400 ? status : 503 })
        }

        useGenerateLink = true
        reinvited = true
      }
    }

    if (useGenerateLink) {
      // Existing user (another org) or partially-registered user: generate a magic link
      // and send via Resend so they can complete or start their setup.
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${origin}/invite/confirm?invite_id=${invitation.id}` },
      })
      if (linkError || !linkData?.properties?.action_link) {
        await admin.from('invitations').delete().eq('id', invitation.id)
        console.error('[team/invite] generateLink error', linkError)
        return NextResponse.json({ error: linkError?.message ?? 'Failed to generate invite link' }, { status: 503 })
      }

      const { data: tenantData } = await admin.from('tenants').select('name').eq('id', profile.tenant_id).single()
      await sendTeamInviteEmail({
        to: email,
        orgName: tenantData?.name ?? 'your organisation',
        inviteLink: linkData.properties.action_link,
      }).catch(err => console.error('[team/invite] sendTeamInviteEmail failed', err))
    }
  }

  await logAuditEvent({
    tenantId: profile.tenant_id,
    userId:   user.id,
    action:   'user.invited',
    detail:   { invited_email: email, role: 'admin', expires_at: expiresAt, reinvited },
  }).catch(() => {})

  return NextResponse.json({ ok: true, reinvited })
}
