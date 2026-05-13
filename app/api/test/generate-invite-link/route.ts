import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.E2E_TEST_SECRET) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  const secret = req.headers.get('x-test-secret')
  if (!secret || secret !== process.env.E2E_TEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Missing email param' }, { status: 400 })
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email param' }, { status: 400 })
  }

  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${origin}/invite/confirm`,
    },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ action_link: data.properties.action_link })
}
