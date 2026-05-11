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

async function requireOwner(supabaseUserId: string) {
  const { data } = await admin()
    .from('users')
    .select('tenant_id, role')
    .eq('supabase_uid', supabaseUserId)
    .single()
  return data
}

function flattenJsonbOverrides(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean') {
      out[k] = v
    } else if (v && typeof v === 'object') {
      for (const [action, val] of Object.entries(v as Record<string, boolean>)) {
        if (typeof val === 'boolean') out[`${k}.${action}`] = val
      }
    }
  }
  return out
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await requireOwner(user.id)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: target } = await admin()
    .from('users')
    .select('role, permissions, tenant_id')
    .eq('id', userId)
    .single()
  if (!target || target.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const codeDefaults = target.role === 'admin' ? ADMIN_DEFAULTS : MEMBER_DEFAULTS
  const { data: roleRows } = await admin()
    .from('role_permissions')
    .select('permission, enabled')
    .eq('tenant_id', profile.tenant_id)
    .eq('role', target.role)

  const roleMap: Record<string, boolean> = {}
  for (const row of roleRows ?? []) roleMap[row.permission] = row.enabled

  const userOverrides = flattenJsonbOverrides(target.permissions)

  const permissions: Record<string, { value: boolean; overridden: boolean }> = {}
  for (const perm of ALL_PERMISSIONS) {
    const overridden = perm in userOverrides
    const value = overridden
      ? userOverrides[perm]
      : perm in roleMap
        ? roleMap[perm]
        : codeDefaults[perm as Permission] ?? false
    permissions[perm] = { value, overridden }
  }

  return NextResponse.json({ role: target.role, permissions })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await requireOwner(user.id)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: target } = await admin()
    .from('users')
    .select('role, permissions, tenant_id')
    .eq('id', userId)
    .single()
  if (!target || target.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (target.role === 'account_owner') {
    return NextResponse.json({ error: 'Cannot modify account owner permissions' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { permission, enabled } = body

  if (!(ALL_PERMISSIONS as readonly string[]).includes(permission)) {
    return NextResponse.json({ error: 'Invalid permission' }, { status: 400 })
  }
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be boolean' }, { status: 400 })
  }

  if (enabled === true) {
    const db = admin()
    const { data: pkgRow } = await db
      .from('tenant_packages')
      .select('package:packages(package_role_ceilings(role,permission,enabled))')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle()

    if (pkgRow?.package) {
      const pkg = pkgRow.package as any
      const ceiling = (pkg.package_role_ceilings ?? []).find(
        (c: any) => c.role === target.role && c.permission === permission
      )
      if (ceiling && ceiling.enabled === false) {
        return NextResponse.json(
          { error: `Permission '${permission}' is not available on your current package` },
          { status: 403 }
        )
      }
    }
  }

  const current = flattenJsonbOverrides(target.permissions)
  const updated = { ...current, [permission]: enabled }

  await admin().from('users').update({ permissions: updated }).eq('id', userId)

  return NextResponse.json({ ok: true })
}
