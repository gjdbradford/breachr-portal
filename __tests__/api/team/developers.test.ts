import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAdminFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'suid-1' } } }) },
    from: vi.fn(),
  })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockAdminFrom })),
}))

vi.mock('@/lib/resolve-permissions', () => ({
  resolvePermissions: vi.fn().mockResolvedValue({ 'remediation.batches.create': true }),
}))

import { GET } from '@/app/api/team/developers/route'
import * as resolvePermsModule from '@/lib/resolve-permissions'

describe('GET /api/team/developers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolvePermsModule.resolvePermissions).mockResolvedValue({ 'remediation.batches.create': true } as any)

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockImplementation((cols: string) => {
            // first call: get actor user (tenant_id)
            // second call: get developer list
            if (cols.includes('first_name')) {
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({
                      data: [{ id: 'dev-1', first_name: 'Jane', last_name: 'Dev', email: 'jane@co.com' }],
                      error: null,
                    }),
                  }),
                }),
              }
            }
            return {
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-1' } }),
              }),
            }
          }),
        }
      }
      if (table === 'remediation_tasks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [{ assigned_to: 'dev-1' }], error: null }),
            }),
          }),
        }
      }
      return {}
    })
  })

  it('returns 200 with developer list', async () => {
    const res = await GET(new Request('http://localhost/api/team/developers'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.developers)).toBe(true)
  })

  it('returns 403 without permission', async () => {
    vi.mocked(resolvePermsModule.resolvePermissions).mockResolvedValue({ 'remediation.batches.create': false } as any)
    const res = await GET(new Request('http://localhost/api/team/developers'))
    expect(res.status).toBe(403)
  })
})
