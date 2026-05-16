import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Supabase admin client ──────────────────────────────────────────────
const mockLogInsert = vi.fn().mockResolvedValue({ error: null })
const mockLogMaybeSingle = vi.fn().mockResolvedValue({ data: null })
const mockLogLimit = vi.fn(() => ({ maybeSingle: mockLogMaybeSingle }))
const mockLogOrder = vi.fn(() => ({ limit: mockLogLimit }))
const mockLogEq2 = vi.fn(() => ({ order: mockLogOrder }))
const mockLogEq1 = vi.fn(() => ({ eq: mockLogEq2 }))
const mockLogSelect = vi.fn(() => ({ eq: mockLogEq1 }))

const mockAuditInsert = vi.fn().mockResolvedValue({ error: null })

const mockFrom = vi.fn((table: string) => {
  if (table === 'remediation_status_log') {
    return { select: mockLogSelect, insert: mockLogInsert }
  }
  if (table === 'audit_logs') {
    return { insert: mockAuditInsert }
  }
  return {}
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  vi.resetAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL  = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  process.env.AUDIT_SIGNING_KEY         = 'a'.repeat(64)

  mockLogMaybeSingle.mockResolvedValue({ data: null })
  mockLogLimit.mockReturnValue({ maybeSingle: mockLogMaybeSingle })
  mockLogOrder.mockReturnValue({ limit: mockLogLimit })
  mockLogEq2.mockReturnValue({ order: mockLogOrder })
  mockLogEq1.mockReturnValue({ eq: mockLogEq2 })
  mockLogSelect.mockReturnValue({ eq: mockLogEq1 })
  mockFrom.mockImplementation((table: string) => {
    if (table === 'remediation_status_log') {
      return { select: mockLogSelect, insert: mockLogInsert }
    }
    if (table === 'audit_logs') {
      return { insert: mockAuditInsert }
    }
    return {}
  })
  mockLogInsert.mockResolvedValue({ error: null })
  mockAuditInsert.mockResolvedValue({ error: null })
})

import { logRemediationStatusChange } from '@/lib/remediation-audit'

const BASE = {
  taskId:     'task-uuid-1',
  tenantId:   'tenant-uuid-1',
  fromStatus: 'open',
  toStatus:   'in_progress',
  changedBy:  'user-uuid-1',
  source:     'developer' as const,
}

describe('logRemediationStatusChange', () => {
  it('inserts a status log row with correct fields', async () => {
    await logRemediationStatusChange(BASE)

    expect(mockLogInsert).toHaveBeenCalledOnce()
    const row = mockLogInsert.mock.calls[0][0]
    expect(row.task_id).toBe('task-uuid-1')
    expect(row.tenant_id).toBe('tenant-uuid-1')
    expect(row.from_status).toBe('open')
    expect(row.to_status).toBe('in_progress')
    expect(row.changed_by).toBe('user-uuid-1')
    expect(row.source).toBe('developer')
  })

  it('uses genesis hash (64 zeros) when no previous log entry exists', async () => {
    mockLogMaybeSingle.mockResolvedValue({ data: null })

    await logRemediationStatusChange(BASE)

    const row = mockLogInsert.mock.calls[0][0]
    expect(row.prev_hash).toBe('0'.repeat(64))
  })

  it('chains from previous signature when a prior entry exists', async () => {
    const prevSignature = 'f'.repeat(64)
    mockLogMaybeSingle.mockResolvedValue({ data: { signature: prevSignature } })

    await logRemediationStatusChange(BASE)

    const row = mockLogInsert.mock.calls[0][0]
    expect(row.prev_hash).not.toBe(prevSignature)
    expect(row.prev_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces a non-empty HMAC signature', async () => {
    await logRemediationStatusChange(BASE)

    const row = mockLogInsert.mock.calls[0][0]
    expect(row.signature).toMatch(/^[0-9a-f]{64}$/)
  })

  it('also writes a cross-reference to audit_logs', async () => {
    await logRemediationStatusChange(BASE)

    expect(mockAuditInsert).toHaveBeenCalledOnce()
    const auditRow = mockAuditInsert.mock.calls[0][0]
    expect(auditRow.tenant_id).toBe('tenant-uuid-1')
    expect(auditRow.action).toBe('remediation.task_status_changed')
    expect(auditRow.reference_id).toBe('task-uuid-1')
  })

  it('stores note when provided', async () => {
    await logRemediationStatusChange({ ...BASE, note: 'Fix was incomplete' })

    const row = mockLogInsert.mock.calls[0][0]
    expect(row.note).toBe('Fix was incomplete')
  })

  it('stores scanResultSummary when provided', async () => {
    await logRemediationStatusChange({
      ...BASE,
      toStatus: 'failed_verification',
      scanResultSummary: 'SQL injection still detectable on /api/users',
    })

    const row = mockLogInsert.mock.calls[0][0]
    expect(row.scan_result_summary).toBe('SQL injection still detectable on /api/users')
  })

  it('does nothing and warns if AUDIT_SIGNING_KEY is missing', async () => {
    delete process.env.AUDIT_SIGNING_KEY
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await logRemediationStatusChange(BASE)

    expect(mockLogInsert).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('AUDIT_SIGNING_KEY'))
  })

  it('does not write to audit_logs when status_log insert fails', async () => {
    mockLogInsert.mockResolvedValue({ error: { message: 'constraint violation' } })

    await logRemediationStatusChange(BASE)

    expect(mockAuditInsert).not.toHaveBeenCalled()
  })

  it('does not throw when audit_logs insert fails', async () => {
    mockAuditInsert.mockResolvedValue({ error: { message: 'audit log unavailable' } })

    await expect(logRemediationStatusChange(BASE)).resolves.toBeUndefined()
  })
})
