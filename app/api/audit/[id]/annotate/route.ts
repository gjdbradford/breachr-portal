import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { sha256Hex, GENESIS_HASH } from '@/lib/audit'
import { hmacSha256Hex, safeEqual } from '@/lib/audit-hmac'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const idNum = parseInt(id, 10)
  if (isNaN(idNum)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['admin', 'account_owner'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const explanation = typeof body.explanation === 'string' ? body.explanation.trim() : ''
  if (!explanation) return NextResponse.json({ error: 'explanation is required' }, { status: 400 })
  if (explanation.length > 1000) {
    return NextResponse.json({ error: 'explanation too long (max 1000 chars)' }, { status: 400 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: entry } = await admin
    .from('audit_logs')
    .select('id, action, detail, tenant_id, prev_hash, signature, created_at, chain_annotation, chain_annotation_at')
    .eq('id', idNum)
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle()
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (entry.chain_annotation && entry.chain_annotation_at) {
    const windowEnd = new Date(entry.chain_annotation_at).getTime() + 24 * 60 * 60 * 1000
    if (Date.now() > windowEnd) {
      return NextResponse.json(
        { error: 'Annotation locked — 24-hour edit window has passed' },
        { status: 409 },
      )
    }
  }

  // Verify this is a genuine chain break
  const signingKey = process.env.AUDIT_SIGNING_KEY
  if (!signingKey) return NextResponse.json({ error: 'Signing key not configured' }, { status: 500 })

  const { data: prevEntry } = await admin
    .from('audit_logs')
    .select('signature')
    .eq('tenant_id', profile.tenant_id)
    .lt('id', idNum)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  const expectedPrevHash = prevEntry?.signature
    ? await sha256Hex(prevEntry.signature)
    : GENESIS_HASH
  const chainValid = entry.prev_hash === expectedPrevHash

  const payload = JSON.stringify({
    action: entry.action,
    detail: entry.detail ?? '',
    prev_hash: entry.prev_hash ?? GENESIS_HASH,
    tenant_id: entry.tenant_id,
  })
  const expectedSig = hmacSha256Hex(signingKey, payload)
  const sigValid = safeEqual(expectedSig, entry.signature ?? '')

  if (chainValid && sigValid) {
    return NextResponse.json(
      { error: 'This entry passed verification — no annotation needed' },
      { status: 400 },
    )
  }

  const { error } = await admin
    .from('audit_logs')
    .update({
      chain_annotation:    explanation,
      chain_annotation_by: profile.id,
      chain_annotation_at: new Date().toISOString(),
    })
    .eq('id', idNum)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
