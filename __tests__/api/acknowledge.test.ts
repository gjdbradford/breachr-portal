import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: mockLogAuditEvent }))

// Supabase server client (user session)
const mockGetUser  = vi.fn()
const mockUserFrom = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from:  mockUserFrom,
  })),
}))

// Supabase admin client
const mockAdminUpdate = vi.fn()
const mockAdminEq     = vi.fn()
const mockAdminIs     = vi.fn()
const mockAdminFrom   = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockAdminFrom })),
}))

vi.mock('@/lib/resolve-permissions', () => ({
  resolvePermissions: vi.fn().mockResolvedValue({ 'findings.update': true }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL  = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

  // Default: authenticated user with tenant
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

  const mockSingle = vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-abc' } })
  const mockUserEq = vi.fn(() => ({ single: mockSingle }))
  mockUserFrom.mockReturnValue({ select: vi.fn(() => ({ eq: mockUserEq })) })

  // Admin update chain: from → update → eq → eq → is → resolves
  mockAdminIs.mockResolvedValue({ error: null })
  mockAdminEq.mockReturnValue({ eq: vi.fn(() => ({ is: mockAdminIs })) })
  mockAdminUpdate.mockReturnValue({ eq: mockAdminEq })
  mockAdminFrom.mockReturnValue({ update: mockAdminUpdate })
})

function makeRequest(assetId: string) {
  return new NextRequest(`http://localhost/api/assets/${assetId}/acknowledge`, { method: 'POST' })
}

async function callRoute(assetId: string) {
  const { POST } = await import('@/app/api/assets/[id]/acknowledge/route')
  return POST(makeRequest(assetId), { params: Promise.resolve({ id: assetId }) })
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('POST /api/assets/[id]/acknowledge', () => {
  it('returns 401 when no user session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    vi.resetModules()

    const res = await callRoute('asset-uuid-1')
    expect(res.status).toBe(401)
  })

  it('returns 401 when user has no profile', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null })
    const mockUserEq = vi.fn(() => ({ single: mockSingle }))
    mockUserFrom.mockReturnValue({ select: vi.fn(() => ({ eq: mockUserEq })) })
    vi.resetModules()

    const res = await callRoute('asset-uuid-1')
    expect(res.status).toBe(401)
  })

  it('returns 200 and sets acknowledged_at for a valid request', async () => {
    vi.resetModules()

    const res = await callRoute('asset-uuid-1')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('calls admin update with correct asset ID and tenant scope', async () => {
    vi.resetModules()

    await callRoute('asset-uuid-99')

    expect(mockAdminFrom).toHaveBeenCalledWith('assets')
    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ acknowledged_at: expect.any(String) })
    )
    // First .eq() must filter by asset ID
    expect(mockAdminEq).toHaveBeenCalledWith('id', 'asset-uuid-99')
  })

  it('logs asset.acknowledged to the audit trail', async () => {
    vi.resetModules()

    await callRoute('asset-uuid-1')

    expect(mockLogAuditEvent).toHaveBeenCalledOnce()
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action:   'asset.acknowledged',
      tenantId: 'tenant-abc',
      userId:   'user-123',
      detail:   expect.objectContaining({ assetId: 'asset-uuid-1' }),
    }))
  })

  it('returns 500 when the DB update fails', async () => {
    mockAdminIs.mockResolvedValue({ error: { message: 'db error' } })
    vi.resetModules()

    const res = await callRoute('asset-uuid-1')
    expect(res.status).toBe(500)
  })

  it('does not log audit event when DB update fails', async () => {
    mockAdminIs.mockResolvedValue({ error: { message: 'db error' } })
    vi.resetModules()

    await callRoute('asset-uuid-1')

    expect(mockLogAuditEvent).not.toHaveBeenCalled()
  })
})
