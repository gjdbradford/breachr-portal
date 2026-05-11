import { createClient } from '@supabase/supabase-js'
import { ALL_PERMISSIONS, ADMIN_DEFAULTS, MEMBER_DEFAULTS, type Permission } from './permissions'

type ModuleConfig = { access_mode: string; trial_days: number | null }
type TrialState = { expires_at: string }
type TenantPackageData = {
  moduleMap: Record<string, ModuleConfig>
  ceilingMap: Record<string, boolean>    // key: `${role}:${permission}`
  trialMap: Record<string, TrialState>   // key: module_slug
}

async function fetchTenantPackageData(
  tenantId: string,
  admin: ReturnType<typeof createClient>
): Promise<TenantPackageData | null> {
  const { data: pkgRow } = await admin
    .from('tenant_packages')
    .select('package:packages(package_modules(module_slug,access_mode,trial_days),package_role_ceilings(role,permission,enabled))')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!pkgRow?.package) return null

  const pkg = pkgRow.package as any

  const moduleMap: Record<string, ModuleConfig> = {}
  for (const m of pkg.package_modules ?? []) {
    moduleMap[m.module_slug] = { access_mode: m.access_mode, trial_days: m.trial_days }
  }

  const ceilingMap: Record<string, boolean> = {}
  for (const c of pkg.package_role_ceilings ?? []) {
    ceilingMap[`${c.role}:${c.permission}`] = c.enabled
  }

  const trialMap: Record<string, TrialState> = {}
  const hasTrialModules = Object.values(moduleMap).some(m => m.access_mode === 'trial')
  if (hasTrialModules) {
    const { data: trials } = await admin
      .from('tenant_module_trials')
      .select('module_slug,expires_at')
      .eq('tenant_id', tenantId)
    for (const t of trials ?? []) {
      trialMap[t.module_slug] = { expires_at: t.expires_at }
    }
  }

  return { moduleMap, ceilingMap, trialMap }
}

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
    const pkgData = await fetchTenantPackageData(user.tenant_id, admin)
    if (!pkgData) {
      return Object.fromEntries(ALL_PERMISSIONS.map(p => [p, true])) as Record<Permission, boolean>
    }
    const result: Record<string, boolean> = {}
    for (const perm of ALL_PERMISSIONS) {
      const moduleSlug = perm.split('.')[0]
      const mod = pkgData.moduleMap[moduleSlug]
      if (!mod || mod.access_mode === 'full') {
        result[perm] = true
      } else if (mod.access_mode === 'off' || mod.access_mode === 'paywalled') {
        result[perm] = false
      } else if (mod.access_mode === 'trial') {
        const trial = pkgData.trialMap[moduleSlug]
        result[perm] = !trial || new Date(trial.expires_at) > new Date()
      } else {
        result[perm] = true
      }
    }
    return result as Record<Permission, boolean>
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
    try {
      await admin
        .from('role_permissions')
        .upsert(seeds, { onConflict: 'tenant_id,role,permission' })
    } catch { /* seeding failure is non-fatal */ }
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

  const pkgData = await fetchTenantPackageData(user.tenant_id, admin)
  if (pkgData) {
    for (const perm of ALL_PERMISSIONS) {
      const moduleSlug = perm.split('.')[0]
      const mod = pkgData.moduleMap[moduleSlug]
      if (mod) {
        if (mod.access_mode === 'off' || mod.access_mode === 'paywalled') {
          result[perm] = false
          continue
        }
        if (mod.access_mode === 'trial') {
          const trial = pkgData.trialMap[moduleSlug]
          if (trial && new Date(trial.expires_at) <= new Date()) {
            result[perm] = false
            continue
          }
        }
      }
      const ceiling = pkgData.ceilingMap[`${user.role}:${perm}`]
      if (ceiling === false) result[perm] = false
    }
  }

  return result as Record<Permission, boolean>
}
