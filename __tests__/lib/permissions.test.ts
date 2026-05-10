import { describe, it, expect } from 'vitest'
import {
  ALL_PERMISSIONS,
  ADMIN_DEFAULTS,
  MEMBER_DEFAULTS,
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
