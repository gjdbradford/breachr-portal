import { createServerClient } from '@supabase/ssr'
import { createClient as adminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    // Use session.user directly — calling getUser() after exchangeCodeForSession
    // returns null because the new session cookies aren't readable in the same request.
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && session?.user) {
      const user = session.user
      const admin = adminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )

      const { data: existingRows } = await admin
        .from('users')
        .select('id, tenant_id')
        .eq('supabase_uid', user.id)

      const invitedTenantId = user.user_metadata?.invited_tenant_id as string | undefined
      const role = (user.user_metadata?.role as string | undefined) ?? 'admin'
      const alreadyInTenant = existingRows?.some(r => r.tenant_id === invitedTenantId)

      if (invitedTenantId && !alreadyInTenant) {
        const isFirstOrg = !existingRows || existingRows.length === 0
        await admin.from('users').insert({
          ...(isFirstOrg ? { id: user.id } : {}),
          supabase_uid: user.id,
          tenant_id: invitedTenantId,
          email: user.email,
          role,
        })

        await admin
          .from('invitations')
          .update({ accepted_at: new Date().toISOString(), supabase_user_id: user.id })
          .eq('email', user.email!)
          .eq('tenant_id', invitedTenantId)
          .is('accepted_at', null)

        // Send invited user to the accept page to set password and name
        return NextResponse.redirect(`${origin}/invite/accept`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
