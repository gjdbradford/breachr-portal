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

const mockAdminFrom = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockAdminFrom })),
}))

vi.mock('@/lib/audit', () => ({
  sha256Hex: vi.fn(async (s: string) => 'sha256:' + s),
  GENESIS_HASH: '0'.repeat(64),
}))

vi.mock('@/lib/audit-hmac', () => ({
  hmacSha256Hex: vi.fn(() => 'valid-sig'),
  safeEqual: vi.fn((a: string, b: string) => a === b),
}))

function makeRequest(id: string, body: object) {
  return new NextRequest(`http://localhost/api/audit/${id}/annotate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setupAdmin() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1' } } })
  mockUserFrom.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-uuid-1', tenant_id: 'tenant-1', role: 'admin' },
        }),
      })),
    })),
  })
}

function setupEntry(overrides: Record<string, unknown> = {}) {
  const baseEntry = {
    id: '95',
    action: 'export.completed',
    detail: '{"exportId":"abc","_ts":"2026-05-10T12:15:26Z"}',
    tenant_id: 'tenant-1',
    prev_hash: 'wrong-prev-hash',
    signature: 'valid-sig',
    created_at: '2026-05-10T12:15:26.995Z',
    chain_annotation: null,
    chain_annotation_at: null,
    ...overrides,
  }
  const prevEntry = { signature: 'prev-sig' }

  // The terminal node returned by the final .eq() in the entry fetch chain.
  // maybeSingle() returns the entry; prev-entry path goes through .lt().order().limit().maybeSingle().
  function makeTerminal(): Record<string, unknown> {
    const terminal: Record<string, unknown> = {
      maybeSingle: vi.fn().mockResolvedValue({ data: baseEntry }),
      lt: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: prevEntry }),
          })),
        })),
      })),
    }
    // Allow additional .eq() chaining (for the two .eq() calls on the entry fetch)
    terminal.eq = vi.fn(() => makeTerminal())
    return terminal
  }

  mockAdminFrom.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() => makeTerminal()),
    })),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  process.env.NEXT_PUBLIC_SUPABASE_URL  = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  process.env.AUDIT_SIGNING_KEY         = 'deadbeef'
})

// ─── Tests ────────────────────────────────────────────────────────────────

describe('PATCH /api/audit/[id]/annotate', () => {
  async function callPatch(id: string, body: object) {
    const { PATCH } = await import('@/app/api/audit/[id]/annotate/route')
    const params = Promise.resolve({ id })
    return PATCH(makeRequest(id, body), { params })
  }

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await callPatch('95', { explanation: 'test' })
    expect(res.status).toBe(401)
  })

  it('returns 403 when role is member', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1' } } })
    mockUserFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-uuid-1', tenant_id: 'tenant-1', role: 'member' },
          }),
        })),
      })),
    })
    const res = await callPatch('95', { explanation: 'test' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when explanation is empty', async () => {
    setupAdmin()
    const res = await callPatch('95', { explanation: '   ' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/required/)
  })

  it('returns 400 when explanation exceeds 1000 chars', async () => {
    setupAdmin()
    const res = await callPatch('95', { explanation: 'x'.repeat(1001) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/too long/)
  })

  it('returns 404 when entry not found for tenant', async () => {
    setupAdmin()
    const nullTerminal = () => ({
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      eq: vi.fn(() => nullTerminal()),
    })
    mockAdminFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => nullTerminal()),
      })),
    })
    const res = await callPatch('95', { explanation: 'test' })
    expect(res.status).toBe(404)
  })

  it('returns 409 when annotation is locked (beyond 24h)', async () => {
    setupAdmin()
    const lockedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    setupEntry({ chain_annotation: 'old note', chain_annotation_at: lockedAt })
    const res = await callPatch('95', { explanation: 'new note' })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/locked/)
  })

  it('returns 200 and saves annotation for a genuine chain break', async () => {
    setupAdmin()
    setupEntry()
    // safeEqual returns false for 'wrong-prev-hash' vs 'sha256:prev-sig'
    const { safeEqual } = await import('@/lib/audit-hmac')
    vi.mocked(safeEqual).mockReturnValue(false)
    const res = await callPatch('95', { explanation: 'Race condition in export cron' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 400 when entry chain is actually valid', async () => {
    setupAdmin()
    setupEntry({ prev_hash: 'sha256:prev-sig' })
    const { safeEqual } = await import('@/lib/audit-hmac')
    vi.mocked(safeEqual).mockReturnValue(true)
    const res = await callPatch('95', { explanation: 'test' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/passed verification/)
  })
})
