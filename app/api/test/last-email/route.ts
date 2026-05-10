import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  // Blocked on production — VERCEL_ENV is 'production' on prod, 'preview' on staging
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const to    = searchParams.get('to')
  const after = searchParams.get('after') // unix ms timestamp

  if (!to) return NextResponse.json({ error: 'Missing to param' }, { status: 400 })

  let q = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
    .from('webhook_events')
    .select('*')
    .eq('to_email', to)
    .order('received_at', { ascending: false })
    .limit(1)

  if (after) {
    q = q.gte('received_at', new Date(Number(after)).toISOString())
  }

  const { data } = await q
  return NextResponse.json(data?.[0] ?? null)
}
