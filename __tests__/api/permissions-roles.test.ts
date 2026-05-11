import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockUserFrom = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from:  mockUserFrom,
  })),
}))

const mockAdminFrom = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockAdminFrom })),
}))

function setupOwner(tenantId = 'tenant-abc') {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
  const single = vi.fn().mockResolvedValue({ data: { tenant_id: tenantId, role: 'account_owner' } })
  const eq     = vi.fn(() => ({ single }))
  mockUserFrom.mockReturnValue({ select: vi.fn(() => ({ eq })) })
  const adminSingle = vi.fn().mockResolvedValue({ data: { tenant_id: tenantId, role: 'account_owner' } })
  const adminEq     = vi.fn(() => ({ single: adminSingle }))
  const adminSelect = vi.fn(() => ({ eq: adminEq }))
  mockAdminFrom.mockReturnValue({ select: adminSelect, upsert: vi.fn().mockResolvedValue({}) })
}

function makeRequest(method: string, params: Record<string, string> = {}, body?: object) {
  const url = new URL('http://localhost/api/permissions/roles')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  process.env.NEXT_PUBLIC_SUPABASE_URL  = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
})

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/permissions/roles', () => {
  it('returns 401 when no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    mockUserFrom.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null }) })) })) })
    const { GET } = await import('@/app/api/permissions/roles/route')
    const res = await GET(makeRequest('GET', { role: 'admin' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when caller is not account_owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    const single = vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-abc', role: 'admin' } })
    const eq     = vi.fn(() => ({ single }))
    mockUserFrom.mockReturnValue({ select: vi.fn(() => ({ eq })) })
    const adminSingle = vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-abc', role: 'admin' } })
    mockAdminFrom.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: adminSingle })) })) })
    vi.resetModules()
    const { GET } = await import('@/app/api/permissions/roles/route')
    const res = await GET(makeRequest('GET', { role: 'admin' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when role param is missing or invalid', async () => {
    setupOwner()
    vi.resetModules()
    const { GET } = await import('@/app/api/permissions/roles/route')
    const res = await GET(makeRequest('GET', { role: 'superuser' }))
    expect(res.status).toBe(400)
  })

  it('returns 200 with role and permissions map', async () => {
    setupOwner()
    // Mock role_permissions rows to return empty (will fall back to code defaults)
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        const s = vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-abc', role: 'account_owner' } })
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: s })) })) }
      }
      if (table === 'tenant_packages') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) })) })),
        }
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [] })) })) })),
        upsert: vi.fn().mockResolvedValue({}),
      }
    })
    vi.resetModules()
    const { GET } = await import('@/app/api/permissions/roles/route')
    const res  = await GET(makeRequest('GET', { role: 'admin' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.role).toBe('admin')
    expect(typeof body.permissions['scans.create']).toBe('boolean')
    expect(body.permissions['reports.read.board']).toBe(false)
  })
})

describe('PATCH /api/permissions/roles', () => {
  it('returns 400 for invalid permission key', async () => {
    setupOwner()
    mockAdminFrom.mockImplementation(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-abc', role: 'account_owner' } }) })) })),
      upsert: vi.fn().mockResolvedValue({}),
    }))
    vi.resetModules()
    const { PATCH } = await import('@/app/api/permissions/roles/route')
    const res = await PATCH(makeRequest('PATCH', {}, { role: 'admin', permission: 'made.up', enabled: true }))
    expect(res.status).toBe(400)
  })

  it('returns 200 and upserts the row on valid input', async () => {
    setupOwner()
    const mockUpsert = vi.fn().mockResolvedValue({})
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'tenant_packages') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) })) })),
        }
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-abc', role: 'account_owner' } }) })) })),
        upsert: mockUpsert,
      }
    })
    vi.resetModules()
    const { PATCH } = await import('@/app/api/permissions/roles/route')
    const res = await PATCH(makeRequest('PATCH', {}, { role: 'admin', permission: 'reports.read.board', enabled: true }))
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'reports.read.board', enabled: true, role: 'admin' }),
      expect.anything(),
    )
  })
})
