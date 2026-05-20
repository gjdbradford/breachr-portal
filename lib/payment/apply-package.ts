// portal/lib/payment/apply-package.ts
import { createClient } from '@supabase/supabase-js'
import type { ProviderName } from './types'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function applyPackageToTenant(
  tenantId: string,
  packageId: string,
  provider: ProviderName,
  subscriptionId: string,
  stripeEventId?: string,
): Promise<void> {
  const db = adminClient()

  const { data: pkg } = await db
    .from('packages')
    .select('slug, price_monthly, scans_limit, tokens_limit, targets_limit')
    .eq('id', packageId)
    .single()

  if (!pkg) {
    console.warn(`applyPackageToTenant: package ${packageId} not found — skipping`)
    return
  }

  const { data: tenant } = await db
    .from('tenants')
    .select('plan, mrr_eur')
    .eq('id', tenantId)
    .single()

  const fromPlan = tenant?.plan ?? 'free'
  const fromMrr  = tenant?.mrr_eur ?? 0
  const toMrr    = pkg.price_monthly as number

  await db.from('tenants').update({
    plan:                  pkg.slug,
    plan_scans_limit:      pkg.scans_limit,
    plan_tokens_limit:     pkg.tokens_limit,
    plan_targets_limit:    pkg.targets_limit,
    mrr_eur:               toMrr,
    plan_started_at:       new Date().toISOString(),
    payment_failed:        false,
    intended_package_slug: null,
  }).eq('id', tenantId)

  await db.from('tenant_packages').delete().eq('tenant_id', tenantId)
  await db.from('tenant_packages').insert({
    tenant_id:        tenantId,
    package_id:       packageId,
    payment_provider: provider,
    stripe_sub_id:    provider === 'stripe' ? subscriptionId : null,
  })

  await db.from('subscription_events').insert({
    tenant_id:       tenantId,
    event_type:      fromPlan === 'free' || toMrr > fromMrr ? 'upgraded' : 'downgraded',
    from_plan:       fromPlan,
    to_plan:         pkg.slug,
    mrr_delta_eur:   toMrr - fromMrr,
    mrr_after_eur:   toMrr,
    stripe_event_id: stripeEventId ?? null,
  })
}

export async function revertTenantToFree(
  tenantId: string,
  fromPlan: string,
  fromMrr: number,
  stripeEventId?: string,
): Promise<void> {
  const db = adminClient()

  await db.from('tenants').update({
    plan:               'free',
    plan_scans_limit:   3,
    plan_tokens_limit:  200_000,
    plan_targets_limit: 1,
    mrr_eur:            0,
    cancelled_at:       new Date().toISOString(),
    stripe_subscription_id: null,
  }).eq('id', tenantId)

  await db.from('subscription_events').insert({
    tenant_id:       tenantId,
    event_type:      'cancelled',
    from_plan:       fromPlan,
    to_plan:         'free',
    mrr_delta_eur:   -fromMrr,
    mrr_after_eur:   0,
    stripe_event_id: stripeEventId ?? null,
  })
}
