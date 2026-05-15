export const ALL_PERMISSIONS = [
  'scans.create',
  'scans.read',
  'scans.update',
  'scans.archive',
  'findings.read',
  'findings.update',
  'findings.archive',
  'assets.create',
  'assets.read',
  'assets.update',
  'assets.archive',
  'reports.read.scan',
  'reports.read.organizational',
  'reports.read.executive',
  'reports.read.board',
  'reports.generate',
  'reports.export',
  'exports.create',
  'exports.read',
  'remediation.read',
  'remediation.update',
  'audit.read',
  'team.read',
  'team.invite',
] as const

export type Permission = typeof ALL_PERMISSIONS[number]

export const ADMIN_DEFAULTS: Record<Permission, boolean> = {
  'scans.create':               true,
  'scans.read':                 true,
  'scans.update':               true,
  'scans.archive':              true,
  'findings.read':              true,
  'findings.update':            true,
  'findings.archive':           true,
  'assets.create':              true,
  'assets.read':                true,
  'assets.update':              true,
  'assets.archive':             true,
  'reports.read.scan':          true,
  'reports.read.organizational': true,
  'reports.read.executive':     false,
  'reports.read.board':         false,
  'reports.generate':           true,
  'reports.export':             true,
  'exports.create':             true,
  'exports.read':               true,
  'remediation.read':           true,
  'remediation.update':         true,
  'audit.read':                 true,
  'team.read':                  true,
  'team.invite':                false,
}

export const MEMBER_DEFAULTS: Record<Permission, boolean> = {
  'scans.create':               false,
  'scans.read':                 false,
  'scans.update':               false,
  'scans.archive':              false,
  'findings.read':              false,
  'findings.update':            false,
  'findings.archive':           false,
  'assets.create':              false,
  'assets.read':                false,
  'assets.update':              false,
  'assets.archive':             false,
  'reports.read.scan':          false,
  'reports.read.organizational': false,
  'reports.read.executive':     false,
  'reports.read.board':         false,
  'reports.generate':           false,
  'reports.export':             false,
  'exports.create':             false,
  'exports.read':               false,
  'remediation.read':           false,
  'remediation.update':         false,
  'audit.read':                 false,
  'team.read':                  false,
  'team.invite':                false,
}

export const VIEWER_DEFAULTS: Record<Permission, boolean> = {
  'scans.create':                false,
  'scans.read':                  false,
  'scans.update':                false,
  'scans.archive':               false,
  'findings.read':               true,
  'findings.update':             false,
  'findings.archive':            false,
  'assets.create':               false,
  'assets.read':                 true,
  'assets.update':               false,
  'assets.archive':              false,
  'reports.read.scan':           true,
  'reports.read.organizational': true,
  'reports.read.executive':      false,
  'reports.read.board':          false,
  'reports.generate':            false,
  'reports.export':              false,
  'exports.create':              false,
  'exports.read':                true,
  'remediation.read':            true,
  'remediation.update':          false,
  'audit.read':                  false,
  'team.read':                   false,
  'team.invite':                 false,
}

export const DEVELOPER_DEFAULTS: Record<Permission, boolean> = {
  'scans.create':                false,
  'scans.read':                  true,
  'scans.update':                false,
  'scans.archive':               false,
  'findings.read':               true,
  'findings.update':             false,
  'findings.archive':            false,
  'assets.create':               false,
  'assets.read':                 true,
  'assets.update':               false,
  'assets.archive':              false,
  'reports.read.scan':           true,
  'reports.read.organizational': false,
  'reports.read.executive':      false,
  'reports.read.board':          false,
  'reports.generate':            false,
  'reports.export':              false,
  'exports.create':              false,
  'exports.read':                true,
  'remediation.read':            true,
  'remediation.update':          false,
  'audit.read':                  true,
  'team.read':                   false,
  'team.invite':                 false,
}

export const PERMISSION_GROUPS: Array<{
  label: string
  permissions: Array<{ key: Permission; label: string }>
}> = [
  {
    label: 'Scans',
    permissions: [
      { key: 'scans.create',  label: 'Create new scans' },
      { key: 'scans.read',    label: 'View scans' },
      { key: 'scans.update',  label: 'Update scan settings' },
      { key: 'scans.archive', label: 'Archive scans' },
    ],
  },
  {
    label: 'Findings',
    permissions: [
      { key: 'findings.read',    label: 'View findings' },
      { key: 'findings.update',  label: 'Update finding status' },
      { key: 'findings.archive', label: 'Archive findings' },
    ],
  },
  {
    label: 'Assets / Inventory',
    permissions: [
      { key: 'assets.create',  label: 'Add new assets' },
      { key: 'assets.read',    label: 'View assets' },
      { key: 'assets.update',  label: 'Update assets' },
      { key: 'assets.archive', label: 'Archive assets' },
    ],
  },
  {
    label: 'Reports',
    permissions: [
      { key: 'reports.read.scan',           label: 'View scan reports' },
      { key: 'reports.read.organizational', label: 'View organisational reports' },
      { key: 'reports.read.executive',      label: 'View executive reports' },
      { key: 'reports.read.board',          label: 'View board reports' },
      { key: 'reports.generate',            label: 'Generate reports' },
      { key: 'reports.export',              label: 'Export reports as PDF' },
    ],
  },
  {
    label: 'Exports',
    permissions: [
      { key: 'exports.create', label: 'Request data exports' },
      { key: 'exports.read',   label: 'View exports' },
    ],
  },
  {
    label: 'Remediation',
    permissions: [
      { key: 'remediation.read',   label: 'View remediation plans' },
      { key: 'remediation.update', label: 'Update remediation status' },
    ],
  },
  {
    label: 'Audit Log',
    permissions: [
      { key: 'audit.read', label: 'View audit log' },
    ],
  },
  {
    label: 'Team',
    permissions: [
      { key: 'team.read',   label: 'View team members' },
      { key: 'team.invite', label: 'Invite new members' },
    ],
  },
]

// Accepts a pre-resolved flat permissions record (from resolvePermissions).
// account_owner callers pass a record of all-true; others pass the output of resolvePermissions().
export function can(
  resolved: Record<Permission, boolean>,
  action: Permission,
): boolean {
  return resolved[action] ?? false
}

export function defaultPermissionsForRole(role: string): Record<Permission, boolean> {
  if (role === 'admin')     return { ...ADMIN_DEFAULTS }
  if (role === 'viewer')    return { ...VIEWER_DEFAULTS }
  if (role === 'developer') return { ...DEVELOPER_DEFAULTS }
  return { ...MEMBER_DEFAULTS }
}
