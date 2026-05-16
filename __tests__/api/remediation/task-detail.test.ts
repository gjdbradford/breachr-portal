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

import { GET } from '@/app/api/remediation/tasks/[taskId]/route'

const MOCK_ACTOR   = { id: 'user-1', tenant_id: 'tenant-1', role: 'admin' }
const MOCK_TASK    = {
  id: 'task-1', batch_id: 'b1', tenant_id: 'tenant-1', finding_id: 'f1',
  assigned_to: 'user-2', status: 'in_progress', verification_attempts: 0,
  jira_issue_key: null, jira_issue_url: null, resolved_by: null,
  resolved_at: null, resolution_source: null,
  created_at: '2026-05-16T00:00:00Z', updated_at: '2026-05-16T00:00:00Z',
  finding: { id: 'f1', title: 'SQL Injection', description: 'Repro', severity: 'high', cvss_score: 7.5, owasp_category: 'A03:2021', remediation: 'Use parameterised queries' },
  batch: { id: 'b1', name: 'Sprint 1', priority: 'high', due_date: null, jira_push_enabled: false },
}

function makeRequest(taskId = 'task-1') {
  return new Request(`http://localhost/api/remediation/tasks/${taskId}`)
}

describe('GET /api/remediation/tasks/[taskId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'suid-1' } } })
    vi.mocked(resolvePermissions).mockResolvedValue({ 'remediation.tasks.read': true } as any)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: MOCK_ACTOR }),
            in: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      }
      if (table === 'remediation_tasks') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: MOCK_TASK, error: null }),
            }),
          }),
        }),
      }
      if (table === 'remediation_status_log') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }
      return {}
    })
  })

  it('returns 200 with task and empty status log', async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ taskId: 'task-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.task.id).toBe('task-1')
    expect(Array.isArray(body.statusLog)).toBe(true)
    expect(body.actorRole).toBe('admin')
  })

  it('returns 403 when user lacks remediation.tasks.read', async () => {
    vi.mocked(resolvePermissions).mockResolvedValue({ 'remediation.tasks.read': false } as any)
    const res = await GET(makeRequest(), { params: Promise.resolve({ taskId: 'task-1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 when task belongs to different tenant', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: MOCK_ACTOR }),
          }),
        }),
      }
      if (table === 'remediation_tasks') return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      }
      return {}
    })
    const res = await GET(makeRequest('task-other'), { params: Promise.resolve({ taskId: 'task-other' }) })
    expect(res.status).toBe(404)
  })
})
