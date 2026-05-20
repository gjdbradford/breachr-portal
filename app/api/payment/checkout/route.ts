import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderForRegion } from '@/lib/payment/factory'
import type { BillingPeriod } from '@/lib/payment/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 400 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, stripe_customer_id, billing_region')
    .eq('id', (profile as any).tenant_id)
    .single()

  const body = await req.json()
  const packageId = body.packageId as string
  const period    = body.period as BillingPeriod
  const returnTo  = typeof body.returnTo === 'string' ? body.returnTo : null

  if (!packageId || !period) {
    return NextResponse.json({ error: 'packageId and period are required' }, { status: 400 })
  }

  const { data: pkg } = await supabase
    .from('packages')
    .select('stripe_price_monthly_id, stripe_price_annual_id, stripe_price_monthly_usd_id, stripe_price_annual_usd_id, trial_period_days')
    .eq('id', packageId)
    .single()

  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

  const billingRegion = (tenant as any)?.billing_region ?? 'row'
  const isEu = billingRegion === 'eu'

  // Select EUR or USD price ID based on billing_region
  const priceId = period === 'annual'
    ? (isEu ? (pkg as any).stripe_price_annual_id : (pkg as any).stripe_price_annual_usd_id)
    : (isEu ? (pkg as any).stripe_price_monthly_id : (pkg as any).stripe_price_monthly_usd_id)

  if (!priceId) {
    return NextResponse.json({ error: 'Package not available for purchase' }, { status: 400 })
  }

  // Trial only for first-time subscribers (no existing stripe_customer_id)
  const trialDays = (tenant as any)?.stripe_customer_id == null
    ? ((pkg as any).trial_period_days ?? 0)
    : 0

  const provider = getProviderForRegion(billingRegion)
  const origin   = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

  const successUrl = returnTo ? `${origin}${returnTo}` : `${origin}/dashboard/upgrade/success`
  const cancelUrl  = returnTo ? `${origin}/onboarding/payment?cancelled=true` : `${origin}/dashboard/upgrade`

  const result = await provider.createCheckoutSession({
    packageId,
    period,
    providerPriceId:    priceId,
    tenantId:           (profile as any).tenant_id,
    customerEmail:      user.email!,
    customerName:       (tenant as any)?.name ?? null,
    existingCustomerId: (tenant as any)?.stripe_customer_id ?? null,
    successUrl,
    cancelUrl,
    trialDays,
  })

  if (result.customerId !== (tenant as any)?.stripe_customer_id) {
    await supabase
      .from('tenants')
      .update({ stripe_customer_id: result.customerId })
      .eq('id', (profile as any).tenant_id)
  }

  return NextResponse.json({ url: result.url })
}
