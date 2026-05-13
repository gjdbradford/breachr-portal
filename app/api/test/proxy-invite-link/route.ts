import { NextResponse, type NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  if (!process.env.E2E_TEST_SECRET) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  // Accept secret via header OR query param (browser page.goto can't set headers)
  const secret = req.headers.get('x-test-secret') ?? searchParams.get('secret')
  if (!secret || secret !== process.env.E2E_TEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const actionLink = searchParams.get('url')
  if (!actionLink) return NextResponse.json({ error: 'Missing url param' }, { status: 400 })

  // Only proxy Supabase auth verify URLs to prevent SSRF abuse
  if (!actionLink.includes('/auth/v1/verify')) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  // Server-side fetch — avoids browser DNS restrictions on *.supabase.co
  const supabaseRes = await fetch(actionLink, { redirect: 'manual' })
  const location = supabaseRes.headers.get('location')

  if (!location) {
    const body = await supabaseRes.text().catch(() => '')
    return NextResponse.json({ error: `No redirect from Supabase (${supabaseRes.status}): ${body}` }, { status: 502 })
  }

  // Supabase may redirect to its configured Site URL / path rather than our redirect_to
  // if the URL isn't in the allowlist. Preserve only the hash (session tokens) and
  // hardcode the path to /invite/confirm so the portal processes the invite correctly.
  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const hash = location.includes('#') ? location.slice(location.indexOf('#')) : ''
  const fixedLocation = `${origin}/invite/confirm${hash}`

  return NextResponse.redirect(fixedLocation, { status: 302 })
}
