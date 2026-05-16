import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolvePermissions } from '@/lib/resolve-permissions'

const mockGetUser = vi.fn()
const mockFrom    = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('@/lib/resolve-permissions', () => ({
  resolvePermissions: vi.fn(),
}))

import { GET } from '@/app/api/team/workload/route'

describe('GET /api/team/workload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'suid-1' } } })
    vi.mocked(resolvePermissions).mockResolvedValue({ 'team.read': true } as any)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') return {
        select: vi.fn().mockImplementation((cols: string) => {
          if (cols === 'id, tenant_id') {
            // actor lookup: .select('id, tenant_id').eq('supabase_uid').single()
            return {
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'user-1', tenant_id: 'tenant-1' } }),
              }),
            }
          }
          // developer list: .select('id').eq('tenant_id').eq('role').order()
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ id: 'dev-1' }, { id: 'dev-2' }],
                  error: null,
                }),
              }),
            }),
          }
        }),
      }
      if (table === 'remediation_batches') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              neq: vi.fn().mockResolvedValue({ data: [{ assigned_to: 'dev-1' }, { assigned_to: 'dev-1' }], error: null }),
            }),
          }),
        }),
      }
      if (table === 'remediation_tasks') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [
                { assigned_to: 'dev-1', status: 'open' },
                { assigned_to: 'dev-1', status: 'in_progress' },
                { assigned_to: 'dev-2', status: 'review_requested' },
              ], error: null }),
            }),
          }),
        }),
      }
      if (table === 'remediation_ai_sessions') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }
      return {}
    })
  })

  it('returns 200 with workload per developer', async () => {
    const req = new Request('http://localhost/api/team/workload')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.workload)).toBe(true)
  })

  it('returns 403 when user lacks team.read', async () => {
    vi.mocked(resolvePermissions).mockResolvedValue({ 'team.read': false } as any)
    const req = new Request('http://localhost/api/team/workload')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})
