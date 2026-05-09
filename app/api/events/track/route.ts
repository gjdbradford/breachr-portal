import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event, properties, session_id, url, referrer } = body

    if (!event || typeof event !== 'string') {
      return NextResponse.json({ error: 'missing event' }, { status: 400 })
    }

    // Get user/tenant context — best effort
    let userId: string | null = null
    let tenantId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        const { data: profile } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('supabase_uid', user.id)
          .single()
        tenantId = profile?.tenant_id ?? null
      }
    } catch { /* unauthenticated events are still valid */ }

    // Write with service role so RLS doesn't block
    const db = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await db.from('events').insert({
      tenant_id:  tenantId,
      user_id:    userId,
      session_id,
      event,
      properties: properties ?? {},
      url,
      referrer,
      user_agent: req.headers.get('user-agent'),
    })

    // Side-effects: update last_login_at on login events
    if (event === 'user.logged_in' && tenantId) {
      await db.from('tenants').update({ last_login_at: new Date().toISOString() }).eq('id', tenantId)
      if (userId) {
        await db.from('users').update({
          last_login_at: new Date().toISOString(),
          login_count: db.rpc('increment', { table: 'users', column: 'login_count', row_id: userId }) as any,
        }).eq('id', userId)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Event tracking error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
