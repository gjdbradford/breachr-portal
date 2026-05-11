import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

let mockUserRow: Record<string, unknown> | null = {
  role: 'admin',
  permissions: {},
  tenant_id: 'tenant-abc',
}
let mockRoleRows: Array<{ permission: string; enabled: boolean }> = []
let mockTenantPackage: any = null
let mockTenantTrials: Array<{ module_slug: string; expires_at: string }> = []
const mockUpsert = vi.fn().mockResolvedValue({})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: mockUserRow }) }),
          }),
        }
      }
      if (table === 'role_permissions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: mockRoleRows }),
            }),
          }),
          upsert: mockUpsert,
        }
      }
      if (table === 'tenant_packages') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: mockTenantPackage }),
            }),
          }),
        }
      }
      if (table === 'tenant_module_trials') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockTenantTrials }),
          }),
        }
      }
      return {}
    },
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockUserRow = { role: 'admin', permissions: {}, tenant_id: 'tenant-abc' }
  mockRoleRows = []
  mockTenantPackage = null
  mockTenantTrials = []
  process.env.NEXT_PUBLIC_SUPABASE_URL  = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('resolvePermissions()', () => {
  it('returns all-true for account_owner without DB lookup', async () => {
    mockUserRow = { role: 'account_owner', permissions: {}, tenant_id: 'tenant-abc' }
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['scans.create']).toBe(true)
    expect(result['reports.read.board']).toBe(true)
    expect(result['team.invite']).toBe(true)
  })

  it('falls back to code defaults when no role_permissions rows exist', async () => {
    mockRoleRows = []
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    // Admin defaults: scans.create = true, reports.read.board = false
    expect(result['scans.create']).toBe(true)
    expect(result['reports.read.board']).toBe(false)
  })

  it('seeds role_permissions table when no rows exist', async () => {
    mockRoleRows = []
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    await resolvePermissions('user-123')
    expect(mockUpsert).toHaveBeenCalledOnce()
    const [seeds] = mockUpsert.mock.calls[0]
    expect(Array.isArray(seeds)).toBe(true)
    expect(seeds[0]).toMatchObject({ tenant_id: 'tenant-abc', role: 'admin' })
  })

  it('uses role_permissions DB value when row exists', async () => {
    mockRoleRows = [{ permission: 'reports.read.board', enabled: true }]
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['reports.read.board']).toBe(true)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('user JSONB override wins over role_permissions DB row', async () => {
    mockRoleRows = [{ permission: 'scans.create', enabled: true }]
    mockUserRow = { role: 'admin', permissions: { 'scans.create': false }, tenant_id: 'tenant-abc' }
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['scans.create']).toBe(false)
  })

  it('reads legacy nested JSONB format for backwards compat', async () => {
    mockUserRow = {
      role: 'admin',
      permissions: { scans: { create: false } },
      tenant_id: 'tenant-abc',
    }
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['scans.create']).toBe(false)
  })

  it('throws when user is not found', async () => {
    mockUserRow = null
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    await expect(resolvePermissions('ghost')).rejects.toThrow('User not found')
  })

  it('account_owner with no package returns all-true (no regression)', async () => {
    mockUserRow = { role: 'account_owner', permissions: {}, tenant_id: 'tenant-abc' }
    mockTenantPackage = null
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['scans.create']).toBe(true)
    expect(result['exports.create']).toBe(true)
    expect(result['team.invite']).toBe(true)
  })
})

describe('resolvePermissions() — account_owner with package', () => {
  beforeEach(() => {
    mockUserRow = { role: 'account_owner', permissions: {}, tenant_id: 'tenant-abc' }
  })

  it('account_owner with off module: all permissions for that module are false', async () => {
    mockTenantPackage = {
      package: {
        package_modules: [{ module_slug: 'exports', access_mode: 'off', trial_days: null }],
        package_role_ceilings: [],
      },
    }
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['exports.create']).toBe(false)
    expect(result['exports.read']).toBe(false)
    // Other modules without a config default to full
    expect(result['scans.create']).toBe(true)
  })

  it('account_owner with paywalled module: all permissions false', async () => {
    mockTenantPackage = {
      package: {
        package_modules: [{ module_slug: 'reports', access_mode: 'paywalled', trial_days: null }],
        package_role_ceilings: [],
      },
    }
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['reports.read.scan']).toBe(false)
    expect(result['reports.generate']).toBe(false)
  })

  it('account_owner with trial module not started: permissions true', async () => {
    mockTenantPackage = {
      package: {
        package_modules: [{ module_slug: 'remediation', access_mode: 'trial', trial_days: 14 }],
        package_role_ceilings: [],
      },
    }
    mockTenantTrials = []  // trial not started
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['remediation.read']).toBe(true)
    expect(result['remediation.update']).toBe(true)
  })

  it('account_owner with trial module expired: permissions false', async () => {
    mockTenantPackage = {
      package: {
        package_modules: [{ module_slug: 'remediation', access_mode: 'trial', trial_days: 14 }],
        package_role_ceilings: [],
      },
    }
    mockTenantTrials = [{
      module_slug: 'remediation',
      expires_at: new Date(Date.now() - 1000).toISOString(),  // 1 second ago
    }]
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['remediation.read']).toBe(false)
    expect(result['remediation.update']).toBe(false)
  })

  it('account_owner with active trial: permissions true', async () => {
    mockTenantPackage = {
      package: {
        package_modules: [{ module_slug: 'remediation', access_mode: 'trial', trial_days: 14 }],
        package_role_ceilings: [],
      },
    }
    mockTenantTrials = [{
      module_slug: 'remediation',
      expires_at: new Date(Date.now() + 86400000).toISOString(),  // tomorrow
    }]
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['remediation.read']).toBe(true)
  })
})

describe('resolvePermissions() — admin with package gates and ceilings', () => {
  beforeEach(() => {
    mockUserRow = { role: 'admin', permissions: {}, tenant_id: 'tenant-abc' }
    mockRoleRows = [{ permission: 'exports.create', enabled: true }]
  })

  it('admin with off module: forces false regardless of role_permissions', async () => {
    mockTenantPackage = {
      package: {
        package_modules: [{ module_slug: 'exports', access_mode: 'off', trial_days: null }],
        package_role_ceilings: [],
      },
    }
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['exports.create']).toBe(false)  // role_permissions says true, module gate wins
  })

  it('admin with ceiling=false: forces false even if role_permissions is true', async () => {
    mockTenantPackage = {
      package: {
        package_modules: [],
        package_role_ceilings: [
          { role: 'admin', permission: 'exports.create', enabled: false },
        ],
      },
    }
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['exports.create']).toBe(false)  // ceiling clamps
  })

  it('admin with no package: falls back to existing behaviour', async () => {
    mockTenantPackage = null
    mockRoleRows = [{ permission: 'scans.create', enabled: true }]
    const { resolvePermissions } = await import('@/lib/resolve-permissions')
    const result = await resolvePermissions('user-123')
    expect(result['scans.create']).toBe(true)  // no package = no gates
  })
})
