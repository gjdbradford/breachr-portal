import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent, VALID_AUDIT_ACTIONS } from '@/lib/audit-log'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const body = await req.json()
  const { action, detail } = body

  if (!VALID_AUDIT_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  await logAuditEvent({
    tenantId: profile.tenant_id,
    userId:   user.id,
    action,
    detail: typeof detail === 'object' && detail !== null ? detail : {},
  })

  return NextResponse.json({ ok: true })
}
