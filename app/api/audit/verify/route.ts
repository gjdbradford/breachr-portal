import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { sha256Hex, GENESIS_HASH } from '@/lib/audit'
import { hmacSha256Hex, safeEqual } from '@/lib/audit-hmac'

export async function GET() {
  const signingKey = process.env.AUDIT_SIGNING_KEY
  if (!signingKey) return NextResponse.json({ error: 'Signing key not configured' }, { status: 500 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const adminClient = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: entries, error } = await adminClient
    .from('audit_logs')
    .select('id, action, detail, tenant_id, prev_hash, signature, created_at')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!entries?.length) return NextResponse.json({ allValid: true, entries: [] })

  const results = await Promise.all(entries.map(async (entry, i) => {
    const expectedPrevHash = i === 0
      ? GENESIS_HASH
      : await sha256Hex(entries[i - 1].signature ?? '')

    const chainValid = entry.prev_hash === expectedPrevHash

    const payload = JSON.stringify({
      action: entry.action,
      detail: entry.detail ?? '',
      prev_hash: entry.prev_hash ?? GENESIS_HASH,
      tenant_id: entry.tenant_id,
    })
    const expectedSig = hmacSha256Hex(signingKey, payload)
    const sigValid = safeEqual(expectedSig, entry.signature ?? '')

    return { id: entry.id, action: entry.action, created_at: entry.created_at, chainValid, sigValid, valid: chainValid && sigValid }
  }))

  const allValid = results.every(r => r.valid)
  return NextResponse.json({ allValid, entries: results })
}
