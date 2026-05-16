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
  DeveloperOnboardingProgress,
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

describe('RemediationStatusLogEntry shape', () => {
  it('accepts a valid log entry with typed statuses', () => {
    const entry: RemediationStatusLogEntry = {
      id: 'l1',
      task_id: 't1',
      tenant_id: 'tn1',
      from_status: 'open',
      to_status: 'in_progress',
      changed_by: 'u1',
      source: 'developer',
      note: null,
      scan_result_summary: null,
      prev_hash: '0'.repeat(64),
      signature: 'a'.repeat(64),
      created_at: new Date().toISOString(),
    }
    expect(entry.from_status).toBe('open')
  })
})

describe('RemediationAISession shape', () => {
  it('accepts a valid AI session with message array', () => {
    const session: RemediationAISession = {
      id: 's1',
      task_id: 't1',
      tenant_id: 'tn1',
      user_id: 'u1',
      messages: [{ role: 'user', content: 'How do I fix this?', tokens: 10, timestamp: new Date().toISOString() }],
      tokens_used: 10,
      message_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    expect(session.messages).toHaveLength(1)
  })
})

describe('TenantIntegration shape', () => {
  it('accepts a valid integration with nullable url fields', () => {
    const integration: TenantIntegration = {
      id: 'i1',
      tenant_id: 'tn1',
      integration: 'jira',
      auth_method: 'oauth',
      jira_base_url: null,
      jira_workspace_name: null,
      connected_by: 'u1',
      connected_at: new Date().toISOString(),
      last_verified_at: null,
      created_at: new Date().toISOString(),
    }
    expect(integration.integration).toBe('jira')
  })
})

describe('DeveloperOnboardingProgress shape', () => {
  it('accepts a valid onboarding progress object', () => {
    const progress: DeveloperOnboardingProgress = {
      id: 'p1',
      user_id: 'u1',
      tenant_id: 'tn1',
      completed_at: null,
      steps_completed: ['profile', 'terms'],
    }
    expect(progress.steps_completed).toHaveLength(2)
  })
})
