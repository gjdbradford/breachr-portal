import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { ALL_PERMISSIONS, ADMIN_DEFAULTS, MEMBER_DEFAULTS, type Permission } from '@/lib/permissions'

function admin() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getOwnerProfile(supabaseUserId: string) {
  const db = admin()
  const { data } = await db
    .from('users')
    .select('tenant_id, role')
    .eq('supabase_uid', supabaseUserId)
    .single()
  return data
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getOwnerProfile(user.id)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const role = req.nextUrl.searchParams.get('role')
  if (role !== 'admin' && role !== 'member') {
    return NextResponse.json({ error: 'role must be admin or member' }, { status: 400 })
  }

  const codeDefaults = role === 'admin' ? ADMIN_DEFAULTS : MEMBER_DEFAULTS
  const db = admin()

  const { data: rows } = await db
    .from('role_permissions')
    .select('permission, enabled')
    .eq('tenant_id', profile.tenant_id)
    .eq('role', role)

  // Seed if this tenant has no rows yet for this role
  if (!rows || rows.length === 0) {
    const seeds = ALL_PERMISSIONS.map(p => ({
      tenant_id:  profile.tenant_id,
      role,
      permission: p,
      enabled:    codeDefaults[p] ?? false,
    }))
    try {
      await db
        .from('role_permissions')
        .upsert(seeds, { onConflict: 'tenant_id,role,permission' })
    } catch { /* seeding failure is non-fatal */ }
  }

  const rowIndex: Record<string, boolean> = {}
  for (const r of rows ?? []) rowIndex[r.permission] = r.enabled

  const permMap: Record<string, boolean> = {}
  for (const p of ALL_PERMISSIONS) {
    permMap[p] = p in rowIndex ? rowIndex[p] : (codeDefaults[p as Permission] ?? false)
  }

  return NextResponse.json({ role, permissions: permMap })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getOwnerProfile(user.id)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { role, permission, enabled } = body

  if (role !== 'admin' && role !== 'member') {
    return NextResponse.json({ error: 'role must be admin or member' }, { status: 400 })
  }
  if (!(ALL_PERMISSIONS as readonly string[]).includes(permission)) {
    return NextResponse.json({ error: 'Invalid permission' }, { status: 400 })
  }
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be boolean' }, { status: 400 })
  }

  await admin()
    .from('role_permissions')
    .upsert(
      {
        tenant_id:  profile.tenant_id,
        role,
        permission,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,role,permission' },
    )

  return NextResponse.json({ ok: true })
}
