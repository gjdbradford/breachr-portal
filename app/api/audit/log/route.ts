import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { sha256Hex, GENESIS_HASH } from '@/lib/audit'

const VALID_ACTIONS = [
  'scan.queued', 'scan.started', 'scan.completed', 'scan.launched',
  'finding.discovered', 'finding.verified_fixed', 'finding.status_changed',
  'report.viewed', 'report.downloaded',
  'target.created', 'target.deleted',
  'settings.updated',
] as const

function hmacSha256Hex(key: string, data: string): string {
  return createHmac('sha256', Buffer.from(key, 'hex')).update(data, 'utf8').digest('hex')
}

export async function POST(req: NextRequest) {
  const signingKey = process.env.AUDIT_SIGNING_KEY
  if (!signingKey) return NextResponse.json({ error: 'Audit signing key not configured' }, { status: 500 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const body = await req.json()
  const { action, detail } = body

  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `Invalid action` }, { status: 400 })
  }

  const tenantId = profile.tenant_id
  const ts = new Date().toISOString()
  // Embed ts in detail so it's covered by the signature without touching created_at
  const detailObj = typeof detail === 'object' ? detail : {}
  const detailStr = JSON.stringify({ ...detailObj, _ts: ts })

  const adminClient = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: lastEntry } = await adminClient
    .from('audit_logs')
    .select('signature')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prevHash = lastEntry?.signature
    ? await sha256Hex(lastEntry.signature)
    : GENESIS_HASH

  // Sign: fixed key order for determinism
  const payload = JSON.stringify({ action, detail: detailStr, prev_hash: prevHash, tenant_id: tenantId })
  const signature = hmacSha256Hex(signingKey, payload)

  const { data: inserted, error } = await adminClient
    .from('audit_logs')
    .insert({
      tenant_id: tenantId,
      user_id: user.id,
      action,
      detail: detailStr,
      signature,
      prev_hash: prevHash,
    })
    .select('id, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: inserted.id, ts: inserted.created_at })
}
