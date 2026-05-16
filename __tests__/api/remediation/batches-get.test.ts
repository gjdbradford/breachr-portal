import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBatchSelect = vi.fn()
const mockUserSingle  = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === 'remediation_batches') return { select: mockBatchSelect }
  if (table === 'users') return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ single: mockUserSingle }),
    }),
  }
  return {}
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'suid-1' } } }) },
    from: mockFrom,
  })),
}))

vi.mock('@/lib/resolve-permissions', () => ({
  resolvePermissions: vi.fn().mockResolvedValue({ 'remediation.tasks.read': true }),
}))

import { GET } from '@/app/api/remediation/batches/route'
import * as resolvePermsModule from '@/lib/resolve-permissions'

describe('GET /api/remediation/batches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolvePermsModule.resolvePermissions).mockResolvedValue({ 'remediation.tasks.read': true } as any)

    mockBatchSelect.mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'batch-1', name: 'Sprint 1', description: null,
            priority: 'high', status: 'active', due_date: null,
            jira_push_enabled: false, assigned_to: 'u1', created_by: 'a1',
            created_at: '2026-05-16T00:00:00Z', updated_at: '2026-05-16T00:00:00Z',
            tasks: [{ id: 't1', status: 'open' }, { id: 't2', status: 'verified_fixed' }],
          },
        ],
        error: null,
      }),
    })
  })

  it('returns 200 with task-count-enriched batches', async () => {
    const res = await GET(new Request('http://localhost/api/remediation/batches'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.batches[0].total_tasks).toBe(2)
    expect(body.batches[0].completed_tasks).toBe(1)
  })

  it('does not expose raw tasks array', async () => {
    const res = await GET(new Request('http://localhost/api/remediation/batches'))
    const body = await res.json()
    expect(body.batches[0].tasks).toBeUndefined()
  })

  it('returns 403 when permission denied', async () => {
    vi.mocked(resolvePermsModule.resolvePermissions).mockResolvedValue({ 'remediation.tasks.read': false } as any)
    const res = await GET(new Request('http://localhost/api/remediation/batches'))
    expect(res.status).toBe(403)
  })
})
