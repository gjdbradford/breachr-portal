import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBatchInsert = vi.fn()
const mockTaskInsert  = vi.fn()
const mockAuditInsert = vi.fn().mockResolvedValue({ error: null })
const mockCreatorSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'suid-1' } } }) },
    from: vi.fn(),
  })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'remediation_batches') return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: mockBatchInsert,
          }),
        }),
      }
      if (table === 'remediation_tasks') return { insert: mockTaskInsert }
      if (table === 'audit_logs') return { insert: mockAuditInsert }
      if (table === 'users') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockCreatorSingle }),
        }),
      }
      return {}
    }),
  })),
}))

vi.mock('@/lib/resolve-permissions', () => ({
  resolvePermissions: vi.fn().mockResolvedValue({ 'remediation.batches.create': true }),
}))

import { POST } from '@/app/api/remediation/batches/route'
import * as resolvePermsModule from '@/lib/resolve-permissions'

function makeReq(body: object): Request {
  return new Request('http://localhost/api/remediation/batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = { name: 'Sprint 1', priority: 'high', assigned_to: 'dev-uuid-1', finding_ids: ['f1', 'f2'] }

describe('POST /api/remediation/batches', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(resolvePermsModule.resolvePermissions).mockResolvedValue({ 'remediation.batches.create': true } as any)
    mockCreatorSingle.mockResolvedValue({ data: { id: 'creator-uuid', tenant_id: 'tenant-1' }, error: null })
    mockBatchInsert.mockResolvedValue({ data: { id: 'batch-new', name: 'Sprint 1' }, error: null })
    mockTaskInsert.mockResolvedValue({ error: null })
    mockAuditInsert.mockResolvedValue({ error: null })
  })

  it('returns 201 with the new batch', async () => {
    const res = await POST(makeReq(VALID_BODY))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.batch.id).toBe('batch-new')
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ priority: 'high', assigned_to: 'u1', finding_ids: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when user lacks permission', async () => {
    vi.mocked(resolvePermsModule.resolvePermissions).mockResolvedValue({ 'remediation.batches.create': false } as any)
    const res = await POST(makeReq(VALID_BODY))
    expect(res.status).toBe(403)
  })
})
