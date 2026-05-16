import { describe, it, expect } from 'vitest'

// Types are compile-time only — we test that the exported shapes match expectations
// by importing and using them. If they don't exist the import fails.
import type {
  RemediationBatch,
  RemediationTask,
  RemediationTaskStatus,
  RemediationPriority,
  RemediationStatusLogEntry,
  RemediationAISession,
  TenantIntegration,
} from '@/lib/types'

describe('RemediationTaskStatus', () => {
  it('includes all six valid statuses', () => {
    const statuses: RemediationTaskStatus[] = [
      'open',
      'in_progress',
      'review_requested',
      'verified_fixed',
      'failed_verification',
      'reopened',
    ]
    expect(statuses).toHaveLength(6)
  })
})

describe('RemediationPriority', () => {
  it('includes all four priority levels', () => {
    const priorities: RemediationPriority[] = ['critical', 'high', 'medium', 'low']
    expect(priorities).toHaveLength(4)
  })
})

describe('RemediationBatch shape', () => {
  it('accepts a valid batch object', () => {
    const batch: RemediationBatch = {
      id: 'b1',
      tenant_id: 't1',
      name: 'Sprint 1',
      description: null,
      assigned_to: 'u1',
      created_by: 'u2',
      due_date: null,
      priority: 'high',
      jira_push_enabled: false,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    expect(batch.priority).toBe('high')
  })
})

describe('RemediationTask shape', () => {
  it('accepts a valid task object', () => {
    const task: RemediationTask = {
      id: 't1',
      batch_id: 'b1',
      tenant_id: 'tn1',
      finding_id: 'f1',
      assigned_to: 'u1',
      status: 'open',
      verification_attempts: 0,
      jira_issue_key: null,
      jira_issue_url: null,
      resolved_by: null,
      resolved_at: null,
      resolution_source: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    expect(task.status).toBe('open')
  })
})
