import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockUserFrom = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockUserFrom,
  })),
}))

const mockAdminInsert = vi.fn()
const mockAdminSelect = vi.fn()
const mockAdminFrom   = vi.fn()
const mockStorageFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockAdminFrom,
    storage: { from: mockStorageFrom },
  })),
}))

function setupAuthenticatedUser(role = 'admin') {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
  const mockSingle = vi.fn().mockResolvedValue({
    data: { tenant_id: 'tenant-abc', role },
  })
  mockUserFrom.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) })) })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL  = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
})

// ─── POST tests ────────────────────────────────────────────────────────────

describe('POST /api/exports', () => {
  async function callPost(body: object) {
    vi.resetModules()
    const { POST } = await import('@/app/api/exports/route')
    return POST(new NextRequest('http://localhost/api/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))
  }

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await callPost({ data_type: 'findings', format: 'csv', filters: {} })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin/owner role', async () => {
    setupAuthenticatedUser('member')
    const res = await callPost({ data_type: 'findings', format: 'csv', filters: {} })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid data_type', async () => {
    setupAuthenticatedUser('admin')
    const mockInsertChain = { select: vi.fn(() => ({ single: vi.fn() })) }
    mockAdminInsert.mockReturnValue(mockInsertChain)
    mockAdminFrom.mockReturnValue({ insert: mockAdminInsert })
    const res = await callPost({ data_type: 'bad_type', format: 'csv', filters: {} })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid format', async () => {
    setupAuthenticatedUser('admin')
    const res = await callPost({ data_type: 'findings', format: 'pdf', filters: {} })
    expect(res.status).toBe(400)
  })

  it('inserts pending job and returns id for admin', async () => {
    setupAuthenticatedUser('admin')
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'export-uuid-1' }, error: null })
    const mockSelect = vi.fn(() => ({ single: mockSingle }))
    mockAdminInsert.mockReturnValue({ select: mockSelect })
    mockAdminFrom.mockReturnValue({ insert: mockAdminInsert })

    const res = await callPost({ data_type: 'findings', format: 'csv', filters: { sev: 'critical' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('export-uuid-1')
  })

  it('inserts pending job and returns id for account_owner', async () => {
    setupAuthenticatedUser('account_owner')
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'export-uuid-2' }, error: null })
    mockAdminInsert.mockReturnValue({ select: vi.fn(() => ({ single: mockSingle })) })
    mockAdminFrom.mockReturnValue({ insert: mockAdminInsert })

    const res = await callPost({ data_type: 'audit_trail', format: 'xlsx', filters: {} })
    expect(res.status).toBe(200)
  })

  it('inserts row with correct tenant_id and requested_by', async () => {
    setupAuthenticatedUser('admin')
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'export-uuid-3' }, error: null })
    mockAdminInsert.mockReturnValue({ select: vi.fn(() => ({ single: mockSingle })) })
    mockAdminFrom.mockReturnValue({ insert: mockAdminInsert })

    await callPost({ data_type: 'inventory', format: 'csv', filters: {} })

    expect(mockAdminInsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id:    'tenant-abc',
      requested_by: 'user-123',
      data_type:    'inventory',
      format:       'csv',
    }))
  })
})

// ─── GET tests ────────────────────────────────────────────────────────────

describe('GET /api/exports', () => {
  async function callGet() {
    vi.resetModules()
    const { GET } = await import('@/app/api/exports/route')
    return GET(new NextRequest('http://localhost/api/exports', { method: 'GET' }))
  }

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await callGet()
    expect(res.status).toBe(401)
  })

  it('returns export rows for the tenant', async () => {
    setupAuthenticatedUser('admin')
    const fakeExports = [
      { id: 'e1', status: 'ready', file_path: 'tenant-abc/e1.csv', data_type: 'findings', format: 'csv', filters: {}, created_at: '2026-05-08T00:00:00Z' },
      { id: 'e2', status: 'pending', file_path: null, data_type: 'inventory', format: 'xlsx', filters: {}, created_at: '2026-05-07T00:00:00Z' },
    ]
    const mockOrder = vi.fn().mockResolvedValue({ data: fakeExports, error: null })
    const mockEq    = vi.fn(() => ({ order: mockOrder }))
    const mockSelect = vi.fn(() => ({ eq: mockEq }))
    mockAdminFrom.mockReturnValue({ select: mockSelect })

    const mockSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed-url' } })
    mockStorageFrom.mockReturnValue({ createSignedUrl: mockSignedUrl })

    const res = await callGet()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].signed_url).toBe('https://signed-url')
    expect(body[1].signed_url).toBeNull()
  })
})
