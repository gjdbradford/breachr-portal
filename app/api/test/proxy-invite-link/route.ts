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

  // Supabase may redirect to its configured Site URL rather than our redirect_to if
  // the redirect_to isn't in the allowlist. Replace whatever domain Supabase chose
  // with the actual staging portal so the browser lands on the right invite/confirm page.
  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const fixedLocation = location.replace(/^https?:\/\/[^/#?]+/, origin)

  return NextResponse.redirect(fixedLocation, { status: 302 })
}
