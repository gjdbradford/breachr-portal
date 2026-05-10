import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

let mockUserRow: Record<string, unknown> | null = {
  role: 'admin',
  permissions: {},
  tenant_id: 'tenant-abc',
}
let mockRoleRows: Array<{ permission: string; enabled: boolean }> = []
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
      return {}
    },
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockUserRow = { role: 'admin', permissions: {}, tenant_id: 'tenant-abc' }
  mockRoleRows = []
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
})
