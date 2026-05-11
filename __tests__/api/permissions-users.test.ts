import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockUserFrom = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockUserFrom,
  })),
}))

const mockAdminFrom = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockAdminFrom })),
}))

function ownerProfile() {
  return { tenant_id: 'tenant-abc', role: 'account_owner' }
}
function memberProfile() {
  return {
    role: 'admin',
    permissions: {},
    tenant_id: 'tenant-abc',
  }
}

function setupRequest(method: string, userId: string, body?: object) {
  return new NextRequest(`http://localhost/api/permissions/users/${userId}`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

  mockGetUser.mockResolvedValue({ data: { user: { id: 'owner-uid' } } })

  // user-session client: return owner profile
  const ownerSingle = vi.fn().mockResolvedValue({ data: ownerProfile() })
  const ownerEq = vi.fn(() => ({ single: ownerSingle }))
  mockUserFrom.mockReturnValue({ select: vi.fn(() => ({ eq: ownerEq })) })

  // admin client: returns owner profile on first from('users'), member on second
  let callCount = 0
  mockAdminFrom.mockImplementation((table: string) => {
    if (table === 'users') {
      callCount++
      const data = callCount === 1 ? ownerProfile() : memberProfile()
      const s = vi.fn().mockResolvedValue({ data })
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: s })) })),
        update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
      }
    }
    if (table === 'role_permissions') {
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [] })) })) })),
      }
    }
    return {}
  })
})

describe('GET /api/permissions/users/[userId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    vi.resetModules()
    const { GET } = await import('@/app/api/permissions/users/[userId]/route')
    const res = await GET(setupRequest('GET', 'user-x'), { params: Promise.resolve({ userId: 'user-x' }) })
    expect(res.status).toBe(401)
  })

  it('returns 200 with permissions and overridden flags', async () => {
    vi.resetModules()
    const { GET } = await import('@/app/api/permissions/users/[userId]/route')
    const res = await GET(setupRequest('GET', 'target-id'), { params: Promise.resolve({ userId: 'target-id' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.role).toBe('admin')
    expect(typeof body.permissions['scans.create'].value).toBe('boolean')
    expect(typeof body.permissions['scans.create'].overridden).toBe('boolean')
  })

  it('marks overridden=true when user JSONB has a key set', async () => {
    let callCount = 0
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        callCount++
        const data =
          callCount === 1
            ? ownerProfile()
            : { role: 'admin', permissions: { 'reports.read.board': true }, tenant_id: 'tenant-abc' }
        const s = vi.fn().mockResolvedValue({ data })
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: s })) })),
          update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
        }
      }
      if (table === 'role_permissions') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [] })) })) })) }
      }
      return {}
    })
    vi.resetModules()
    const { GET } = await import('@/app/api/permissions/users/[userId]/route')
    const res = await GET(setupRequest('GET', 'target-id'), { params: Promise.resolve({ userId: 'target-id' }) })
    const body = await res.json()
    expect(body.permissions['reports.read.board'].overridden).toBe(true)
    expect(body.permissions['reports.read.board'].value).toBe(true)
  })
})

describe('PATCH /api/permissions/users/[userId]', () => {
  it('returns 400 for invalid permission key', async () => {
    vi.resetModules()
    const { PATCH } = await import('@/app/api/permissions/users/[userId]/route')
    const res = await PATCH(setupRequest('PATCH', 'target-id', { permission: 'fake.key', enabled: true }), {
      params: Promise.resolve({ userId: 'target-id' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 200 and writes the override to users.permissions', async () => {
    const mockUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) }))
    let callCount = 0
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        callCount++
        const data = callCount === 1 ? ownerProfile() : memberProfile()
        const s = vi.fn().mockResolvedValue({ data })
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: s })) })),
          update: mockUpdate,
        }
      }
      if (table === 'tenant_packages') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) })) })),
        }
      }
      return {}
    })
    vi.resetModules()
    const { PATCH } = await import('@/app/api/permissions/users/[userId]/route')
    const res = await PATCH(
      setupRequest('PATCH', 'target-id', { permission: 'reports.read.board', enabled: true }),
      { params: Promise.resolve({ userId: 'target-id' }) },
    )
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: expect.objectContaining({ 'reports.read.board': true }) }),
    )
  })
})

describe('DELETE /api/permissions/users/[userId]/[permission]', () => {
  it('returns 200 and removes the key from users.permissions', async () => {
    const mockUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) }))
    let callCount = 0
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        callCount++
        if (callCount === 1) {
          const s = vi.fn().mockResolvedValue({ data: ownerProfile() })
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: s })) })), update: mockUpdate }
        }
        const s = vi.fn().mockResolvedValue({
          data: { permissions: { 'reports.read.board': true, 'scans.create': false }, tenant_id: 'tenant-abc' },
        })
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: s })) })), update: mockUpdate }
      }
      return {}
    })
    vi.resetModules()
    const { DELETE } = await import('@/app/api/permissions/users/[userId]/[permission]/route')
    const req = new NextRequest('http://localhost/api/permissions/users/target-id/reports.read.board', {
      method: 'DELETE',
    })
    const res = await DELETE(req, {
      params: Promise.resolve({ userId: 'target-id', permission: 'reports.read.board' }),
    })
    expect(res.status).toBe(200)
    // 'reports.read.board' removed, 'scans.create' kept
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ permissions: { 'scans.create': false } }))
  })

  it('returns 400 for an invalid permission key', async () => {
    let callCount = 0
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        callCount++
        const data = callCount === 1 ? ownerProfile() : memberProfile()
        const s = vi.fn().mockResolvedValue({ data })
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: s })) })) }
      }
      return {}
    })
    vi.resetModules()
    const { DELETE } = await import('@/app/api/permissions/users/[userId]/[permission]/route')
    const req = new NextRequest('http://localhost/api/permissions/users/target-id/not.real', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ userId: 'target-id', permission: 'not.real' }) })
    expect(res.status).toBe(400)
  })
})
