import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTaskSelect = vi.fn()
const mockUserSelect = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'suid-1' } } }) },
    from: vi.fn(),
  })),
}))

const mockAdminFrom = vi.fn((table: string) => {
  if (table === 'remediation_tasks') return { select: mockTaskSelect }
  if (table === 'users') return { select: mockUserSelect }
  return {}
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockAdminFrom })),
}))

vi.mock('@/lib/resolve-permissions', () => ({
  resolvePermissions: vi.fn().mockResolvedValue({ 'remediation.batches.read': true }),
}))

import { GET } from '@/app/api/remediation/review/route'
import * as resolvePermsModule from '@/lib/resolve-permissions'

describe('GET /api/remediation/review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolvePermsModule.resolvePermissions).mockResolvedValue({ 'remediation.batches.read': true } as any)

    mockUserSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-1', role: 'admin' } }),
      }),
    })

    mockTaskSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{ id: 't1', batch_id: 'b1', updated_at: '2026-05-16T00:00:00Z' }],
            error: null,
          }),
        }),
      }),
    })

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'remediation_tasks') return { select: mockTaskSelect }
      if (table === 'users') return { select: mockUserSelect }
      return {}
    })
  })

  it('returns 200 with review_requested tasks', async () => {
    mockTaskSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{ id: 't1', batch_id: 'b1', updated_at: '2026-05-16T00:00:00Z' }],
            error: null,
          }),
        }),
      }),
    })
    const res = await GET(new Request('http://localhost/api/remediation/review'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.tasks)).toBe(true)
  })

  it('returns 403 when missing permission', async () => {
    vi.mocked(resolvePermsModule.resolvePermissions).mockResolvedValue({ 'remediation.batches.read': false } as any)
    const res = await GET(new Request('http://localhost/api/remediation/review'))
    expect(res.status).toBe(403)
  })
})
