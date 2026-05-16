import { describe, it, expect } from 'vitest'
import {
  ALL_PERMISSIONS,
  ADMIN_DEFAULTS,
  MEMBER_DEFAULTS,
  VIEWER_DEFAULTS,
  DEVELOPER_DEFAULTS,
  PERMISSION_GROUPS,
  can,
  type Permission,
} from '@/lib/permissions'

describe('ALL_PERMISSIONS', () => {
  it('contains no duplicate keys', () => {
    const set = new Set(ALL_PERMISSIONS)
    expect(set.size).toBe(ALL_PERMISSIONS.length)
  })

  it('every PERMISSION_GROUPS entry references a known permission', () => {
    const keys = new Set(ALL_PERMISSIONS)
    for (const group of PERMISSION_GROUPS) {
      for (const p of group.permissions) {
        expect(keys.has(p.key)).toBe(true)
      }
    }
  })
})

describe('ADMIN_DEFAULTS', () => {
  it('covers all permissions', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(p in ADMIN_DEFAULTS).toBe(true)
    }
  })

  it('defaults executive and board reports to false', () => {
    expect(ADMIN_DEFAULTS['reports.read.executive']).toBe(false)
    expect(ADMIN_DEFAULTS['reports.read.board']).toBe(false)
  })
})

describe('MEMBER_DEFAULTS', () => {
  it('defaults all permissions to false', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(MEMBER_DEFAULTS[p]).toBe(false)
    }
  })
})

describe('can()', () => {
  it('returns true when resolved record has true for the action', () => {
    const resolved = Object.fromEntries(
      ALL_PERMISSIONS.map(p => [p, true])
    ) as Record<Permission, boolean>
    expect(can(resolved, 'scans.create')).toBe(true)
  })

  it('returns false when resolved record has false for the action', () => {
    const resolved = Object.fromEntries(
      ALL_PERMISSIONS.map(p => [p, false])
    ) as Record<Permission, boolean>
    expect(can(resolved, 'reports.read.board')).toBe(false)
  })

  it('returns false when the key is missing from resolved record', () => {
    expect(can({} as Record<Permission, boolean>, 'audit.read')).toBe(false)
  })
})

describe('new remediation + integration permissions', () => {
  it('ALL_PERMISSIONS includes all 8 new remediation/integration permissions', () => {
    const newPerms = [
      'remediation.batches.create',
      'remediation.batches.read',
      'remediation.batches.update',
      'remediation.batches.archive',
      'remediation.tasks.read',
      'remediation.tasks.update',
      'remediation.ai_assist',
      'integrations.jira',
    ]
    for (const p of newPerms) {
      expect(ALL_PERMISSIONS).toContain(p)
    }
  })

  it('DEVELOPER_DEFAULTS grants remediation task permissions but not batch management', () => {
    expect(DEVELOPER_DEFAULTS['remediation.tasks.read']).toBe(true)
    expect(DEVELOPER_DEFAULTS['remediation.tasks.update']).toBe(true)
    expect(DEVELOPER_DEFAULTS['remediation.ai_assist']).toBe(true)
    expect(DEVELOPER_DEFAULTS['remediation.batches.create']).toBe(false)
    expect(DEVELOPER_DEFAULTS['remediation.batches.update']).toBe(false)
    expect(DEVELOPER_DEFAULTS['integrations.jira']).toBe(false)
  })

  it('ADMIN_DEFAULTS grants batch management but not integrations.jira', () => {
    expect(ADMIN_DEFAULTS['remediation.batches.create']).toBe(true)
    expect(ADMIN_DEFAULTS['remediation.batches.read']).toBe(true)
    expect(ADMIN_DEFAULTS['remediation.batches.update']).toBe(true)
    expect(ADMIN_DEFAULTS['remediation.batches.archive']).toBe(true)
    expect(ADMIN_DEFAULTS['remediation.tasks.read']).toBe(true)
    expect(ADMIN_DEFAULTS['remediation.tasks.update']).toBe(true)
    expect(ADMIN_DEFAULTS['remediation.ai_assist']).toBe(true)
    expect(ADMIN_DEFAULTS['integrations.jira']).toBe(false)
  })

  it('MEMBER_DEFAULTS and VIEWER_DEFAULTS deny all new permissions', () => {
    const newPerms = [
      'remediation.batches.create',
      'remediation.batches.read',
      'remediation.batches.update',
      'remediation.batches.archive',
      'remediation.tasks.read',
      'remediation.tasks.update',
      'remediation.ai_assist',
      'integrations.jira',
    ] as const
    for (const p of newPerms) {
      expect(MEMBER_DEFAULTS[p]).toBe(false)
      expect(VIEWER_DEFAULTS[p]).toBe(false)
    }
  })

  it('PERMISSION_GROUPS includes Remediation Workflow group with all new keys', () => {
    const group = PERMISSION_GROUPS.find(g => g.label === 'Remediation Workflow')
    expect(group).toBeDefined()
    const keys = group!.permissions.map(p => p.key)
    expect(keys).toContain('remediation.batches.create')
    expect(keys).toContain('remediation.tasks.update')
    expect(keys).toContain('remediation.ai_assist')
  })

  it('PERMISSION_GROUPS includes Integrations group with integrations.jira', () => {
    const group = PERMISSION_GROUPS.find(g => g.label === 'Integrations')
    expect(group).toBeDefined()
    const keys = group!.permissions.map(p => p.key)
    expect(keys).toContain('integrations.jira')
  })
})
