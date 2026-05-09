/**
 * Permission system for Breachr portal.
 *
 * account_owner: full access to everything, always.
 * admin: full access by default; account_owner can restrict specific capabilities.
 * member: read-only by default (future role).
 *
 * No user can delete data — audit log integrity is preserved.
 * Restrictions are stored as { feature: { action: false } } in users.permissions.
 * Absence of a key means the default applies (true for admin, false for member).
 */

export type Permission =
  | 'scans.create'
  | 'scans.run'
  | 'findings.update_status'
  | 'assets.create'
  | 'assets.update'
  | 'reports.generate'
  | 'reports.export'
  | 'remediation.update'
  | 'exports.request'

const ADMIN_DEFAULTS: Record<Permission, boolean> = {
  'scans.create':          true,
  'scans.run':             true,
  'findings.update_status': true,
  'assets.create':         true,
  'assets.update':         true,
  'reports.generate':      true,
  'reports.export':        true,
  'remediation.update':    true,
  'exports.request':       true,
}

const MEMBER_DEFAULTS: Record<Permission, boolean> = {
  'scans.create':          false,
  'scans.run':             false,
  'findings.update_status': false,
  'assets.create':         false,
  'assets.update':         false,
  'reports.generate':      false,
  'reports.export':        false,
  'remediation.update':    false,
  'exports.request':       false,
}

export function can(
  role: string,
  permissions: Record<string, boolean> | null | undefined,
  action: Permission,
): boolean {
  if (role === 'account_owner') return true

  const defaults = role === 'admin' ? ADMIN_DEFAULTS : MEMBER_DEFAULTS
  const base = defaults[action] ?? false

  if (!permissions || typeof permissions !== 'object') return base

  // Flatten nested { feature: { action: bool } } to 'feature.action'
  const flat: Record<string, boolean> = {}
  for (const [feature, actions] of Object.entries(permissions)) {
    if (actions && typeof actions === 'object') {
      for (const [act, val] of Object.entries(actions as Record<string, boolean>)) {
        flat[`${feature}.${act}`] = val
      }
    } else if (typeof actions === 'boolean') {
      flat[feature] = actions
    }
  }

  return action in flat ? flat[action] : base
}

export function defaultPermissionsForRole(role: string): Record<string, Record<string, boolean>> {
  const src = role === 'admin' ? ADMIN_DEFAULTS : MEMBER_DEFAULTS
  const out: Record<string, Record<string, boolean>> = {}
  for (const [key, val] of Object.entries(src)) {
    const [feature, action] = key.split('.')
    if (!out[feature]) out[feature] = {}
    out[feature][action] = val
  }
  return out
}
