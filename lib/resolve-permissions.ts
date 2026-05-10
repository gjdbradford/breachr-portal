import { createClient } from '@supabase/supabase-js'
import { ALL_PERMISSIONS, ADMIN_DEFAULTS, MEMBER_DEFAULTS, type Permission } from './permissions'

function makeAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function resolvePermissions(supabaseUserId: string): Promise<Record<Permission, boolean>> {
  const admin = makeAdmin()

  const { data: user } = await admin
    .from('users')
    .select('role, permissions, tenant_id')
    .eq('supabase_uid', supabaseUserId)
    .single()

  if (!user) throw new Error('User not found')

  if (user.role === 'account_owner') {
    return Object.fromEntries(
      ALL_PERMISSIONS.map(p => [p, true])
    ) as Record<Permission, boolean>
  }

  const codeDefaults = user.role === 'admin' ? ADMIN_DEFAULTS : MEMBER_DEFAULTS

  const { data: roleRows } = await admin
    .from('role_permissions')
    .select('permission, enabled')
    .eq('tenant_id', user.tenant_id)
    .eq('role', user.role)

  // Lazy seed: write code defaults to DB on first use for this tenant+role
  if (!roleRows || roleRows.length === 0) {
    const seeds = ALL_PERMISSIONS.map(p => ({
      tenant_id: user.tenant_id,
      role:      user.role,
      permission: p,
      enabled:   codeDefaults[p] ?? false,
    }))
    await admin
      .from('role_permissions')
      .upsert(seeds, { onConflict: 'tenant_id,role,permission' })
      .catch(() => {})
  }

  const roleMap: Record<string, boolean> = {}
  for (const row of roleRows ?? []) {
    roleMap[row.permission] = row.enabled
  }

  // Flatten user JSONB overrides — support both flat and legacy nested format
  const userOverrides: Record<string, boolean> = {}
  const raw = user.permissions
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'boolean') {
        userOverrides[k] = v
      } else if (v && typeof v === 'object') {
        for (const [action, val] of Object.entries(v as Record<string, boolean>)) {
          if (typeof val === 'boolean') userOverrides[`${k}.${action}`] = val
        }
      }
    }
  }

  const result: Record<string, boolean> = {}
  for (const perm of ALL_PERMISSIONS) {
    if (perm in userOverrides) {
      result[perm] = userOverrides[perm]
    } else if (perm in roleMap) {
      result[perm] = roleMap[perm]
    } else {
      result[perm] = codeDefaults[perm] ?? false
    }
  }

  return result as Record<Permission, boolean>
}
