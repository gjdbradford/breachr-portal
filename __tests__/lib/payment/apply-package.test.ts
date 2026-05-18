import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@supabase/supabase-js'
import { applyPackageToTenant, revertTenantToFree } from '@/lib/payment/apply-package'

describe('applyPackageToTenant', () => {
  beforeEach(() => vi.clearAllMocks())

  it('skips update when package is not found', async () => {
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'packages') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }
        }
        return {}
      }),
    }
    vi.mocked(createClient).mockReturnValue(db as any)

    await expect(
      applyPackageToTenant('tenant-1', 'pkg-404', 'stripe', 'sub-1')
    ).resolves.toBeUndefined()
  })

  it('calls tenants.update with package limits when package is found', async () => {
    const updateMock = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'packages') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: { slug: 'starter', price_monthly: 159, scans_limit: 20, tokens_limit: 3_000_000, targets_limit: 5 },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'tenants') {
          return {
            select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { plan: 'free', mrr_eur: 0 }, error: null }) }) }),
            update: updateMock,
          }
        }
        if (table === 'tenant_packages') {
          return {
            delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            insert: insertMock,
          }
        }
        return {
          insert: insertMock,
        }
      }),
    }
    vi.mocked(createClient).mockReturnValue(db as any)

    await applyPackageToTenant('tenant-1', 'pkg-1', 'stripe', 'sub-1')

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'starter',
      plan_scans_limit: 20,
      plan_tokens_limit: 3_000_000,
      plan_targets_limit: 5,
      mrr_eur: 159,
      payment_failed: false,
    }))
  })
})

describe('revertTenantToFree', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resets tenant limits to free tier values', async () => {
    const updateMock = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'tenants') return { update: updateMock }
        return { insert: insertMock }
      }),
    }
    vi.mocked(createClient).mockReturnValue(db as any)

    await revertTenantToFree('tenant-1', 'starter', 159)

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'free',
      plan_scans_limit: 3,
      plan_tokens_limit: 200_000,
      plan_targets_limit: 1,
      mrr_eur: 0,
    }))
  })
})
