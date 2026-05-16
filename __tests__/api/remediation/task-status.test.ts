import { describe, it, expect } from 'vitest'

// Pure guard logic — test in isolation
type TransitionGuardResult = { allowed: boolean; error?: string }

function guardTransition(
  role: string,
  currentStatus: string,
  toStatus: string,
  note: string | undefined,
): TransitionGuardResult {
  const DEVELOPER_TRANSITIONS: Record<string, string[]> = {
    open:                ['in_progress'],
    in_progress:         ['review_requested'],
    failed_verification: ['in_progress'],
    reopened:            ['in_progress'],
  }
  const ADMIN_TRANSITIONS: Record<string, string[]> = {
    review_requested: ['verified_fixed', 'reopened'],
  }

  const isDeveloper    = role === 'developer'
  const isAdminOrOwner = role === 'admin' || role === 'account_owner'

  if (isDeveloper) {
    const allowed = DEVELOPER_TRANSITIONS[currentStatus]?.includes(toStatus) ?? false
    if (!allowed) return { allowed: false, error: `Developers cannot transition from ${currentStatus} to ${toStatus}` }
    return { allowed: true }
  }
  if (isAdminOrOwner) {
    const allowed = ADMIN_TRANSITIONS[currentStatus]?.includes(toStatus) ?? false
    if (!allowed) return { allowed: false, error: `Admins cannot transition from ${currentStatus} to ${toStatus}` }
    if (toStatus === 'reopened' && !note) return { allowed: false, error: 'A note is required when reopening a task' }
    return { allowed: true }
  }
  return { allowed: false, error: 'Insufficient permissions' }
}

describe('task status transition guard', () => {
  describe('developer transitions', () => {
    it('allows open → in_progress', () => expect(guardTransition('developer', 'open', 'in_progress', undefined).allowed).toBe(true))
    it('allows in_progress → review_requested', () => expect(guardTransition('developer', 'in_progress', 'review_requested', undefined).allowed).toBe(true))
    it('allows failed_verification → in_progress', () => expect(guardTransition('developer', 'failed_verification', 'in_progress', undefined).allowed).toBe(true))
    it('allows reopened → in_progress', () => expect(guardTransition('developer', 'reopened', 'in_progress', undefined).allowed).toBe(true))
    it('blocks developer from marking verified_fixed', () => expect(guardTransition('developer', 'review_requested', 'verified_fixed', undefined).allowed).toBe(false))
    it('blocks developer from reopening', () => expect(guardTransition('developer', 'review_requested', 'reopened', 'reason').allowed).toBe(false))
  })
  describe('admin transitions', () => {
    it('allows review_requested → verified_fixed', () => expect(guardTransition('admin', 'review_requested', 'verified_fixed', undefined).allowed).toBe(true))
    it('allows review_requested → reopened with note', () => expect(guardTransition('admin', 'review_requested', 'reopened', 'Fix was wrong').allowed).toBe(true))
    it('blocks reopened with no note', () => {
      const r = guardTransition('admin', 'review_requested', 'reopened', undefined)
      expect(r.allowed).toBe(false)
      expect(r.error).toContain('note is required')
    })
    it('blocks admin from developer-only transitions', () => expect(guardTransition('admin', 'open', 'in_progress', undefined).allowed).toBe(false))
  })
})
