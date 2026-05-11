import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(req: NextRequest) {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const { ownerEmail } = body as { ownerEmail?: string }
  if (!ownerEmail) return NextResponse.json({ error: 'Missing ownerEmail' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // Find the tenant via the owner's users row
  const { data: ownerRow } = await admin
    .from('users')
    .select('tenant_id, supabase_uid')
    .eq('email', ownerEmail)
    .eq('role', 'account_owner')
    .maybeSingle()

  if (!ownerRow) return NextResponse.json({ ok: true }) // already cleaned up

  const tenantId = ownerRow.tenant_id

  // Collect all supabase_uid values before deleting users rows
  const { data: tenantUsers } = await admin
    .from('users')
    .select('supabase_uid')
    .eq('tenant_id', tenantId)

  const uids = (tenantUsers ?? []).map(u => u.supabase_uid as string).filter(Boolean)

  // Delete in FK-safe order
  await admin.from('audit_logs').delete().eq('tenant_id', tenantId)
  await admin.from('invitations').delete().eq('tenant_id', tenantId)
  await admin.from('attack_surfaces').delete().eq('tenant_id', tenantId)
  await admin.from('data_exports').delete().eq('tenant_id', tenantId)
  await admin.from('users').delete().eq('tenant_id', tenantId)
  await admin.from('tenants').delete().eq('id', tenantId)

  // Remove Supabase auth records last
  for (const uid of uids) {
    await admin.auth.admin.deleteUser(uid)
  }

  return NextResponse.json({ ok: true })
}
