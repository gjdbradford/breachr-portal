import { NextResponse, type NextRequest } from 'next/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { Webhook } from 'svix'

function admin() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const rawBody = await req.text()
  const svixHeaders = {
    'svix-id':        req.headers.get('svix-id')        ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  }

  let payload: Record<string, unknown>
  try {
    const wh = new Webhook(secret)
    payload = wh.verify(rawBody, svixHeaders) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (payload.type !== 'email.delivered') {
    return NextResponse.json({ ok: true })
  }

  const data    = (payload.data ?? {}) as Record<string, unknown>
  const toRaw   = data.to
  const toEmail = Array.isArray(toRaw) ? String(toRaw[0]) : String(toRaw ?? '')
  const subject = String((data as Record<string, unknown>).subject ?? '')

  await admin()
    .from('webhook_events')
    .insert({ type: payload.type, to_email: toEmail, subject, payload })

  return NextResponse.json({ ok: true })
}
